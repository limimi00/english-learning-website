# Interactive Speaking Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing static English-learning site into a zero-beginner, three-pass interactive speaking coach that works without AI and optionally adapts through a safe local model connection.

**Architecture:** Keep the GitHub Pages application dependency-free and browser-only. Add pure modules for lesson whitelists, validated dialogue packs, speaking-session state, optional loopback AI selection, and browser voice capabilities; keep `app.js` responsible for orchestration and rendering. The model can select only pre-approved IDs, while deterministic client validation remains the content boundary.

**Tech Stack:** Browser ES modules, HTML, CSS, Web Speech APIs, `fetch`, `localStorage`, Node built-in test runner, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-10-interactive-speaking-coach-design.md`

## Global Constraints

- Part 1 is the default learning scope.
- Main practice uses only English found in the active Part's courseware fields.
- Previous Parts appear only in review; future-Part English never appears in the active lesson.
- Every scenario supports `listen`, `role-a`, and `role-b` passes.
- The site remains fully usable with AI, speech recognition, or speech synthesis unavailable.
- AI output never becomes visible or audible until deterministic validation passes.
- Local AI configuration accepts loopback hosts only and stores no remote API key.
- Existing learner word progress remains intact and does not count as speaking mastery.
- No new runtime dependency, bundler, server, account system, or cloud database.
- All UI remains responsive, keyboard-operable, and usable at 200% zoom.

## File Structure

- Create `data/dialogues.js`: six versioned dialogue packs, three or more scenarios per Part, canonical English lines, Chinese intentions, and source metadata.
- Create `assets/js/dialogue-engine.js`: whitelist extraction, tokenization, content validation, dialogue validation, deterministic variant choice, speaking-session transitions, and speaking review scheduling.
- Create `assets/js/local-ai.js`: Ollama/LM Studio loopback presets, URL validation, connection tests, request construction, response parsing, and approved-ID validation.
- Create `assets/js/voice.js`: browser speech synthesis and optional browser speech-recognition lifecycle behind small interfaces.
- Modify `assets/js/app.js`: navigation, settings, Today screen, dialogue catalog, speaking screen, progress orchestration, local-AI enhancement, and fallbacks.
- Modify `assets/css/style.css`: selected two-column conversation design, coach rail, voice bar, settings, status states, mobile stacking, and accessibility states.
- Modify `index.html`: new navigation labels, dedicated status live region, and removal of whole-app live announcements.
- Create `tests/dialogue-engine.test.mjs`: whitelist, dialogue, session, and speaking-progress tests.
- Create `tests/local-ai.test.mjs`: settings, URL safety, connection, response, and fallback tests.
- Create `tests/voice.test.mjs`: capability detection and cancellation behavior with injected fakes.
- Modify `tests/ui-static.test.mjs`: source-level assertions for primary speaking UI, Settings, accessibility, and cancellation.

---

### Task 1: Per-Part Courseware Whitelists

**Files:**
- Create: `assets/js/dialogue-engine.js`
- Create: `tests/dialogue-engine.test.mjs`

**Interfaces:**
- Consumes: `lessons` entries from `data/lessons.js`.
- Produces: `tokenizeCourseEnglish(text)`, `buildLessonWhitelist(lesson)`, `buildLessonWhitelists(lessons)`, and `validateTextAgainstWhitelist(text, whitelist)`.

- [ ] **Step 1: Write failing tokenizer and isolation tests**

Create `tests/dialogue-engine.test.mjs` with tests that prove punctuation/case normalization and strict Part isolation:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { lessons } from '../data/lessons.js';
import {
  buildLessonWhitelist,
  buildLessonWhitelists,
  tokenizeCourseEnglish,
  validateTextAgainstWhitelist,
} from '../assets/js/dialogue-engine.js';

test('tokenizeCourseEnglish normalizes course punctuation without inventing variants', () => {
  assert.deepEqual(tokenizeCourseEnglish("  That’s why.  I am OK! "), ["that's", 'why', 'i', 'am', 'ok']);
  assert.deepEqual(tokenizeCourseEnglish('grey / gray'), ['gray', 'gray']);
});

test('buildLessonWhitelists keeps future Part tokens out of Part 1', () => {
  const byLesson = buildLessonWhitelists(lessons);
  assert.equal(byLesson.get('part-1').tokens.has('teacher'), true);
  assert.equal(byLesson.get('part-1').tokens.has('yesterday'), false);
  assert.equal(byLesson.get('part-4').tokens.has('yesterday'), true);
});

test('whitelist includes English from every approved field in one lesson', () => {
  const whitelist = buildLessonWhitelist(lessons[0]);
  assert.equal(whitelist.tokens.has('where'), true);
  assert.equal(whitelist.tokens.has('from'), true);
  assert.equal(whitelist.tokens.has('teacher'), true);
});

test('validation reports an exact unknown token', () => {
  const whitelist = buildLessonWhitelist(lessons[0]);
  assert.deepEqual(validateTextAgainstWhitelist('I was busy.', whitelist), {
    valid: false,
    tokens: ['i', 'was', 'busy'],
    invalidTokens: ['was'],
  });
});
```

