# Plan: AI workout parsing (natural language → saved workout)

> **Status:** approved design, not implemented yet (plan written 2026-10-27).
> **How to use this file:** it is a self-contained handoff for a new session. Implement one step at a time, in order. After each step run `pnpm lint && pnpm build && pnpm test`, then stop for review before starting the next. The "Implementation notes for a fresh session" section below lists the repo conventions and gotchas you need to know.

## Implementation notes for a fresh session

**Stack:** NestJS 11, TypeScript, TypeORM 1.x (Postgres 17), Redis 8 via ioredis, BullMQ, prom-client, class-validator, Joi for env validation, and **pnpm** (never npm or yarn). Jest is configured in `package.json` with `rootDir: src` and `*.spec.ts` files. **No spec files exist yet**, so Step 1 creates the first ones.

**Running locally:**
```bash
pnpm install
docker compose up -d                # postgres :5432, redis :6379, prometheus, grafana :3001
pnpm migration:run
pnpm seed:reference                 # muscle groups + 17 exercises (scripts/seed-exercises.ts)
pnpm start:dev                      # API on :3000, Bull Board at /admin/queues (dev only)
```
Get a token through `POST /auth/register` and then `POST /auth/login`. Every other route needs `Authorization: Bearer <token>`.

**Repo conventions (follow them):**
- **Modular monolith.** Each module lives in `src/modules/<name>/` with its entity, service, controller, `dto/` and an `index.ts` barrel. Other modules import **only from the barrel** (`from '../exercises'`), never another module's internal files or repositories. `.dependency-cruiser.js` warns about circular value imports. Use `import type` and string relation targets (see `workout.entity.ts` → `'User'`) to avoid them.
- **Comment style:** explain the *why* in short JSDoc on public service methods and short inline comments for non-obvious decisions. Match the density of `workouts.service.ts`.
- **Ownership:** user-scoped lookups filter by `userId` in the `WHERE` clause and throw `NotFoundException` (**404, not 403**) when the row is someone else's (see `WorkoutsService.getOwnedWorkout`).
- **Redis caching pattern:** inject with `@Inject(REDIS_CLIENT) private readonly redis: Redis` (the global module `src/modules/redis`). Use `get`, then `JSON.parse`, or load and `set(key, json, 'EX', ttl)`. Invalidate with `del` on write. Examples: `MuscleGroupsService.findAll` (key `muscle-groups:all`, 1h) and `UsersService.getById` (key `user:{id}`, 60s).
- **Migrations:** never edit committed migrations. Generate them with `pnpm migration:generate src/migrations/<Name>`, then review the SQL. **New entities must be added to the `entities` array in `src/data-source.ts`** (the CLI DataSource). The app itself uses `autoLoadEntities: true`, so entities also need `TypeOrmModule.forFeature([...])` in their module.
- **Env vars:** add each new variable to the Joi schema in `src/app.module.ts` (with defaults where it makes sense) **and** to `.env.example`. Read them with `ConfigService`.
- **Guards:** `@UseGuards(JwtAuthGuard)` gives `@CurrentUser() user: AuthenticatedUser` (`{ userId, role }`). Admin routes use `@UseGuards(JwtAuthGuard, RolesGuard) @Roles('admin')` (see `users.controller.ts`). The JWT payload is `{ sub, role }` only.
- **Global pipe:** `ValidationPipe({ whitelist: true, transform: true })` in `src/main.ts`.
- **Numerics:** Postgres `numeric` comes back as a **string**, so `cost_usd` and `weight_kg` are typed `string` on entities (see `WorkoutSet.weightKg`).
- **Route order:** in `WorkoutsController`, the new `@Get('parse')` and `@Get('parse/:requestId')` must be declared **before** `@Get(':id')`. Otherwise `parse` is treated as an id and fails `ParseUUIDPipe`.

**Key existing code to read first:**
- `src/modules/llm/llm.service.ts`: the current `LlmService` port (`parseWorkout(rawText) → { sets: ParsedSet[] }`) and the `LLM_SERVICE` token.
- `src/modules/llm/mock-llm.service.ts`: the regex mock with a 1.5–4s delay and a 10% failure rate. Keep this behaviour in `providers/mock.client.ts`, because load tests depend on it.
- `src/modules/workouts/workout-parse.processor.ts`: the worker with `CONCURRENCY_NUMBER = 125`, the idempotency check through `findByIdempotencyKey`, and `UnrecoverableError` for unknown exercises.
- `src/modules/workouts/workouts.service.ts`:
  - `create(userId, dto, idempotencyKey?)` is transactional, validates exercise ids and handles the `23505` idempotency race.
  - `requestParse()` currently uses `randomUUID()` from bullmq, 3 attempts, exponential backoff 2000ms, `removeOnComplete: 100` and `removeOnFail: 500`.
