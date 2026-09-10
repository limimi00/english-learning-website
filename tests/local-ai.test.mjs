import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCAL_AI_PRESETS,
  normalizeLocalAiSettings,
  selectApprovedMove,
  testLocalAiConnection,
  validateLoopbackBaseUrl,
} from '../assets/js/local-ai.js';

const LM_STUDIO_SETTINGS = {
  baseUrl: 'http://127.0.0.1:1234/v1',
  model: 'local-model',
};

test('presets use exact loopback OpenAI-compatible endpoints', () => {
  assert.equal(LOCAL_AI_PRESETS.ollama.baseUrl, 'http://127.0.0.1:11434/v1');
  assert.equal(LOCAL_AI_PRESETS.lmstudio.baseUrl, 'http://127.0.0.1:1234/v1');
});

test('URL validation accepts explicit HTTP loopback hosts and normalizes trailing slashes', () => {
  assert.deepEqual(validateLoopbackBaseUrl('http://127.0.0.1:11434/v1/'), {
    valid: true,
    baseUrl: 'http://127.0.0.1:11434/v1',
  });
  assert.equal(validateLoopbackBaseUrl('http://localhost:1234/v1').valid, true);
  assert.equal(validateLoopbackBaseUrl('http://[::1]:8080/v1').valid, true);
  assert.equal(validateLoopbackBaseUrl('http://localhost:80/v1').valid, true);
});

test('URL validation rejects remote, credentialed, portless, and unsupported endpoints', () => {
  const invalidUrls = [
    'http://192.168.1.2:11434/v1',
    'https://example.com:443/v1',
    'http://user:pass@localhost:1234/v1',
    'http://localhost/v1',
    'https://localhost:1234/v1',
    'ftp://127.0.0.1:1234/v1',
    '//localhost:1234/v1',
    'http://localhost.evil:1234/v1',
  ];

  for (const baseUrl of invalidUrls) {
    assert.equal(validateLoopbackBaseUrl(baseUrl).valid, false, baseUrl);
  }
});

test('URL validation rejects ambiguous URL spellings and components', () => {
  const invalidUrls = [
    ' http://localhost:1234/v1',
    'http://localhost:1234/v1 ',
    'http://127.1:1234/v1',
    'http://2130706433:1234/v1',
    'http://0x7f000001:1234/v1',
    'http://localhost:01234/v1',
    'http://localhost:1234/v1?target=remote',
    'http://localhost:1234/v1#fragment',
    'http://localhost:1234/v1/../admin',
    'http://localhost:1234/v1/%2e%2e/admin',
    'http://localhost:1234\\@example.com/v1',
  ];

  for (const baseUrl of invalidUrls) {
    assert.equal(validateLoopbackBaseUrl(baseUrl).valid, false, baseUrl);
  }
});

test('settings normalization uses presets and never retains API credentials', () => {
  const normalized = normalizeLocalAiSettings({
    enabled: true,
    provider: 'ollama',
    baseUrl: 'http://127.0.0.1:11434/v1///',
    model: '  llama3.2  ',
    apiKey: 'must-not-persist',
    token: 'must-not-persist-either',
  });

  assert.deepEqual(normalized, {
    enabled: true,
    provider: 'ollama',
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: 'llama3.2',
  });
  assert.equal('apiKey' in normalized, false);
  assert.equal('token' in normalized, false);
});

test('connection testing rejects an unsafe endpoint before fetch', async () => {
  let fetchCalls = 0;
  const result = await testLocalAiConnection({
    settings: { baseUrl: 'http://10.0.0.4:11434/v1' },
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error('must not be called');
    },
  });

  assert.deepEqual(result, { ok: false, reason: 'invalid-base-url' });
  assert.equal(fetchCalls, 0);
});

