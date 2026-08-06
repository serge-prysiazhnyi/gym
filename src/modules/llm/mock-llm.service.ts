import { Injectable, Logger } from '@nestjs/common';
import type { LlmService, ParsedWorkout } from './llm.service';

@Injectable()
export class MockLlmService implements LlmService {
  private readonly logger = new Logger(MockLlmService.name);

  async parseWorkout(rawText: string): Promise<ParsedWorkout> {
    // Simulate realistic LLM latency: 1.5–4 seconds
    const delay = 1500 + Math.random() * 2500;
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Simulate a 10% failure rate — external services fail
    if (Math.random() < 0.1) {
      throw new Error('LLM request failed (simulated)');
    }

    this.logger.debug(`Parsed in ${Math.round(delay)}ms: "${rawText}"`);

    // Naive regex parse — good enough to produce plausible output
    const match =
      /(\d+)\s*sets?\s*of\s*(\d+)\s*(.+?)(?:\s*at\s*(\d+)\s*kg)?$/i.exec(
        rawText.trim(),
      );

    if (!match) {
      return {
        sets: [{ exerciseName: 'Squat', setNumber: 1, reps: 10, weightKg: 60 }],
      };
    }

    const [, setCount, reps, exerciseName, weight] = match;

    const sets = Array.from({ length: Number(setCount) }, (_, i) => ({
      exerciseName: exerciseName.trim(),
      setNumber: i + 1,
      reps: Number(reps),
      weightKg: weight ? Number(weight) : null,
    }));

    return { sets };
  }
}