- `src/modules/workouts/dto/workout.dto.ts`: `CreateWorkoutSetDto` ranges (setNumber 1–100, reps 1–1000, weightKg 0–1000 with 2 decimals). `ParseWorkoutDto` currently has only `@IsString()`.
- `src/modules/exercises/exercises.service.ts`: `findByName` (case-insensitive) and `findExistingIds`.
- `src/modules/metrics/metrics.service.ts`: the prom-client `Registry` that new metrics register on.
- `src/modules/users/user.entity.ts`, `users.service.ts`, `users.controller.ts`, `dto/user-response.dto.ts`.

**Gotchas:**
- The app runs as **2 pm2 processes** (`start:prod` uses `-i 2`). All counters and rate limits must live in Redis or Postgres, never in memory.
- `scripts/loadtest-queue.js` sends **50 parse requests per second** with seeded users. The new quota, rate limit and in-flight cap would reject most of them. In Step 6, make the limits configurable high for load tests (env overrides) and update the script for the new 202 response (`requestId`).
- `scripts/loadtest-queue.js` lists `'Barbell Bench Press'`, which is **not** in `scripts/seed-exercises.ts`. Those jobs fail with "unknown exercise" today. Fix the list in Step 6.
- When `UserResponseDto` gains `plan`, `setPlan()` must also `del` the `user:{id}` cache key.
- Pick a cheap OpenRouter model slug when implementing. Check that it supports `response_format: json_schema`; if not, set `LLM_STRUCTURED_OUTPUT=false` and rely on the prompt, zod validation and the repair retry.
- Never log or return the `LLM_API_KEY`. The processor's existing `onFailed` log prints `rawText`. That's fine for dev, but don't add raw provider responses to user-facing errors.

## Context

Users describe a whole training session in plain text and the server saves it as a structured workout. The async pipeline already exists. The LLM is a mock, validation is minimal, and there is no rate limiting, usage tracking, subscription plan or way for the user to see the result.

**Already in place and reused:**
- `POST /workouts/parse` → `WorkoutsService.requestParse()` → BullMQ job with 3 retries and a server-side idempotency key → returns 202.
- `WorkoutParseProcessor` → `LLM_SERVICE.parseWorkout()` → `ExercisesService.findByName()` → `WorkoutsService.create()`. The save is transactional, and the idempotency key is unique.
- `src/modules/llm/`: the `LlmService` port, the `LLM_SERVICE` token and `MockLlmService`.
- Global `REDIS_CLIENT` (`src/modules/redis`), `MetricsService` (prom-client), `JwtAuthGuard`, `RolesGuard`, `@CurrentUser`, and Joi environment validation in `src/app.module.ts`.

**Decisions made:**
- Cheap open-source models through **OpenRouter**. Changing model or provider is config only.
- Stay **async**. The client learns the result by **short polling** a status endpoint.
- The LLM **may only choose from the exercise catalogue**.
- On success the workout is **saved immediately**, and the user can edit it afterwards.
- **Per-plan daily quota**: free users get fewer requests than pro users. Usage is **tracked in the DB** for analytics.

Every step below can be merged on its own and leaves the app working. Run `pnpm lint && pnpm build && pnpm test` after each one.

---

## Step 1: Provider-agnostic LLM layer + OpenRouter adapter

**Goal:** a real LLM parses text. The model and provider can be switched through env.

- `pnpm add openai zod`
- `src/modules/llm/llm-client.ts`: the low-level port that every provider implements.
  - `LlmClient.complete({ system, messages, jsonSchema?, maxOutputTokens, temperature, signal })` returns `{ text, provider, model, usage?: { inputTokens, outputTokens, costUsd? } }`.
  - Plus the `LLM_CLIENT` token.
- `src/modules/llm/llm.errors.ts`: `LlmError` with `kind: 'transient' | 'permanent'`.
  - Transient: 429, 5xx, timeout, network errors.
  - Permanent: 400, 401, 403, unknown model.