test('connection testing requests models without credentials and returns model ids', async () => {
  const calls = [];
  const fetchImpl = async (...args) => {
    calls.push(args);
    return {
      ok: true,
      redirected: false,
      status: 200,
      json: async () => ({ data: [{ id: 'qwen2.5' }, { id: 'gemma3' }] }),
    };
  };

  const result = await testLocalAiConnection({ settings: LM_STUDIO_SETTINGS, fetchImpl });

  assert.deepEqual(result, { ok: true, models: ['qwen2.5', 'gemma3'] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'http://127.0.0.1:1234/v1/models');
  assert.equal(calls[0][1].method, 'GET');
  assert.equal(calls[0][1].credentials, 'omit');
  assert.equal(calls[0][1].redirect, 'error');
  assert.ok(calls[0][1].signal instanceof AbortSignal);
});

test('connection testing rejects redirects, non-OK responses, and malformed model payloads', async () => {
  const cases = [
    {
      name: 'redirect',
      response: { ok: true, redirected: true, status: 200, json: async () => ({ data: [] }) },
      want: { ok: false, reason: 'redirect-rejected' },
    },
    {
      name: 'http status',
      response: { ok: false, redirected: false, status: 503, json: async () => ({}) },
      want: { ok: false, reason: 'http-error', status: 503 },
    },
    {
      name: 'missing data array',
      response: { ok: true, redirected: false, status: 200, json: async () => ({ models: [] }) },
      want: { ok: false, reason: 'invalid-response' },
    },
    {
      name: 'invalid model entry',
      response: { ok: true, redirected: false, status: 200, json: async () => ({ data: [{ name: 'no-id' }] }) },
      want: { ok: false, reason: 'invalid-response' },
    },
  ];

  for (const item of cases) {
    const result = await testLocalAiConnection({
      settings: LM_STUDIO_SETTINGS,
      fetchImpl: async () => item.response,
    });
    assert.deepEqual(result, item.want, item.name);
  }
});

test('connection testing aborts on timeout', async () => {
  let observedAbort = false;
  const fetchImpl = async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => {
      observedAbort = true;
      reject(new DOMException('aborted', 'AbortError'));
    }, { once: true });
  });

  const result = await testLocalAiConnection({
    settings: LM_STUDIO_SETTINGS,
    fetchImpl,
    timeoutMs: 5,
  });

  assert.deepEqual(result, { ok: false, reason: 'timeout' });
  assert.equal(observedAbort, true);
});

test('connection testing respects caller cancellation', async () => {
  const controller = new AbortController();
  const fetchImpl = async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
  });
  const pending = testLocalAiConnection({
    settings: LM_STUDIO_SETTINGS,
    fetchImpl,
    signal: controller.signal,
    timeoutMs: 500,
  });
  controller.abort();

  assert.deepEqual(await pending, { ok: false, reason: 'aborted' });
});

test('model selection returns only an approved candidate id and sends minimal approved state', async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      redirected: false,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '{"moveId":"ask-origin"}' } }] }),
    };
  };
  const result = await selectApprovedMove({
    settings: LM_STUDIO_SETTINGS,
    candidateIds: ['ask-origin', 'ask-status'],
    state: {
      lessonId: 'part-1',
      scenarioId: 'meet-colleague',
      turnIndex: 1,
      supportLevel: 'intent-only',
      transcript: 'untrusted learner speech',
      privateNote: 'must not leave the browser',
    },
    fetchImpl,
  });

  assert.deepEqual(result, { ok: true, moveId: 'ask-origin' });
  assert.equal(request.url, 'http://127.0.0.1:1234/v1/chat/completions');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.credentials, 'omit');
  assert.equal(request.options.redirect, 'error');
  assert.equal(request.options.headers['Content-Type'], 'application/json');
  const body = JSON.parse(request.options.body);
  assert.equal(body.model, 'local-model');
  assert.equal(body.stream, false);
  assert.equal(body.temperature, 0);
  assert.deepEqual(JSON.parse(body.messages[1].content), {
    candidateIds: ['ask-origin', 'ask-status'],
    state: {
      lessonId: 'part-1',
      scenarioId: 'meet-colleague',
      turnIndex: 1,
      supportLevel: 'intent-only',
    },
  });
  assert.equal(request.options.body.includes('untrusted learner speech'), false);
  assert.equal(request.options.body.includes('must not leave the browser'), false);
});

