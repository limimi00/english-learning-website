const DEFAULT_TIMEOUT_MS = 4_000;
const MAX_CANDIDATE_IDS = 64;
const MAX_CANDIDATE_ID_LENGTH = 128;
const MAX_MODEL_CONTENT_LENGTH = 2_048;

export const LOCAL_AI_PRESETS = Object.freeze({
  ollama: Object.freeze({
    provider: 'ollama',
    baseUrl: 'http://127.0.0.1:11434/v1',
  }),
  lmstudio: Object.freeze({
    provider: 'lmstudio',
    baseUrl: 'http://127.0.0.1:1234/v1',
  }),
});

const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function validateLoopbackBaseUrl(value) {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    return { valid: false, reason: 'invalid-base-url' };
  }
  if (/\s|\\|[\u0000-\u001f\u007f]/u.test(value)) {
    return { valid: false, reason: 'invalid-base-url' };
  }

  const match = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):([1-9][0-9]{0,4})(\/[^?#]*)?$/iu.exec(value);
  if (!match) return { valid: false, reason: 'invalid-base-url' };

  const [, rawHost, rawPort, rawPath = ''] = match;
  const port = Number(rawPort);
  if (port > 65_535 || (rawPort.length > 1 && rawPort.startsWith('0'))) {
    return { valid: false, reason: 'invalid-base-url' };
  }

  const pathWithoutTrailingSlashes = rawPath.replace(/\/+$/u, '');
  if (pathWithoutTrailingSlashes.includes('//')) {
    return { valid: false, reason: 'invalid-base-url' };
  }
  try {
    for (const segment of rawPath.split('/')) {
      const decoded = decodeURIComponent(segment);
      if (decoded === '.' || decoded === '..' || decoded.includes('/') || decoded.includes('\\')) {
        return { valid: false, reason: 'invalid-base-url' };
      }
    }
  } catch {
    return { valid: false, reason: 'invalid-base-url' };
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return { valid: false, reason: 'invalid-base-url' };
  }
  const host = rawHost.toLowerCase();
  if (
    parsed.protocol !== 'http:'
    || !ALLOWED_HOSTS.has(host)
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
  ) {
    return { valid: false, reason: 'invalid-base-url' };
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/u, '');
  return {
    valid: true,
    baseUrl: `http://${host}:${rawPort}${normalizedPath}`,
  };
}

export function normalizeLocalAiSettings(settings = {}) {
  const requestedProvider = typeof settings.provider === 'string' ? settings.provider.toLowerCase() : '';
  const provider = Object.hasOwn(LOCAL_AI_PRESETS, requestedProvider) ? requestedProvider : 'custom';
  const presetUrl = LOCAL_AI_PRESETS[provider]?.baseUrl || '';
  const requestedUrl = typeof settings.baseUrl === 'string' && settings.baseUrl.length > 0
    ? settings.baseUrl
    : presetUrl;
  const validation = validateLoopbackBaseUrl(requestedUrl);

  return {
    enabled: settings.enabled === true,
    provider,
    baseUrl: validation.valid ? validation.baseUrl : '',
    model: typeof settings.model === 'string' ? settings.model.trim() : '',
  };
}

function timeoutDuration(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_TIMEOUT_MS;
}

async function fetchWithCancellation(url, options, { fetchImpl, signal, timeoutMs }) {
  if (typeof fetchImpl !== 'function') {
    return { ok: false, reason: 'unavailable' };
  }
  if (signal?.aborted) return { ok: false, reason: 'aborted' };

  const controller = new AbortController();
  let timedOut = false;
  let callerAborted = false;
  let rejectCancellation;
  const cancellation = new Promise((_resolve, reject) => {
    rejectCancellation = reject;
  });
  const cancel = (reason) => {
    if (controller.signal.aborted) return;
    timedOut = reason === 'timeout';
    callerAborted = reason === 'aborted';
    controller.abort();
    rejectCancellation(new Error(reason));
  };
  const onCallerAbort = () => cancel('aborted');
  signal?.addEventListener('abort', onCallerAbort, { once: true });
  const timer = setTimeout(() => cancel('timeout'), timeoutDuration(timeoutMs));

  try {
    const response = await Promise.race([
      Promise.resolve().then(() => fetchImpl(url, { ...options, signal: controller.signal })),
      cancellation,
    ]);
    return { ok: true, response };
  } catch {
    if (timedOut) return { ok: false, reason: 'timeout' };
    if (callerAborted || signal?.aborted) return { ok: false, reason: 'aborted' };
    return { ok: false, reason: 'unavailable' };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }
}

function rejectResponse(response) {
  if (!response || response.redirected === true) {
    return response?.redirected === true
      ? { ok: false, reason: 'redirect-rejected' }
      : { ok: false, reason: 'invalid-response' };
  }
  if (!response.ok) {
    return { ok: false, reason: 'http-error', status: response.status };
  }
  return null;
}

export async function testLocalAiConnection({
  settings = {},
  fetchImpl = globalThis.fetch,
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const validation = validateLoopbackBaseUrl(settings.baseUrl);
  if (!validation.valid) return { ok: false, reason: 'invalid-base-url' };

  const request = await fetchWithCancellation(
    `${validation.baseUrl}/models`,
    {
      method: 'GET',
      credentials: 'omit',
      redirect: 'error',
      headers: { Accept: 'application/json' },
    },
    { fetchImpl, signal, timeoutMs },
  );
  if (!request.ok) return request;

  const rejected = rejectResponse(request.response);
  if (rejected) return rejected;
  try {
    const payload = await request.response.json();
    if (
      !payload
      || !Array.isArray(payload.data)
      || payload.data.some((item) => !item || typeof item.id !== 'string' || item.id.length === 0)
    ) {
      return { ok: false, reason: 'invalid-response' };
    }
    return { ok: true, models: payload.data.map((item) => item.id) };
  } catch {
    return { ok: false, reason: 'invalid-response' };
  }
}

function validCandidateIds(candidateIds) {
  return (
    Array.isArray(candidateIds)
    && candidateIds.length > 0
    && candidateIds.length <= MAX_CANDIDATE_IDS
    && candidateIds.every((id) => (
      typeof id === 'string'
      && id.length > 0
      && id.length <= MAX_CANDIDATE_ID_LENGTH
    ))
    && new Set(candidateIds).size === candidateIds.length
  );
}

function minimalState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return {};
  const result = {};
  for (const key of ['lessonId', 'scenarioId', 'supportLevel']) {
    if (typeof state[key] === 'string') result[key] = state[key];
  }
  if (Number.isInteger(state.turnIndex) && state.turnIndex >= 0) {
    result.turnIndex = state.turnIndex;
  }
  return result;
}

function parseModelSelection(content, candidateIds) {
  if (typeof content !== 'string' || content.length > MAX_MODEL_CONTENT_LENGTH) return null;
  const trimmed = content.trim();
  const fenced = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/iu.exec(trimmed);
  const source = fenced ? fenced[1].trim() : trimmed;
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    return null;
  }
  if (
    !parsed
    || typeof parsed !== 'object'
    || Array.isArray(parsed)
    || Object.keys(parsed).length !== 1
    || typeof parsed.moveId !== 'string'
    || !candidateIds.includes(parsed.moveId)
  ) {
    return null;
  }
  return parsed.moveId;
}