- [ ] **Step 2: Run the test and verify the module is missing**

Run: `node --test tests/dialogue-engine.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `dialogue-engine.js`.

- [ ] **Step 3: Implement whitelist extraction and validation**

Implement the new module with explicit field extraction:

```js
const SPELLING_VARIANTS = new Map([
  ['centre', 'center'],
  ['grey', 'gray'],
]);

export function tokenizeCourseEnglish(value) {
  return String(value || '')
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .match(/[a-z]+(?:'[a-z]+)?|\d+(?::\d+)?/g)?.map((token) => SPELLING_VARIANTS.get(token) || token) || [];
}

function lessonEnglishStrings(lesson) {
  return [
    ...(lesson.vocabulary || []).map((item) => item.en),
    ...(lesson.grammar || []).flatMap((item) => item.patterns || []),
    ...(lesson.sentences || []),
    ...(lesson.fillBlanks || []).flatMap((item) => [item.q, item.a]),
    ...(lesson.translations || []).map((item) => item.en),
    ...(lesson.questions || []),
  ].filter(Boolean);
}

export function buildLessonWhitelist(lesson) {
  const sourceStrings = lessonEnglishStrings(lesson);
  return {
    lessonId: lesson.id,
    version: 1,
    sourceStrings,
    tokens: new Set(sourceStrings.flatMap(tokenizeCourseEnglish)),
  };
}

export function buildLessonWhitelists(lessons) {
  return new Map(lessons.map((lesson) => [lesson.id, buildLessonWhitelist(lesson)]));
}

export function validateTextAgainstWhitelist(text, whitelist) {
  const tokens = tokenizeCourseEnglish(text);
  const invalidTokens = [...new Set(tokens.filter((token) => !whitelist.tokens.has(token)))];
  return { valid: invalidTokens.length === 0, tokens, invalidTokens };
}
```

- [ ] **Step 4: Run the whitelist tests**

Run: `node --test tests/dialogue-engine.test.mjs`

Expected: all four tests PASS.

- [ ] **Step 5: Commit the whitelist boundary**

```bash
git add assets/js/dialogue-engine.js tests/dialogue-engine.test.mjs
git commit -m "Add lesson dialogue whitelists"
```

---

### Task 2: Validated Dialogue Packs for All Six Parts

**Files:**
- Create: `data/dialogues.js`
- Modify: `assets/js/dialogue-engine.js`
- Modify: `tests/dialogue-engine.test.mjs`

**Interfaces:**
- Consumes: `buildLessonWhitelists(lessons)`.
- Produces: `dialoguePacks`, `validateDialoguePack(pack, whitelist)`, `validateDialoguePacks(packs, whitelists)`, and `getDialoguePack(lessonId)`.

- [ ] **Step 1: Write failing structure and full-corpus tests**

Add tests:

```js
import { dialoguePacks } from '../data/dialogues.js';
import { validateDialoguePacks } from '../assets/js/dialogue-engine.js';

test('every Part has at least three fallback scenarios of four to six turns', () => {
  assert.deepEqual(dialoguePacks.map((pack) => pack.lessonId), lessons.map((lesson) => lesson.id));
  dialoguePacks.forEach((pack) => {
    assert.ok(pack.scenarios.length >= 3);
    pack.scenarios.forEach((scenario) => {
      assert.ok(scenario.turns.length >= 4 && scenario.turns.length <= 6);
      assert.ok(scenario.turns.every((turn) => ['A', 'B'].includes(turn.role)));
      assert.ok(scenario.turns.every((turn) => turn.en && turn.cn && turn.intentCn));
    });
  });
});

test('every bundled English line stays inside its own Part whitelist', () => {
  const result = validateDialoguePacks(dialoguePacks, buildLessonWhitelists(lessons));
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
});

test('dialogue validation reports cross-Part English with scenario and turn ids', () => {
  const badPack = structuredClone(dialoguePacks[0]);
  badPack.scenarios[0].turns[0].en = 'I was busy.';
  const result = validateDialoguePacks([badPack], buildLessonWhitelists(lessons));
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors[0].invalidTokens, ['was']);
  assert.equal(result.errors[0].lessonId, 'part-1');
});
```

- [ ] **Step 2: Run the tests and verify missing exports**

Run: `node --test tests/dialogue-engine.test.mjs`

Expected: FAIL because `dialogues.js` and validation helpers do not exist.

- [ ] **Step 3: Add the versioned dialogue schema and content**

Create six packs with `version: 1`. Every turn has `id`, alternating `role`, canonical `en`, `cn`, `intentCn`, `patternId`, and `variantIds`. Every variant resolves to a canonical line already validated for that Part.

Create at least these scenarios:

| Part | Scenario IDs and Chinese titles |
|---|---|
| part-1 | `meet-colleague` 认识同事; `feelings` 询问状态; `objects-colors` 物品和颜色 |
| part-2 | `breakfast` 早餐; `daily-routine` 日常作息; `home-work` 居住和工作 |
| part-3 | `ability` 能力; `ask-help` 请求帮助; `permission` 请求许可 |
| part-4 | `last-night` 昨晚状态; `yesterday` 昨天; `free-time` 兴趣爱好 |
| part-5 | `last-weekend` 上周末; `travel` 旅行经历; `past-actions` 过去发生的事 |
| part-6 | `hotel-room` 酒店房间; `home-items` 家中物品; `past-place` 过去的场所 |

For each scenario, begin with exact courseware questions/patterns where possible and construct any variation only from that Part's approved tokens and grammar. Do not use `Hello`, invented personal names, or a future tense merely because they appeared in a visual mock. The corpus test is the release gate.

- [ ] **Step 4: Implement corpus validation**

Add `validateDialoguePack` and `validateDialoguePacks`. Report `lessonId`, `scenarioId`, `turnId`, `invalidTokens`, and `code: 'unknown_token'`. Also reject duplicate IDs, missing fields, non-alternating roles, and turn counts outside 4–6 using `code: 'invalid_dialogue_shape'`.

- [ ] **Step 5: Run the corpus tests**

Run: `node --test tests/dialogue-engine.test.mjs`

Expected: all tests PASS and the error list for the real 18-scenario corpus is empty.

- [ ] **Step 6: Commit the validated content**

```bash
git add data/dialogues.js assets/js/dialogue-engine.js tests/dialogue-engine.test.mjs
git commit -m "Add validated speaking scenarios"
```

---

### Task 3: Three-Pass Speaking Session and Progress

**Files:**
- Modify: `assets/js/dialogue-engine.js`
- Modify: `tests/dialogue-engine.test.mjs`

**Interfaces:**
- Consumes: one validated scenario.
- Produces: `createSpeakingSession`, `currentSpeakingTurn`, `advanceSpeakingSession`, `recordSpeakingAttempt`, `buildSpeakingReviewQueue`, and `nextSpeakingReviewDate`.

- [ ] **Step 1: Write failing state-transition tests**

Add tests proving:

```js
test('speaking session advances listen to role A to role B to complete', () => {
  const scenario = dialoguePacks[0].scenarios[0];
  let session = createSpeakingSession(scenario, { lessonId: 'part-1', now: '2026-09-10' });
  assert.equal(session.pass, 'listen');
  for (let i = 0; i < scenario.turns.length; i += 1) session = advanceSpeakingSession(session, scenario);
  assert.equal(session.pass, 'role-a');
  assert.equal(session.turnIndex, 0);
  for (let i = 0; i < scenario.turns.length; i += 1) session = advanceSpeakingSession(session, scenario);
  assert.equal(session.pass, 'role-b');
  for (let i = 0; i < scenario.turns.length; i += 1) session = advanceSpeakingSession(session, scenario);
  assert.equal(session.pass, 'complete');
});

test('currentSpeakingTurn says whether the learner or system owns the turn', () => {
  const scenario = dialoguePacks[0].scenarios[0];
  const session = { pass: 'role-a', turnIndex: 0 };
  assert.equal(currentSpeakingTurn(session, scenario).learnerTurn, scenario.turns[0].role === 'A');
});

test('technical voice failure is not recorded as an incorrect attempt', () => {
  const progress = recordSpeakingAttempt({}, {
    lessonId: 'part-1', scenarioId: 'meet-colleague', turnId: 'turn-1',
    skill: 'guided-produce', result: 'technical-fallback', supportUsed: true,
    date: '2026-09-10',
  });
  assert.equal(progress['part-1:meet-colleague:turn-1'].wrongCount, 0);
});
```

- [ ] **Step 2: Run tests and verify missing functions**

Run: `node --test tests/dialogue-engine.test.mjs`

Expected: FAIL on the first missing speaking-session export.

- [ ] **Step 3: Implement immutable session transitions**

Use the pass order `['listen', 'role-a', 'role-b', 'complete']`. `advanceSpeakingSession` returns a new object, ignores advancement after `complete`, and never mutates the scenario. `currentSpeakingTurn` sets `learnerTurn` from the active role and pass.

- [ ] **Step 4: Implement speaking evidence and 1/3/7-day review**

Store evidence separately for `listen`, `repeat`, `guided-produce`, and `independent-produce`. `technical-fallback` and `skipped` do not increment `wrongCount`; revealing the full answer marks `supportUsed: true`. Use the existing date-key convention and review intervals without merging word and speaking mastery.

- [ ] **Step 5: Run engine tests**

Run: `node --test tests/dialogue-engine.test.mjs`

Expected: all session, progress, whitelist, and content tests PASS.

- [ ] **Step 6: Commit speaking state**

```bash
git add assets/js/dialogue-engine.js tests/dialogue-engine.test.mjs
git commit -m "Add speaking session progression"
```

---

### Task 4: Safe Loopback Local-AI Adapter

**Files:**
- Create: `assets/js/local-ai.js`
- Create: `tests/local-ai.test.mjs`

**Interfaces:**
- Consumes: provider settings and a list of approved candidate move IDs.
- Produces: `LOCAL_AI_PRESETS`, `normalizeLocalAiSettings`, `validateLoopbackBaseUrl`, `testLocalAiConnection`, and `selectApprovedMove`.

- [ ] **Step 1: Write failing safety and parsing tests**

Cover exact presets and unsafe endpoints:

```js
test('presets use loopback OpenAI-compatible endpoints', () => {
  assert.equal(LOCAL_AI_PRESETS.ollama.baseUrl, 'http://127.0.0.1:11434/v1');
  assert.equal(LOCAL_AI_PRESETS.lmstudio.baseUrl, 'http://127.0.0.1:1234/v1');
});

test('URL validation accepts loopback and rejects remote or credentialed URLs', () => {
  assert.equal(validateLoopbackBaseUrl('http://127.0.0.1:11434/v1').valid, true);
  assert.equal(validateLoopbackBaseUrl('http://localhost:1234/v1').valid, true);
  assert.equal(validateLoopbackBaseUrl('http://192.168.1.2:11434/v1').valid, false);
  assert.equal(validateLoopbackBaseUrl('https://example.com/v1').valid, false);
  assert.equal(validateLoopbackBaseUrl('http://user:pass@localhost:1234/v1').valid, false);
});

test('model selection returns only an approved candidate id', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: '{"moveId":"ask-origin"}' } }] }),
  });
  const result = await selectApprovedMove({
    settings: { baseUrl: 'http://127.0.0.1:1234/v1', model: 'local-model' },
    candidateIds: ['ask-origin', 'ask-status'],
    state: { lessonId: 'part-1', turnIndex: 1 },
    fetchImpl,
  });
  assert.equal(result.moveId, 'ask-origin');
});

