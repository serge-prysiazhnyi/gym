import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
} from 'openai';
import { LlmError } from '../llm.errors';
import { OpenAiCompatibleClient } from './openai-compatible.client';

const client = new OpenAiCompatibleClient({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: 'sk-test-secret',
  model: 'some/model',
  structuredOutput: true,
});

const httpError = (status: number) =>
  APIError.generate(
    status,
    { message: 'upstream said no' },
    undefined,
    new Headers(),
  );

describe('OpenAiCompatibleClient.toLlmError', () => {
  it.each([429, 500, 502, 503, 408])('HTTP %i → transient', (status) => {
    const err = client.toLlmError(httpError(status));
    expect(err).toBeInstanceOf(LlmError);
    expect(err.kind).toBe('transient');
    expect(err.details).toEqual({
      provider: 'openrouter.ai',
      model: 'some/model',
      status,
    });
  });

  it.each([400, 401, 402, 403, 404, 422])('HTTP %i → permanent', (status) => {
    expect(client.toLlmError(httpError(status)).kind).toBe('permanent');
  });

  it.each([
    ['connection error', new APIConnectionError({ message: 'ECONNRESET' })],
    ['timeout', new APIConnectionTimeoutError()],
    ['abort (our AbortSignal.timeout)', new APIUserAbortError()],
    ['unknown error', new TypeError('fetch failed')],
  ])('%s → transient', (_, cause) => {
    expect(client.toLlmError(cause).kind).toBe('transient');
  });

  it('never includes the API key or provider body in the message', () => {
    const err = client.toLlmError(httpError(401));
    expect(err.message).toBe('LLM provider responded with HTTP 401');
    expect(err.message).not.toContain('sk-test-secret');
  });
});