- `providers/openai-compatible.client.ts`:
  - Uses the `openai` SDK with a configurable `baseURL`. This covers OpenRouter, OpenAI, Groq, DeepSeek and Ollama.
  - Sends `response_format: json_schema` when `LLM_STRUCTURED_OUTPUT=true`.
  - Reads usage and cost from the response.
- `providers/mock.client.ts`: the old mock behind the new port, returning canned JSON. Delete `mock-llm.service.ts`.
- `providers/fallback.client.ts`: if `LLM_FALLBACK_MODEL` is set, retries one *transient* failure on the fallback model.
- `prompts/parse-workout.prompt.ts`: a versioned constant (`PROMPT_VERSION`).
  - The system prompt includes the rules, today's date and the allowed exercise names.
  - User text goes inside `<workout_log>` and is described as data, never instructions.
  - The model gets no tools and the prompt contains no secrets.
- `workout-parse.schema.ts`: one zod schema, used both for `z.toJSONSchema()` (sent to the provider) and for validating the reply:
  ```
  { status: 'ok'|'not_a_workout',
    exercises: [{ name: enum(catalogue)|'UNKNOWN', originalText, sets: [{ reps 1–1000, weightKg 0–1000|null }] }],
    performedAt: ISO|null, durationMinutes: int|null }
  ```
  The server assigns `setNumber`.
- `workout-parser.service.ts` (`LlmWorkoutParser`, bound to the existing `LLM_SERVICE` token):
  - `parseWorkout(rawText, { allowedExercises, now })` returns `ParseOutcome`: `ok` with the workout, or `rejected` with reason `not_a_workout` or `unrecognized_exercises`.
  - Strips markdown fences, runs `JSON.parse`, validates with zod, and makes **one repair retry** that sends the zod error back to the model.
  - Uses temperature 0, `AbortSignal.timeout`, and `maxOutputTokens`.
- `llm.module.ts`: a `useFactory` that picks the client from `LLM_PROVIDER`.
- Env, added to the Joi schema and `.env.example`:
  `LLM_PROVIDER` (`mock` | `openai-compatible`, default `mock`), `LLM_BASE_URL`, `LLM_API_KEY` (required unless `mock`), `LLM_MODEL`, `LLM_FALLBACK_MODEL?`, `LLM_TIMEOUT_MS=20000`, `LLM_MAX_OUTPUT_TOKENS=1500`, `LLM_STRUCTURED_OUTPUT=true`.
- `MetricsService`: add `llm_requests_total{provider,model,outcome}`, `llm_request_duration_seconds` and `llm_tokens_total{direction}`.
- **Tests:**
  - `workout-parser.service.spec.ts` with a fake `LlmClient`: valid JSON, fenced JSON, repair, `not_a_workout`, `UNKNOWN`, error kinds.
  - `openai-compatible.client.spec.ts`: maps HTTP statuses to `LlmError.kind`.