test('invalid or cross-scope model output returns a deterministic fallback marker', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: '{"moveId":"future-part"}' } }] }),
  });
  const result = await selectApprovedMove({
    settings: { baseUrl: 'http://127.0.0.1:1234/v1', model: 'local-model' },
    candidateIds: ['ask-origin'], state: {}, fetchImpl,
  });
  assert.deepEqual(result, { ok: false, reason: 'invalid-model-selection' });
});
```

- [ ] **Step 2: Run tests and verify the adapter is missing**

Run: `node --test tests/local-ai.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement provider settings and loopback validation**

Permit only `http:` for `localhost`, `127.0.0.1`, or `[::1]`; reject credentials, redirects, missing ports, and unsupported protocols. Normalize trailing slashes. Do not include an API-key property in persisted settings.

- [ ] **Step 4: Implement injected-fetch connection and selection calls**

`testLocalAiConnection` calls `${baseUrl}/models` with `credentials: 'omit'` and an `AbortController` timeout. `selectApprovedMove` posts non-streaming JSON to `${baseUrl}/chat/completions`, requests one `moveId`, limits candidate IDs, parses fenced or plain JSON safely, and accepts the result only when the ID is in `candidateIds`.

- [ ] **Step 5: Run local-AI tests**

Run: `node --test tests/local-ai.test.mjs`

