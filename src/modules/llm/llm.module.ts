import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetricsModule, MetricsService } from '../metrics';
import { LLM_CLIENT } from './llm-client';
import type { LlmClient } from './llm-client';
import { LLM_SERVICE } from './llm.service';
import { LlmWorkoutParser } from './workout-parser.service';
import { MockLlmClient } from './providers/mock.client';
import { OpenAiCompatibleClient } from './providers/openai-compatible.client';
import { FallbackLlmClient } from './providers/fallback.client';
import { InstrumentedLlmClient } from './providers/instrumented.client';

const logger = new Logger('LlmModule');

/** Picks the provider from env; switching model or provider is config only. */
function createLlmClient(
  config: ConfigService,
  metrics: MetricsService,
): LlmClient {
  const instrument = (client: MockLlmClient | OpenAiCompatibleClient) =>
    new InstrumentedLlmClient(
      client,
      { provider: client.provider, model: client.model },
      metrics,
    );

  if (config.get<string>('LLM_PROVIDER') === 'mock') {
    logger.log('LLM provider: mock (no API calls)');
    return instrument(new MockLlmClient());
  }

  const base = {
    baseURL: config.getOrThrow<string>('LLM_BASE_URL'),
    apiKey: config.getOrThrow<string>('LLM_API_KEY'),
    structuredOutput: config.get<boolean>('LLM_STRUCTURED_OUTPUT', true),
  };
  const primary = instrument(
    new OpenAiCompatibleClient({
      ...base,
      model: config.getOrThrow<string>('LLM_MODEL'),
    }),
  );

  const fallbackModel = config.get<string>('LLM_FALLBACK_MODEL');

  // Warn level so a paid provider stands out in the startup log.
  logger.warn(
    `LLM provider: ${new URL(base.baseURL).hostname} ` +
      `(model ${config.get<string>('LLM_MODEL')}` +
      `${fallbackModel ? `, fallback ${fallbackModel}` : ''}) — real API calls cost money`,
  );

  if (!fallbackModel) return primary;

  return new FallbackLlmClient(
    primary,
    instrument(new OpenAiCompatibleClient({ ...base, model: fallbackModel })),
  );
}

@Module({
  imports: [MetricsModule],
  providers: [
    {
      provide: LLM_CLIENT,
      inject: [ConfigService, MetricsService],
      useFactory: createLlmClient,
    },
    { provide: LLM_SERVICE, useClass: LlmWorkoutParser },
  ],
  exports: [LLM_SERVICE],
})
export class LlmModule {}