**Extensibility (added after review):** set shapes live in a registry, `src/modules/llm/set-types/` (`strength` only for now). Each type defines its zod set schema, prompt rules, reply shape and normalisation. The reply schema is a union of one exercise variant per type present in the catalogue (`type` + names of that type + that type's sets) plus `{ type: 'unknown', name: 'UNKNOWN' }`. To add a type (e.g. cardio): add `<name>.set-type.ts`, register it in `set-types/index.ts`, then handle the compile error in `toWorkoutSets` (processor). Prompt, schema and parser need no changes.

## Step 2: Processor uses the catalogue + input validation

**Goal:** only workout-like text reaches the LLM, and its output is restricted to known exercises.

- `ExercisesService.getCatalogue()`: returns `{ id, name, setType }[]`, cached in Redis (same pattern as muscle-groups) and invalidated in `create()`. Exercises have no type column yet, so `setType` is `'strength'` for all of them; the column comes with the cardio work.
- `WorkoutParseProcessor`:
  - Passes the catalogue (`{ name, setType }`) to the parser and maps names → ids from it. This removes the N+1 `findByName` loop and the temporary `findAll(1, 1000)`.
  - Converts sets into `CreateWorkoutSetDto` with sequential `setNumber` via the existing exhaustive `toWorkoutSets` switch.
  - `rejected` outcomes, schema failures and permanent errors throw `UnrecoverableError` with a user-safe code: `NOT_A_WORKOUT`, `UNRECOGNIZED_EXERCISES`, `PARSE_FAILED` or `LLM_UNAVAILABLE`.
  - Transient errors throw a normal error, so BullMQ retries them.
  - Lower `CONCURRENCY_NUMBER` from 125 to about 20 and add a worker `limiter: { max: 20, duration: 1000 }`.
- `ParseWorkoutDto`: `@MinLength(10) @MaxLength(2000)`, plus a `@Transform` that trims and strips control and zero-width characters.
- `src/modules/workouts/workout-input.validator.ts`: a pure pre-filter called in `requestParse()` that returns `400 INVALID_INPUT`. It rejects text that:
  - has no digit,
  - matches injection patterns ("ignore previous instructions", "system prompt", "you are now", `<|im_start|>`, `assistant:`),
  - contains URLs or code fences,
  - is low-letter-density noise or one repeated character.
- Defence in depth: the LLM output is validated by zod plus the catalogue enum, and then again by `WorkoutsService.create()`. The worst case is a bogus workout in the attacker's own account.
- **Tests:** `workout-input.validator.spec.ts`, plus a processor spec covering error-code mapping.

## Step 3: Request tracking table + status/history endpoints

**Goal:** every request is recorded in the DB, and the user can poll for the result.

- New module `src/modules/ai-usage/` with the entity `AiParseRequest` and the table `ai_parse_requests`:
  - `id` uuid PK. **This id is also the BullMQ `jobId` and the workout idempotency key.**
  - `user_id` (FK, cascade), `plan_at_request`
  - `status` (`queued`|`processing`|`completed`|`failed`), `error_code`, `error_details` jsonb (user-safe)
  - `counts_toward_quota` bool (default true), `input_chars`
  - `provider`, `model`, `prompt_version`, `input_tokens`, `output_tokens`, `cost_usd` numeric(10,6)
  - `attempts`, `latency_ms`
  - `workout_id` (FK, `ON DELETE SET NULL`)
  - `created_at`, `finished_at`
  - Indexes: `(user_id, created_at DESC)`, `(created_at)`, and a partial index on `(user_id) WHERE status IN ('queued','processing')`.
- Migration: `pnpm migration:generate src/migrations/CreateAiParseRequests`.
- `AiUsageService`:
  - `createRequest()`, `markProcessing()`, `markCompleted(id, workoutId, usage)`, `markFailed(id, code, details, usage)`, `findForUser(userId, id)`, `listForUser(userId, page, limit)`.
- `requestParse()`:
  - Creates the row, then enqueues with `jobId = row.id` and `idempotencyKey = row.id`.
  - Returns `202 { requestId, status: 'queued', pollAfterMs: 1500 }`.
- The processor updates the row at start, success and *final* failure. It checks `job.attemptsMade` against `attempts` in the `failed` handler.
  - The parser result type carries usage (tokens and cost) so the processor can record it.
- Routes in `WorkoutsController`, declared **before** `@Get(':id')`:
  - `GET /workouts/parse?page&limit`: the user's history.
  - `GET /workouts/parse/:requestId`: returns `{ requestId, status, workoutId?, error?: { code, message, details? } }`. Responds 404 if the request isn't the user's.
  - `message` comes from a code → text map. Raw provider errors are never shown.
- **Tests:** a service spec for the status mapping and ownership (404).

## Step 4: Subscription plans

**Goal:** each user has a plan whose changes take effect immediately.

- Migration `AddUserPlan`: `users.plan enum('free','pro') default 'free'` and `users.plan_expires_at timestamp null`.
- `User` entity fields, plus `UsersService`:
  - `getEffectivePlan(userId)` returns `pro` only if the plan is `pro` and it hasn't expired. The result is cached in Redis for 60s.
  - `setPlan(userId, plan, expiresAt?)` saves the plan and invalidates the cache.
- Admin route `PATCH /users/:id/plan` (`RolesGuard`, `@Roles('admin')`). Billing webhooks can reuse `setPlan` later.
- The plan is **not** put in the JWT, because it would be stale until the token expires.
- `src/modules/ai-usage/plan-limits.ts` maps each plan to its daily limit, from env: `AI_PARSE_DAILY_LIMIT_FREE=5` and `AI_PARSE_DAILY_LIMIT_PRO=100`.

## Step 5: Quota, rate limiting, usage endpoint

**Goal:** abuse is blocked and per-plan quotas are enforced.

- `AiQuotaService`:
  - **Atomic Redis counter** `quota:parse:{userId}:{YYYY-MM-DD UTC}`. A Lua script does `INCR` + `EXPIRE`; if the count goes over the limit it does `DECR` and rejects.
  - If the key is missing, it is seeded with `SET NX` from the DB count of today's rows where `counts_toward_quota`.
  - `refund(requestId)` sets `counts_toward_quota=false` and runs `DECR`.
- What counts: every request that passes validation and is queued.
  - **Refunded:** `LLM_UNAVAILABLE` and internal errors.
  - **Not refunded:** `NOT_A_WORKOUT` and `UNRECOGNIZED_EXERCISES`.
- The **full order** in `requestParse()`:
  1. Validate.
  2. Check the in-flight cap: at most 2 requests per user in `queued`/`processing`, counted in the DB using the partial index. Over the cap → `409 TOO_MANY_PENDING`.
  3. Take one unit of quota. Over the limit → `429 DAILY_QUOTA_EXCEEDED { limit, used, resetsAt, plan }`.
  4. Create the row.
  5. Enqueue the job.
- `src/common/rate-limit/`: a `@RateLimit({ points: 5, windowSec: 60 })` decorator and `RateLimitGuard`.
  - It keys on `userId` and runs after `JwtAuthGuard`, before validation, so probing is throttled too.
  - Over the limit → `429 RATE_LIMITED` with `Retry-After`.
- `GET /ai/usage` returns `{ plan, limit, used, remaining, resetsAt }`.
- `GET /admin/ai-usage/summary?from&to` (admin only) returns, per day × plan × model: count, failure rate, tokens and cost.
- Optional: `LLM_DAILY_BUDGET_USD`. If today's total `cost_usd` exceeds it, new requests get `503`.
- **Tests:** `rate-limit.guard.spec.ts` and `ai-quota.service.spec.ts`, using real Redis from docker compose. Cover: limit hit, refund, re-seed after flush, and a pro user getting the higher limit.

## Step 6: Docs + end-to-end check

- README:
  - API table: add `GET /workouts/parse`, `GET /workouts/parse/:id`, `GET /ai/usage`, `PATCH /users/:id/plan` and the admin summary.
  - Add the new env vars.
  - Remove "Real LLM integration" and "Job status tracking" from "Not yet built".
- Update `scripts/loadtest-queue.js` for the new 202 response shape. Run it with `LLM_PROVIDER=mock`.

---

## UX (client behaviour, for reference)

1. The "Log with AI" screen has a textarea, a 2000-character counter and a quota badge from `GET /ai/usage`. When the quota is used up, the submit button is disabled and the screen shows an upgrade prompt or the reset time.
2. Submit. Instant errors are shown inline, the text is kept and nothing is charged: `INVALID_INPUT`, `RATE_LIMITED`, `TOO_MANY_PENDING`, `DAILY_QUOTA_EXCEEDED`.
3. The server replies `202`. The client shows "Parsing your workout…" and polls `GET /workouts/parse/:id` every ~1.5s with backoff, stopping at `completed` or `failed`. The user can leave; the history list shows the request.
4. On `completed`: a toast, then the workout detail page with editing available. On `failed`: the original text comes back with a message for the code, and `LLM_UNAVAILABLE` says the request wasn't counted.
5. Later, SSE or long polling can replace polling with no worker changes. The processor already publishes `ai-parse:{userId}` to Redis when a job finishes. Not in scope now.

## Verification (end to end)

Run `docker compose up -d && pnpm migration:run && pnpm seed:reference`, set the OpenRouter env vars, then `pnpm start:dev`. Then:

- A realistic multi-exercise text → 202 → poll → `completed` → `GET /workouts/:id` shows the right sets.
- "ignore previous instructions…" → `400` right away, no row created.
- "what's the weather 2day" → `failed` / `NOT_A_WORKOUT`.
- "5x5 zercher squats 100kg" → `failed` / `UNRECOGNIZED_EXERCISES`.
- Six POSTs within a minute → the sixth returns `429 RATE_LIMITED`.
- A free user's 6th request of the day → `429 DAILY_QUOTA_EXCEEDED`. After an admin sets `pro`, the next request is accepted with no re-login.
- A bad API key → `LLM_UNAVAILABLE`, the row has `counts_toward_quota=false`, and `GET /ai/usage` shows the request refunded.
- Rows in `ai_parse_requests` have tokens, cost, model and `workout_id` filled in. The admin summary returns aggregates.
- Requesting another user's request id → 404.