Expected: all tests PASS without making a real network request.

- [ ] **Step 6: Commit the adapter**

```bash
git add assets/js/local-ai.js tests/local-ai.test.mjs
git commit -m "Add safe local AI adapter"
```

---

### Task 5: Browser Voice Capability Layer

**Files:**
- Create: `assets/js/voice.js`
- Create: `tests/voice.test.mjs`

**Interfaces:**
- Consumes: injected browser globals and validated text.
- Produces: `createSpeechOutput(environment)`, `createSpeechInput(environment)`, and capability/status objects used by `app.js`.

- [ ] **Step 1: Write failing capability and cancellation tests**

Use fakes rather than real audio:

```js
test('speech output reports unsupported without synthesis globals', () => {
  const output = createSpeechOutput({});
  assert.equal(output.supported, false);
});

test('speech output cancels stale speech before a new validated line', () => {
  let cancelled = 0;
  const spoken = [];
  class FakeUtterance { constructor(text) { this.text = text; } }
  const output = createSpeechOutput({
    speechSynthesis: { cancel: () => { cancelled += 1; }, speak: (item) => spoken.push(item.text) },
    SpeechSynthesisUtterance: FakeUtterance,
  });
  output.speak('I am busy.', { rate: 0.82 });
  assert.equal(cancelled, 1);
  assert.deepEqual(spoken, ['I am busy.']);
});

test('speech input reports a manual fallback when recognition is unavailable', () => {
  const input = createSpeechInput({});
  assert.deepEqual(input.status(), { supported: false, state: 'manual' });
});
```

