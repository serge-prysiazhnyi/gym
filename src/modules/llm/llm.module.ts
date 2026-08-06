import { Module } from '@nestjs/common';
import { LLM_SERVICE } from './llm.service';
import { MockLlmService } from './mock-llm.service';

@Module({
  providers: [
    { provide: LLM_SERVICE, useClass: MockLlmService }, // ← the swap point
  ],
  exports: [LLM_SERVICE],
})
export class LlmModule {}
