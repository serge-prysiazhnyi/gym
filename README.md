# Gym

A workout logging API. Users log training sessions in plain language, the app parses them into structured records, and progress is aggregated into charts.

The project doubles as a platform for practising backend engineering under load: it ships with seed scripts that generate millions of rows, a k6 load-testing suite, and a Prometheus + Grafana observability stack for finding and fixing bottlenecks.

## Features

- **Authentication** — email/password registration with argon2 hashing, JWT access tokens, and role-based authorization (`user` / `admin`).
- **Workout logging** — create a workout with all its sets in one atomic request, then add, edit, or remove individual sets.
- **Natural-language parsing** — submit free text ("4 sets of 8 Bench Press at 60 kg") and it is parsed into a structured workout by a background job, so the API never waits on the slow parsing step.
- **Exercise catalogue** — exercises and muscle groups, related many-to-many. Readable by any user, writable only by admins.
- **Progress aggregation** — training volume per muscle group over time, grouped by day, week, or month.

## Tech stack

- **Runtime:** Node.js, TypeScript
- **Framework:** NestJS
- **Database:** PostgreSQL with TypeORM (migrations, no `synchronize`)
- **Cache and queue backend:** Redis
- **Background jobs:** BullMQ
- **Containers:** Docker Compose
- **Load testing:** k6
- **Metrics:** prom-client, Prometheus, Grafana
- **Package manager:** pnpm

## Architecture

A modular monolith. Each feature module owns its entities, service, controller, and DTOs, and exposes a public API through its module exports. Modules call each other through those exports rather than reaching into another module's repositories.

```
src/
├── modules/
│   ├── auth/             JWT strategy, guards, roles, @CurrentUser
│   ├── users/            user entity, registration target, admin listing
│   ├── muscle-groups/    reference catalogue (cached)
│   ├── exercises/        exercise catalogue, many-to-many with muscle groups
│   ├── workouts/         workouts, sets, and the parse job processor
│   ├── progress/         aggregation queries
│   ├── llm/              parsing interface + mock implementation
│   ├── queue/            BullMQ setup, Bull Board (dev only)
│   ├── redis/            shared Redis client
│   └── metrics/          Prometheus metrics endpoint
├── db/                   TypeORM connection and pool config
├── migrations/           TypeORM migrations (committed, never edited)
└── data-source.ts        DataSource for the migration CLI

scripts/                  seeding, token minting, load tests, queue inspection
```

### Background job flow

`POST /workouts/parse` does not parse anything. It enqueues a BullMQ job and returns `202 Accepted` immediately. A worker picks the job up, calls the LLM service, resolves exercise names to catalogue entries, and creates the workout.

Jobs carry a server-generated idempotency key, stored on the workout under a unique constraint. Retries of the same job therefore cannot create duplicate workouts — the consumer is idempotent, which is what makes at-least-once delivery safe.

## Data model

```
Users ──< Workouts ──< WorkoutSets >── Exercises >──< MuscleGroups
```

- **Users** — account with a role of `user` or `admin`.
- **Workouts** — one training session belonging to a user; optional duration and original raw text.
- **WorkoutSets** — individual sets (exercise, set number, reps, weight). The table that grows into the millions.
- **Exercises** — a movement, with optional description and image URL.
- **MuscleGroups** — linked many-to-many to exercises.

Indexes worth knowing about: `workouts (user_id, performed_at)` for user history and progress date ranges, `workout_sets (workout_id)` for joins, and a functional unique index on `LOWER(exercises.name)` so the catalogue cannot contain case-variant duplicates.

## API

All routes except registration and login require `Authorization: Bearer <token>`.

| Method | Route                       | Notes                                       |
| ------ | --------------------------- | ------------------------------------------- |
| POST   | `/auth/register`            |                                             |
| POST   | `/auth/login`               | returns an access token                     |
| GET    | `/users/:id`                | cached in Redis                             |
| GET    | `/users/all`                | admin only, paginated                       |
| GET    | `/muscle-groups`            | cached                                      |
| POST   | `/muscle-groups`            | admin only                                  |
| GET    | `/exercises`                | paginated                                   |
| GET    | `/exercises/:id`            |                                             |
| POST   | `/exercises`                | admin only                                  |
| POST   | `/workouts`                 | creates workout and sets in one transaction |
| GET    | `/workouts`                 | own workouts, paginated, summaries only     |
| GET    | `/workouts/:id`             | full detail with sets                       |
| PATCH  | `/workouts/:id`             |                                             |
| DELETE | `/workouts/:id`             | cascades to sets                            |
| POST   | `/workouts/:id/sets`        |                                             |
| PATCH  | `/workouts/:id/sets/:setId` |                                             |
| DELETE | `/workouts/:id/sets/:setId` |                                             |
| POST   | `/workouts/parse`           | enqueues a parse job, returns 202           |
| GET    | `/progress/volume`          | aggregated volume, cached                   |
| GET    | `/metrics`                  | Prometheus scrape endpoint                  |

User data routes are scoped by the authenticated user in the `WHERE` clause, so requesting another user's resource returns 404 rather than revealing that it exists.

## Getting started

### Prerequisites

Node.js, pnpm, Docker.

### Setup

```bash
pnpm install
cp .env.example .env        # then fill in the values
docker compose up -d        # Postgres, Redis, Prometheus, Grafana
pnpm migration:run
pnpm seed:reference         # muscle groups and exercises
pnpm start:dev
```

The API runs on port 3000. Grafana is on 3001, Prometheus on 9090, and the queue admin UI at `/admin/queues` (development only).

### Environment

Required variables, validated with Joi at startup — the app refuses to boot if any are missing or malformed:

```
NODE_ENV
DATABASE_URL
REDIS_URL
JWT_SECRET          (minimum 32 characters)
JWT_EXPIRES_IN      (seconds)
POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB
```

## Load testing

The workflow this project was built around:

1. **Seed volume.** `pnpm seed:users` creates thousands of users; `pnpm seed:workouts` generates workouts and millions of sets spread over two years of dates.
2. **Mint tokens.** `pnpm exec ts-node scripts/mint-tokens.ts` signs a JWT per seeded user, so load tests can act as thousands of different users without going through the login flow. Login is deliberately excluded — argon2 is expensive by design, and including it would measure hashing rather than the endpoints under test.
3. **Run k6.** Scripts in `scripts/` cover read endpoints and the parse queue. Per-endpoint custom metrics keep cheap and expensive routes from being averaged together.
4. **Watch Grafana.** Panels for connection pool usage, event loop lag, memory, and queue depth.
5. **Find the bottleneck, fix it, re-measure.** One change at a time, comparing against the previous run.

After bulk seeding, run `ANALYZE` on the affected tables — Postgres plans queries from statistics, and stale statistics after a large insert lead to bad plans.

### Notes from previous runs

- Unbounded queries are invisible at small scale. A missing `take` in a paginated query returned every row once the table grew.
- One slow endpoint degrades all of them. Large nested responses blocked cheap cached reads, because serialization is synchronous work on a single-threaded event loop. The fix was returning less data, not a database index.
- An index existing does not mean it is used. A query filtering 33 rows out of 166,000 was resolved by a parallel sequential scan because the planner costed parallelism too cheaply; the fix was planner configuration, not a new index.
- Queue depth is invisible from the API side. During queue load tests every HTTP metric stayed green while thousands of jobs backed up behind them — a failure mode only visible by monitoring the queue itself.

## Not yet built

- Job status tracking and a status endpoint (parse failures are currently only visible in logs and Bull Board)
- Automated tests
- Real LLM integration (the interface exists; only the mock is implemented)
- Deployment
- Frontend