- [ ] **Step 2: Run tests and verify the module is missing**

Run: `node --test tests/voice.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement output and optional recognition wrappers**

Output supports `speak(text, { rate, lang })`, `cancel()`, `onend`, and `onerror`. Input feature-detects `SpeechRecognition || webkitSpeechRecognition`, exposes `start({ lang, onResult, onError, onEnd })` and `stop()`, never starts on page load, and maps permission/network/no-speech errors to stable status codes.

- [ ] **Step 4: Add tests for successful transcript and permission denial**

Inject a fake recognition constructor. Assert that final transcript text is delivered once, `not-allowed` maps to `permission-denied`, and `stop()`/`abort()` is idempotent.

- [ ] **Step 5: Run voice tests**

Run: `node --test tests/voice.test.mjs`

Expected: all tests PASS.

- [ ] **Step 6: Commit the voice layer**

```bash
git add assets/js/voice.js tests/voice.test.mjs
git commit -m "Add browser speaking capabilities"
```

---

### Task 6: Speaking-First Navigation, Today, and Settings

**Files:**
- Modify: `index.html`
- Modify: `assets/js/app.js`
- Modify: `assets/css/style.css`
- Modify: `tests/ui-static.test.mjs`

**Interfaces:**
- Consumes: existing lesson, vocabulary, and progress data plus local-AI presets.
- Produces: routes `home`, `lessons`, `speaking`, `review`, and `settings`; persisted non-sensitive `english_learning_v3_settings`.

- [ ] **Step 1: Write failing static UI assertions**

Assert that:

```js
assert.match(indexSource, /data-route="speaking"[\s\S]*<span>对话<\/span>/);
assert.match(indexSource, /data-route="settings"[\s\S]*<span>设置<\/span>/);
assert.doesNotMatch(indexSource, /<main[^>]+aria-live="polite"/);
assert.match(appSource, /开始 Part \$\{[^}]+\} 口语/);
assert.match(appSource, /function renderSettings\(\)/);
assert.match(appSource, /data-action="test-local-ai"/);
assert.match(appSource, /只使用本课词汇/);
assert.match(cssSource, /\.ai-status/);
```

- [ ] **Step 2: Run static tests and verify failure**

Run: `node --test tests/ui-static.test.mjs`

Expected: FAIL because the speaking-first routes and settings do not exist.

- [ ] **Step 3: Replace top-level navigation and add explicit routes**

Use labels `今日`, `课程`, `对话`, `复习`, `设置`. Keep old vocabulary, spelling, grammar, and wrong-book views reachable through Part detail and review actions. Route all navigation through the existing cancellation-aware `navigate()` helper.

- [ ] **Step 4: Redesign Today around one speaking action**

Default `activeLessonId` and settings scope to `part-1`. Render the current Part's next scenario, Chinese goal, target words, estimated duration, speaking progress, and primary `开始 Part N 口语` action. Remove the all-course 595-word statistic from the hero.

- [ ] **Step 5: Build Settings for basic/local-AI and voice preferences**

Render provider choices `关闭`, `Ollama`, `LM Studio`, and `自定义本机接口`; base URL; model name; `测试连接`; normal/slow speech rates; browser recognition opt-in; connection status; and provider-specific CORS/local-network guidance. Persist no API key. Sanitize all values and show loopback validation errors before fetch.

- [ ] **Step 6: Add focused styling**

Preserve current tokens and organic palette. Add calm status pills, grouped settings rows, visible focus, 44px targets, and mobile layouts. Remove nested-card styling from the Today hero.

- [ ] **Step 7: Run all tests**

Run: `npm test`

Expected: all existing and new tests PASS.

- [ ] **Step 8: Commit navigation and settings**

```bash
git add index.html assets/js/app.js assets/css/style.css tests/ui-static.test.mjs
git commit -m "Make speaking the primary learning path"
```

---

### Task 7: Interactive Guided Dialogue Screen

**Files:**
- Modify: `assets/js/app.js`
- Modify: `assets/css/style.css`
- Modify: `tests/ui-static.test.mjs`

**Interfaces:**
- Consumes: dialogue packs, speaking-session engine, whitelist validators, and voice wrappers.
- Produces: offline-capable three-pass speaking flow following the selected Guided Dialogue Coach visual target.

- [ ] **Step 1: Write failing static assertions for the selected screen**

Require `renderSpeaking`, conversation transcript, coach rail, pass/turn progress, replay, slow speech, reveal, microphone, self-check, and exit actions. Require CSS selectors `.speaking-layout`, `.conversation-pane`, `.coach-rail`, `.voice-bar`, `.dialogue-turn.is-active`, and a mobile breakpoint that stacks the columns.

- [ ] **Step 2: Run UI tests and verify failure**

Run: `node --test tests/ui-static.test.mjs`

Expected: FAIL on missing speaking render and selectors.

- [ ] **Step 3: Wire dialogue modules and session lifecycle**

On `start-speaking`, select the current Part pack and next due/default scenario, freeze the Part whitelist/version, create a speaking session, navigate to `speaking`, and render. On exit, Part change, or route change, cancel speech, recognition, and pending requests.

- [ ] **Step 4: Implement the three-pass interaction**

- `listen`: reveal and play all validated lines in order.
- `role-a`: system plays B; learner handles A.
- `role-b`: system plays A; learner handles B.
- `complete`: record evidence, offer repeat or next scenario, and show the next review date.

For learner turns, show Chinese intention by default, then sentence frame/choices, then full approved English only on request. `我说完了` provides a complete path without recognition.

- [ ] **Step 5: Add browser recognition as an optional enhancement**

Start only from the microphone action. Normalize the transcript and compare it with the current turn's approved canonical English. Do not display or speak invalid/out-of-Part raw transcript; show Chinese feedback `本轮请使用本课句型` and keep the approved choices visible. Recognition errors switch the turn to manual controls without adding a learner error.

- [ ] **Step 6: Implement the selected two-column visual system**

Conversation occupies the wider left column; coach rail occupies the right; the voice bar spans the practice surface. Highlight only the active turn, fade completed/upcoming turns, keep role and `第 N / 6 轮` visible, and stack the coach below the active turn on screens below 820px.

- [ ] **Step 7: Run all automated tests**

Run: `npm test`

Expected: all tests PASS, including old vocabulary and daily-plan behavior.

- [ ] **Step 8: Commit the offline speaking experience**

```bash
git add assets/js/app.js assets/css/style.css tests/ui-static.test.mjs
git commit -m "Add guided speaking dialogue flow"
```

---

### Task 8: Local-AI Progressive Enhancement

**Files:**
- Modify: `assets/js/app.js`
- Modify: `tests/ui-static.test.mjs`
- Modify: `tests/local-ai.test.mjs`

**Interfaces:**
- Consumes: validated candidate move IDs from the current scenario and settings from Task 6.
- Produces: adaptive approved-move selection with deterministic fallback and visible connection status.

- [ ] **Step 1: Add failing tests for integration boundaries**

Assert that `app.js` passes only candidate IDs and minimal current-Part state to `selectApprovedMove`, never uses model text as `innerHTML` or TTS input, sets `stream: false`, aborts stale work on navigation, and calls the deterministic selector on every adapter failure.

- [ ] **Step 2: Run tests and verify integration is absent**

Run: `node --test tests/local-ai.test.mjs tests/ui-static.test.mjs`

Expected: FAIL on missing app integration.

- [ ] **Step 3: Add one-request-at-a-time model selection**

When local AI is enabled and tested, call `selectApprovedMove` only at a scenario branch with current `lessonId`, `scenarioId`, `turnIndex`, support level, and approved candidate IDs. Disable streaming, cap the request context to the current scenario, and ignore any returned prose.

- [ ] **Step 4: Add deterministic fallback and status transitions**

Timeout, abort, invalid JSON, unknown ID, HTTP error, or unavailable model calls the local rule selector and shows calm status `已使用基础模式`. It never interrupts the speaking flow or exposes raw provider errors as English content.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`