test('model selection accepts an otherwise exact fenced JSON object', async () => {
  const result = await selectApprovedMove({
    settings: LM_STUDIO_SETTINGS,
    candidateIds: ['ask-origin'],
    state: {},
    fetchImpl: async () => ({
      ok: true,
      redirected: false,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '```json\n{"moveId":"ask-origin"}\n```' } }] }),
    }),
  });

  assert.deepEqual(result, { ok: true, moveId: 'ask-origin' });
});

test('invalid, malformed, or cross-scope model output returns a deterministic fallback marker', async () => {
  const invalidContents = [
    '{"moveId":"future-part"}',
    'Here is the answer: {"moveId":"ask-origin"}',
    '{"moveId":"ask-origin","explanation":"render me"}',
    '{"moveId":42}',
    '{not json}',
    '```json\n{"moveId":"ask-origin"}\n``` extra',
  ];

  for (const content of invalidContents) {
    const result = await selectApprovedMove({
      settings: LM_STUDIO_SETTINGS,
      candidateIds: ['ask-origin'],
      state: {},
      fetchImpl: async () => ({
        ok: true,
        redirected: false,
        status: 200,
        json: async () => ({ choices: [{ message: { content } }] }),
      }),
    });
    assert.deepEqual(result, { ok: false, reason: 'invalid-model-selection' }, content);
  }
});

test('model selection rejects unsafe settings and invalid candidate lists before fetch', async () => {
  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    throw new Error('must not be called');
  };
  const cases = [
    { settings: { baseUrl: 'http://192.168.1.8:11434/v1', model: 'x' }, candidateIds: ['safe'] },
    { settings: LM_STUDIO_SETTINGS, candidateIds: [] },
    { settings: LM_STUDIO_SETTINGS, candidateIds: ['safe', 'safe'] },
    { settings: LM_STUDIO_SETTINGS, candidateIds: ['safe', ''] },
  ];

  for (const item of cases) {
    const result = await selectApprovedMove({ ...item, state: {}, fetchImpl });
    assert.deepEqual(result, { ok: false, reason: 'invalid-request' });
  }
  assert.equal(fetchCalls, 0);
});

test('model selection handles redirects, HTTP errors, and malformed responses without exposing provider text', async () => {
  const cases = [
    {
      name: 'redirect',
      response: { ok: true, redirected: true, status: 200, json: async () => ({}) },
      want: { ok: false, reason: 'redirect-rejected' },
    },
    {
      name: 'http status',
      response: { ok: false, redirected: false, status: 500, json: async () => ({ error: 'secret server text' }) },
      want: { ok: false, reason: 'http-error', status: 500 },
    },
    {
      name: 'missing choices',
      response: { ok: true, redirected: false, status: 200, json: async () => ({ output: 'secret model text' }) },
      want: { ok: false, reason: 'invalid-model-selection' },
    },
    {
      name: 'invalid JSON body',
      response: { ok: true, redirected: false, status: 200, json: async () => { throw new SyntaxError('secret body'); } },
      want: { ok: false, reason: 'invalid-model-selection' },
    },
  ];

  for (const item of cases) {
    const result = await selectApprovedMove({
      settings: LM_STUDIO_SETTINGS,
      candidateIds: ['ask-origin'],
      state: {},
      fetchImpl: async () => item.response,
    });
    assert.deepEqual(result, item.want, item.name);
    assert.equal(JSON.stringify(result).includes('secret'), false, item.name);
  }
});

test('model selection aborts on timeout and caller cancellation', async () => {
  const hangingFetch = async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
  });
  const timedOut = await selectApprovedMove({
    settings: LM_STUDIO_SETTINGS,
    candidateIds: ['ask-origin'],
    state: {},
    fetchImpl: hangingFetch,
    timeoutMs: 5,
  });
  assert.deepEqual(timedOut, { ok: false, reason: 'timeout' });

  const controller = new AbortController();
  const pending = selectApprovedMove({
    settings: LM_STUDIO_SETTINGS,
    candidateIds: ['ask-origin'],
    state: {},
    fetchImpl: hangingFetch,
    signal: controller.signal,
    timeoutMs: 500,
  });
  controller.abort();
  assert.deepEqual(await pending, { ok: false, reason: 'aborted' });
});
