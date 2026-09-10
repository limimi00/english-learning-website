import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechInput, createSpeechOutput } from '../assets/js/voice.js';

test('speech output reports unsupported without synthesis globals', () => {
  const output = createSpeechOutput({});
  assert.equal(output.supported, false);
  assert.deepEqual(output.status(), { supported: false, state: 'unsupported' });
  assert.equal(output.speak('I am busy.'), false);
});

test('speech output cancels stale speech before a new validated line', () => {
  let cancelled = 0;
  const spoken = [];
  class FakeUtterance { constructor(text) { this.text = text; } }
  const output = createSpeechOutput({
    speechSynthesis: { cancel: () => { cancelled += 1; }, speak: (item) => spoken.push(item.text) },
    SpeechSynthesisUtterance: FakeUtterance,
  });
  assert.equal(output.speak('I am busy.', { rate: 0.82 }), true);
  assert.equal(cancelled, 1);
  assert.deepEqual(spoken, ['I am busy.']);
});

test('speech output applies rate and language and exposes explicit cancellation', () => {
  let cancelled = 0;
  let utterance;
  class FakeUtterance { constructor(text) { this.text = text; } }
  const output = createSpeechOutput({
    speechSynthesis: { cancel: () => { cancelled += 1; }, speak: (item) => { utterance = item; } },
    SpeechSynthesisUtterance: FakeUtterance,
  });

  output.speak('Where are you from?', { rate: 0.7, lang: 'en-GB' });
  assert.equal(utterance.rate, 0.7);
  assert.equal(utterance.lang, 'en-GB');
  output.cancel();
  output.cancel();
  assert.equal(cancelled, 3);
  assert.deepEqual(output.status(), { supported: true, state: 'idle' });
});

test('speech output ignores callbacks from cancelled or superseded utterances', () => {
  const utterances = [];
  const events = [];
  class FakeUtterance { constructor(text) { this.text = text; utterances.push(this); } }
  const output = createSpeechOutput({
    speechSynthesis: { cancel() {}, speak() {} },
    SpeechSynthesisUtterance: FakeUtterance,
  });

  output.speak('first', { onend: () => events.push('first-end'), onerror: () => events.push('first-error') });
  output.speak('second', { onend: () => events.push('second-end'), onerror: () => events.push('second-error') });
  utterances[0].onend?.();
  utterances[0].onerror?.({ error: 'interrupted' });
  utterances[1].onend?.();
  assert.deepEqual(events, ['second-end']);
  assert.deepEqual(output.status(), { supported: true, state: 'idle' });
});

test('speech input reports a manual fallback when recognition is unavailable', () => {
  const input = createSpeechInput({});
  assert.deepEqual(input.status(), { supported: false, state: 'manual' });
  assert.equal(input.start(), false);
  assert.equal(input.stop(), false);
});

class FakeRecognition {
  static instances = [];

  constructor() {
    this.started = 0;
    this.stopped = 0;
    this.aborted = 0;
    FakeRecognition.instances.push(this);
  }

  start() { this.started += 1; }
  stop() { this.stopped += 1; }
  abort() { this.aborted += 1; }
}

function finalResult(...transcripts) {
  return {
    results: transcripts.map((transcript) => Object.assign([{ transcript }], { isFinal: true })),
  };
}

test('speech input starts only on demand and emits one final transcript', () => {
  FakeRecognition.instances = [];
  const input = createSpeechInput({ SpeechRecognition: FakeRecognition });
  assert.deepEqual(input.status(), { supported: true, state: 'idle' });
  assert.equal(FakeRecognition.instances.length, 0);

  const transcripts = [];
  assert.equal(input.start({ lang: 'en-GB', onResult: (text) => transcripts.push(text) }), true);
  const recognition = FakeRecognition.instances[0];
  assert.equal(recognition.started, 1);
  assert.equal(recognition.lang, 'en-GB');
  assert.equal(recognition.interimResults, true);
  assert.equal(recognition.continuous, false);

  recognition.onresult?.({ results: [Object.assign([{ transcript: 'I am' }], { isFinal: false })] });
  recognition.onresult?.(finalResult('I am busy.'));
  recognition.onresult?.(finalResult('stale second result'));
  assert.deepEqual(transcripts, ['I am busy.']);
});

test('speech input maps permission denial to a stable non-learner-fault code', () => {
  FakeRecognition.instances = [];
  const errors = [];
  const input = createSpeechInput({ SpeechRecognition: FakeRecognition });
  input.start({ onError: (error) => errors.push(error) });
  const recognition = FakeRecognition.instances[0];
  recognition.onerror?.({ error: 'not-allowed' });
  assert.deepEqual(errors, [{ code: 'permission-denied', learnerFault: false }]);
  assert.deepEqual(input.status(), { supported: true, state: 'manual', code: 'permission-denied' });
});

test('speech input maps service denial and technical errors without learner-fault results', () => {
  const cases = [
    ['service-not-allowed', 'permission-denied'],
    ['network', 'network-error'],
    ['no-speech', 'no-speech'],
    ['audio-capture', 'audio-capture'],
  ];

  for (const [nativeCode, expectedCode] of cases) {
    FakeRecognition.instances = [];
    const errors = [];
    const input = createSpeechInput({ SpeechRecognition: FakeRecognition });
    input.start({ onError: (error) => errors.push(error) });
    FakeRecognition.instances[0].onerror?.({ error: nativeCode });
    assert.deepEqual(errors, [{ code: expectedCode, learnerFault: false }], nativeCode);
  }
});

test('speech input stop and abort are idempotent and suppress stale callbacks', () => {
  FakeRecognition.instances = [];
  const events = [];
  const input = createSpeechInput({ SpeechRecognition: FakeRecognition });
  input.start({
    onResult: (text) => events.push(`result:${text}`),
    onEnd: () => events.push('end'),
  });
  const first = FakeRecognition.instances[0];
  assert.equal(input.stop(), true);
  assert.equal(input.stop(), false);
  assert.equal(input.abort(), false);
  assert.equal(first.stopped, 1);
  assert.equal(first.aborted, 0);
  first.onresult?.(finalResult('stale after stop'));
  first.onend?.();
  assert.deepEqual(events, []);

  input.start({ onEnd: () => events.push('second-end') });
  const second = FakeRecognition.instances[1];
  second.onend?.();
  second.onend?.();
  assert.deepEqual(events, ['second-end']);
  assert.deepEqual(input.status(), { supported: true, state: 'idle' });
});

test('speech input handles end and error in either order once per start', () => {
  FakeRecognition.instances = [];
  const events = [];
  const input = createSpeechInput({ SpeechRecognition: FakeRecognition });
  input.start({ onError: (error) => events.push(`error:${error.code}`), onEnd: () => events.push('end') });
  const recognition = FakeRecognition.instances[0];
  recognition.onend?.();
  recognition.onerror?.({ error: 'network' });
  recognition.onend?.();
  assert.deepEqual(events, ['end']);

  input.start({ onError: (error) => events.push(`error:${error.code}`), onEnd: () => events.push('end-2') });
  const second = FakeRecognition.instances[1];
  second.onerror?.({ error: 'no-speech' });
  second.onend?.();
  assert.deepEqual(events, ['end', 'error:no-speech', 'end-2']);
});