Expected: all tests PASS without a running local model.

- [ ] **Step 6: Commit AI enhancement**

```bash
git add assets/js/app.js tests/ui-static.test.mjs tests/local-ai.test.mjs
git commit -m "Connect optional local dialogue AI"
```

---

### Task 9: Accessibility, Migration, and Complete Review Path

**Files:**
- Modify: `assets/js/app.js`
- Modify: `assets/css/style.css`
- Modify: `index.html`
- Modify: `tests/dialogue-engine.test.mjs`
- Modify: `tests/ui-static.test.mjs`

**Interfaces:**
- Consumes: existing v2 word progress and new v3 speaking progress.
- Produces: non-destructive settings/progress migration, dedicated review screen, focused announcements, and keyboard-safe session behavior.

- [ ] **Step 1: Add failing migration and review tests**

Test that old `english_learning_v2_progress` remains readable, new speaking progress uses a separate key, corrupt storage falls back to memory, due speaking items sort before new content, and future-Part items never enter current-Part review.

- [ ] **Step 2: Add failing accessibility source assertions**

Assert one dedicated status live region, active-turn focus management, textual recording state, `aria-pressed` for reveal/slow controls, explicit stop control, reduced-motion coverage for new animations, and no color-only role/status label.

- [ ] **Step 3: Implement non-destructive storage migration and review**

