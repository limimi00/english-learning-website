/**
 * Small adapters around the browser Web Speech APIs.
 *
 * The browser objects are passed in rather than read at module load time so
 * this module remains safe to import in a non-browser test or fallback path.
 */

function globalValue(environment, name) {
  if (environment && environment[name] !== undefined) return environment[name];
  if (environment?.window && environment.window[name] !== undefined) return environment.window[name];
  return undefined;
}

function asCallback(callback) {
  return typeof callback === 'function' ? callback : () => {};
}

/**
 * Create a cancellable text-to-speech adapter.
 *
 * `text` is intentionally not generated or transformed here: callers are
 * responsible for validating learner-facing English before passing it in.
 */
export function createSpeechOutput(environment = {}) {
  const synthesis = globalValue(environment, 'speechSynthesis');
  const Utterance = globalValue(environment, 'SpeechSynthesisUtterance');
  const supported = Boolean(
    synthesis && typeof synthesis.cancel === 'function' && typeof synthesis.speak === 'function' &&
    typeof Utterance === 'function',
  );

  let generation = 0;
  let state = 'idle';

  function status() {
    return { supported, state: supported ? state : 'unsupported' };
  }

  function cancel() {
    generation += 1;
    if (!supported) return false;
    synthesis.cancel();
    state = 'idle';
    return true;
  }

  function speak(text, options = {}) {
    if (!supported || typeof text !== 'string' || !text.trim()) return false;

    const speechOptions = options && typeof options === 'object' ? options : {};

    // A new line supersedes every prior callback, including callbacks queued
    // by an implementation that does not synchronously honour cancel().
    generation += 1;
    const requestGeneration = generation;
    try {
      synthesis.cancel();
    } catch {
      state = 'idle';
      return false;
    }

    let utterance;
    try {
      utterance = new Utterance(text);
      utterance.rate = Number.isFinite(speechOptions.rate) ? speechOptions.rate : 1;
      utterance.lang = speechOptions.lang || 'en-US';
    } catch {
      state = 'idle';
      return false;
    }
    const onend = asCallback(speechOptions.onend);
    const onerror = asCallback(speechOptions.onerror);

    state = 'speaking';
    utterance.onend = (event) => {
      if (requestGeneration !== generation) return;
      state = 'idle';
      onend(event);
    };
    utterance.onerror = (event) => {
      if (requestGeneration !== generation) return;
      state = 'idle';
      onerror(event);
    };
    try {
      synthesis.speak(utterance);
    } catch {
      state = 'idle';
      return false;
    }
    return true;
  }

  return { supported, status, speak, cancel };
}

const RECOGNITION_ERROR_CODES = {
  'not-allowed': 'permission-denied',
  'service-not-allowed': 'permission-denied',
  network: 'network-error',
  'no-speech': 'no-speech',
  'audio-capture': 'audio-capture',
  aborted: 'aborted',
  interrupted: 'interrupted',
  'language-not-supported': 'language-not-supported',
};

function recognitionError(error) {
  const nativeCode = typeof error === 'string' ? error : error?.error || error?.name;
  return {
    code: RECOGNITION_ERROR_CODES[nativeCode] || 'recognition-error',
    learnerFault: false,
  };
}

function finalTranscript(event) {
  const results = event?.results;
  if (!results || typeof results.length !== 'number') return null;

  let sawFinal = false;
  let transcript = '';
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    if (!result?.isFinal) continue;
    sawFinal = true;
    const firstAlternative = result[0];
    if (firstAlternative?.transcript) transcript += firstAlternative.transcript;
  }
  return sawFinal ? transcript.trim() : null;
}

/**
 * Create an opt-in browser speech-recognition adapter.
 *
 * Recognition is constructed and started only from `start()`. Every start has
 * an identity, so callbacks from a stopped or superseded recognizer cannot
 * affect the active turn.
 */
export function createSpeechInput(environment = {}) {
  const standardRecognition = globalValue(environment, 'SpeechRecognition');
  const webkitRecognition = globalValue(environment, 'webkitSpeechRecognition');
  const Recognition = typeof standardRecognition === 'function'
    ? standardRecognition
    : typeof webkitRecognition === 'function' ? webkitRecognition : undefined;
  const supported = typeof Recognition === 'function';

  if (!supported) {
    const status = () => ({ supported: false, state: 'manual' });
    return {
      supported: false,
      status,
      start: () => false,
      stop: () => false,
      abort: () => false,
    };
  }

  let active = null;
  let terminal = null;
  let state = 'idle';
  let lastCode;

  function status() {
    const current = { supported: true, state };
    if (lastCode) current.code = lastCode;
    return current;
  }

  function deactivate(record, method) {
    if (active !== record) return false;
    // Invalidate before calling the browser API: stop/abort can synchronously
    // dispatch result, error, or end in some implementations.
    active = null;
    terminal = null;
    state = 'idle';
    const nativeMethod = typeof record.recognition?.[method] === 'function'
      ? method
      : method === 'stop' ? 'abort' : 'stop';
    if (typeof record.recognition?.[nativeMethod] === 'function') {
      try {
        record.recognition[nativeMethod]();
      } catch {
        // The native object may already have ended; stop remains idempotent.
      }
    }
    return true;
  }

  function stop() {
    return active ? deactivate(active, 'stop') : false;
  }

  function abort() {
    return active ? deactivate(active, 'abort') : false;
  }

  function start(options = {}) {
    // Starting a new turn is also an explicit cancellation of the old turn.
    if (active) abort();
    terminal = null;

    const startOptions = options && typeof options === 'object' ? options : {};

    let recognition;
    try {
      recognition = new Recognition();
    } catch {
      state = 'manual';
      lastCode = 'recognition-error';
      return false;
    }

    const record = {
      recognition,
      finalEmitted: false,
      errorEmitted: false,
    };
    active = record;
    state = 'listening';
    lastCode = undefined;

    recognition.lang = startOptions.lang || 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      if (active !== record || record.finalEmitted) return;
      const transcript = finalTranscript(event);
      if (transcript === null || !transcript) return;
      record.finalEmitted = true;
      if (typeof startOptions.onResult === 'function') startOptions.onResult(transcript);
    };
    recognition.onerror = (event) => {
      if (active !== record && terminal !== record || record.errorEmitted) return;
      record.errorEmitted = true;
      const mapped = recognitionError(event);
      lastCode = mapped.code;
      state = 'manual';
      if (typeof startOptions.onError === 'function') startOptions.onError(mapped);
    };
    recognition.onend = (event) => {
      if (active !== record) return;
      active = null;
      terminal = record;
      if (!lastCode) state = 'idle';
      if (typeof startOptions.onEnd === 'function') startOptions.onEnd(event);
    };

    try {
      recognition.start();
    } catch (error) {
      // A synchronous permission/service failure follows the same fallback
      // contract as an asynchronous `onerror` event.
      if (active === record) {
        active = null;
        const mapped = recognitionError(error);
        lastCode = mapped.code;
        state = 'manual';
        if (typeof startOptions.onError === 'function') startOptions.onError(mapped);
      }
      return false;
    }
    return true;
  }

  return { supported: true, status, start, stop, abort };
}