export async function selectApprovedMove({
  settings = {},
  candidateIds,
  state = {},
  fetchImpl = globalThis.fetch,
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const validation = validateLoopbackBaseUrl(settings.baseUrl);
  if (!validation.valid || typeof settings.model !== 'string' || !settings.model.trim() || !validCandidateIds(candidateIds)) {
    return { ok: false, reason: 'invalid-request' };
  }

  const body = {
    model: settings.model.trim(),
    stream: false,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'Return one JSON object with exactly one moveId chosen from candidateIds. Do not add prose.',
      },
      {
        role: 'user',
        content: JSON.stringify({ candidateIds: [...candidateIds], state: minimalState(state) }),
      },
    ],
  };
  const request = await fetchWithCancellation(
    `${validation.baseUrl}/chat/completions`,
    {
      method: 'POST',
      credentials: 'omit',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    { fetchImpl, signal, timeoutMs },
  );
  if (!request.ok) return request;

  const rejected = rejectResponse(request.response);
  if (rejected) return rejected;
  try {
    const payload = await request.response.json();
    const content = payload?.choices?.[0]?.message?.content;
    const moveId = parseModelSelection(content, candidateIds);
    return moveId
      ? { ok: true, moveId }
      : { ok: false, reason: 'invalid-model-selection' };
  } catch {
    return { ok: false, reason: 'invalid-model-selection' };
  }
}