Keep existing word keys. Add versioned speaking/settings keys, safe parse/write wrappers with memory fallback, and a `复习` screen that separates `本课待复说`, `旧课复习`, `错词`, and supporting exercises.

- [ ] **Step 4: Implement focus and announcement behavior**

Move focus to the active turn heading after a turn changes. Announce only listening/result/status changes through the dedicated live region. Ensure repeated render calls do not restart speech or recognition.

- [ ] **Step 5: Run all tests and source checks**

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 6: Commit accessibility and migration**

```bash
git add index.html assets/js/app.js assets/css/style.css tests/dialogue-engine.test.mjs tests/ui-static.test.mjs
git commit -m "Finish speaking review and accessibility"
```

---

### Task 10: Visual Verification and GitHub Pages Deployment

**Files:**
- Modify only files needed to fix issues found during verification.

**Interfaces:**
- Consumes: the complete static application.
- Produces: a tested commit pushed to `origin/main` and a verified live GitHub Pages experience.

- [ ] **Step 1: Run automated verification from a clean app state**

Run:

```bash
npm test
git diff --check
git status --short
```

Expected: tests PASS, no whitespace errors, and no unintended files.

- [ ] **Step 2: Start the local preview and inspect console output**

Run: `npm run preview`

Open the printed local URL in the Codex in-app browser. Check Today, Courses, Dialogue, Review, and Settings with AI disabled. Confirm there are no page errors or unhandled promise rejections.

- [ ] **Step 3: Verify the complete learner path**

Run one Part 1 scenario through listen, role A, role B, and completion. Exercise replay, slow speed, reveal, self-check, exit/resume, and refresh. Confirm every visible/spoken English line belongs to Part 1 and future-Part English does not appear.

- [ ] **Step 4: Verify responsive and accessibility states**

Inspect desktop and mobile-width screenshots. Check keyboard-only navigation, focus visibility, 200% zoom, reduced motion, unsupported recognition fallback, speech cancellation, and AI connection failure.

- [ ] **Step 5: Compare against the selected visual target and fix discrepancies**

Compare the implementation screenshot and selected Guided Dialogue Coach mock at the same viewport. Fix hierarchy, clipped controls, spacing, typography, borders, responsive stacking, or misleading statuses, then re-run `npm test`.

- [ ] **Step 6: Commit verification fixes**

```bash
git add index.html assets/css/style.css assets/js/app.js assets/js/dialogue-engine.js assets/js/local-ai.js assets/js/voice.js data/dialogues.js tests
git commit -m "Polish interactive speaking coach"
```

If there are no verification fixes, do not create an empty commit.

- [ ] **Step 7: Push the verified branch**

Run: `git push origin main`

Expected: `origin/main` advances to the verified commit and GitHub Pages begins deployment.

- [ ] **Step 8: Verify the live URL**

Open <https://limimi00.github.io/english-learning-website/> after deployment. Confirm the new speaking-first Today screen, one complete offline dialogue, Settings, asset loading, console health, and mobile layout. If Pages has not updated yet, wait for the deployment to complete and verify again rather than claiming success from the local preview.
