# Interactive Speaking Coach Redesign

## Summary

Redesign the existing GitHub Pages site into a Chinese-first speaking coach for absolute beginners. The primary experience is a short, interactive A/B dialogue for the learner's current Part. The site remains fully usable without an API. When a compatible model is running on the learner's computer, the site can use it to vary the conversation and select the next approved response.

The selected visual direction is the second concept, **Guided Dialogue Coach**: a two-column desktop layout with the live conversation on the left, a beginner support rail on the right, and persistent voice controls at the bottom. On small screens, the support rail becomes a drawer below the current turn.

Production target: <https://limimi00.github.io/english-learning-website/>

## Product Decisions

- Part 1 is the default starting scope.
- A main lesson dialogue uses only English present in that Part's courseware.
- Previous Parts appear only in a clearly labelled review mode; future Parts never appear in the current lesson.
- The learner repeats each scenario three times: listen to the whole dialogue, play role A, then play role B.
- AI is an optional enhancement, not a dependency.
- A deterministic validator, not the model, owns the vocabulary and grammar boundary.
- The first release keeps all course data and learner progress in the browser. It does not add accounts, a cloud database, or a hosted API proxy.

## Goals

- Make speaking and repeated dialogue the most prominent action.
- Give a zero-beginner enough Chinese support to start speaking immediately.
- Practice the vocabulary, sentence logic, and grammar of all six courseware Parts without introducing future English.
- Provide meaningful dialogue variation both with and without a local model.
- Preserve the current vocabulary, delayed-review, wrong-answer, and lesson-browsing capabilities where they support the speaking path.
- Deploy as a static site through the existing GitHub Pages repository.

## Non-Goals

- Unrestricted free conversation.
- Claiming authoritative pronunciation or fluency scores.
- Storing commercial API keys safely in the static site.
- Requiring Ollama, LM Studio, microphone permission, speech recognition, or network access.
- Cross-device progress sync or user accounts.
- A local companion application in the first release.

## Information Architecture

The bottom navigation becomes:

1. `今日` — the next recommended speaking scenario and due review.
2. `课程` — the six Parts, their goals, progress, and preview state.
3. `对话` — the active speaking session and available scenarios for the current Part.
4. `复习` — due words, difficult lines, and completed dialogue replay.
5. `设置` — voice options, local AI connection, learning preferences, and progress reset.

The existing full vocabulary browser remains accessible from each Part and from review, but it is no longer a top-level competitor to the speaking action. Grammar, translation, spelling, and fill-blank exercises become supporting activities inside a Part.

## Core Learner Flow

### 1. Today

The page shows one primary action: `开始 Part N 口语`. It explains the scenario in Chinese, lists the small set of target words and sentence frames for that session, and estimates an 8–12 minute practice. Secondary actions are `复习一句` and `查看本课`.

New learners start at Part 1 rather than `全部课本`.

### 2. Listen Once

The site plays the approved 4–6 turn conversation. Each line has:

- speaker and role;
- large English text;
- smaller Chinese meaning;
- replay and slow-play controls;
- a visible courseware-source badge.

Playback can be paused, replayed, or skipped. A missing voice never blocks progress.

### 3. Play Role A

The site speaks role B. For the learner's turn, the support rail shows:

- the Chinese speaking intention;
- an optional English sentence frame;
- one replaceable slot and only course-approved choices;
- `再听一次`, `慢速`, `显示英文`, and `我说完了` controls.

If browser speech recognition is available and the learner explicitly enables it, the transcript is compared with approved answers. Otherwise, the learner uses self-check, word choices, or typing. A technical failure is never counted as a wrong answer.

### 4. Play Role B

The roles swap and the learner repeats the same communicative task from the other side. The interface keeps the current role, turn number, and next speaking intention visible at all times.

### 5. Finish and Review

The summary distinguishes four skills:

- listened;
- repeated with the model;
- spoke with a sentence frame;
- spoke from the Chinese intention only.

The site schedules difficult lines and target sentence frames for 1/3/7-day review. It never labels completion as unrestricted English fluency.

## Course Scope and Unlocking

- Part 1 is open initially.
- A learner may preview later Part titles and Chinese descriptions, but main practice stays in the active Part.
- Completing 80% of the Part's core speaking items and producing every core sentence frame once without the full English answer unlocks the next Part.
- The learner can continue reviewing a completed Part at any time.
- A separate `综合复习` mode may combine mastered previous Parts, but it is never used during a current-Part lesson and never includes future Parts.
- Course content is versioned. Adding content later does not silently revoke an already unlocked Part; new items appear as `待补练`.

## Courseware Whitelist

Each Part has its own immutable, versioned whitelist built from English that already appears in that Part:

- `vocabulary[].en`;
- `grammar[].patterns`;
- `sentences[]`;
- `fillBlanks[].q` and `fillBlanks[].a`;
- `translations[].en`;
- `questions[]`.

The tokenizer normalizes case, whitespace, punctuation, straight/curly apostrophes, and only explicitly registered spelling variants such as `centre/center` and `grey/gray`. It does not automatically permit unseen inflections, contractions, names, or synonyms.

Every English string that the product displays, stores as a learning target, or sends to text-to-speech must pass validation against the active Part. This includes dialogue lines, choices, hints containing English, AI-selected responses, error feedback, and fallback content. Chinese interface copy is outside the English whitelist, but Chinese prompts must not ask the learner to produce an unapproved English answer.

Token validity alone is insufficient. Each learner turn also references an approved sentence-frame ID and approved slot IDs. The renderer constructs the canonical English from those IDs. This prevents a model from combining legal words into out-of-scope grammar or meaningless sentences.

Validation errors use explicit codes such as:

- `unknown_token`;
- `cross_part_token`;
- `disallowed_inflection`;
- `pattern_not_allowed`;
- `slot_not_allowed`;
- `invalid_dialogue_shape`.

A content build fails if any bundled dialogue has a validation error.

## Dialogue Content Model

Each Part contains at least three curated fallback scenarios. Each scenario has one communicative goal and 4–6 turns.

```js
{
  id: 'part-1-meet-colleague',
  lessonId: 'part-1',
  version: 1,
  titleCn: '认识新同事',
  goalCn: '介绍自己，并询问对方来自哪里。',
  targetTermIds: ['i', 'am', 'student', 'from', 'china'],
  targetPatternIds: ['p1-i-am-student', 'p1-where-from'],
  turns: [
    {
      id: 'turn-1',
      role: 'A',
      patternId: 'p1-i-am-student',
      slotIds: [],
      cn: '我是学生。'
    }
  ]
}
```

Names, locations, times, and other slot values are usable only when their canonical English appears in the active Part's source. Courseware provenance remains attached to every pattern and slot.

## Variation Without AI

The static site creates safe variety by selecting from approved IDs:

- choose one of the Part's scenarios;
- choose approved role names and slot values;
- change the order of compatible question pairs;
- choose one of several approved responses;
- repeat difficult turns more often.

The rule engine never creates new English text. It assembles canonical lines from validated patterns and slots, so offline/basic mode satisfies the same whitelist guarantee as AI mode.

## Local AI Mode

### Supported connection presets

- Ollama: `http://127.0.0.1:11434/v1`
- LM Studio: `http://127.0.0.1:1234/v1`
- Advanced custom OpenAI-compatible loopback endpoint

Settings store only non-sensitive values such as provider, loopback base URL, model name, and preferences in `localStorage`. The first release does not save a remote API key. Local model servers should bind only to `127.0.0.1` or `::1`, disable tools/file access, and allow the exact GitHub Pages origin.

Connection states are explicit: `关闭`, `未测试`, `可用`, and `不可用`. A user-initiated `测试连接` request uses a short timeout and a non-personal probe. The UI distinguishes a stopped model, no loaded model, browser permission/CORS failure, and timeout when the browser exposes enough information; otherwise it gives provider-specific setup help.

GitHub Pages is HTTPS while common local model endpoints are HTTP. Browser local-network permission, mixed-content rules, and CORS behavior differ. Therefore local AI is a progressive enhancement and is never advertised as universally available. Settings explain that LM Studio needs web CORS enabled and Ollama needs the GitHub Pages origin allowed.

### Model responsibility

The model does not directly author text shown or spoken in the first release. It receives only the active lesson, current dialogue state, and approved intent/template/slot IDs. It may return:

```json
{
  "nextIntentId": "ask-origin",
  "patternId": "p1-where-from",
  "slotIds": [],
  "supportLevel": "intent-only"
}
```

The client validates every ID against the frozen session whitelist and constructs the English locally. Invalid JSON, unknown IDs, cross-Part IDs, timeouts, or model errors are discarded. The same turn is then selected by the local rule engine. Model errors never appear as English learning content.

This design preserves conversational adaptation—the model can choose what to ask next, select a suitable approved response, and adjust support—while keeping a hard vocabulary boundary.

## Voice Capabilities

### Output

Browser `speechSynthesis` is the default voice output and reuses the current site's speech support. It offers normal and slow rates and always keeps visible text. The voice is invoked only after a user gesture when required by the browser.

### Input

The first release feature-detects `SpeechRecognition` or `webkitSpeechRecognition`. It starts only after the learner presses the microphone control and grants permission. Some browsers may use an online recognition service, so the setting is described as browser speech recognition rather than guaranteed local/offline recognition.

If recognition is unavailable, denied, silent, uncertain, or interrupted, the same turn immediately offers:

- `我说完了` self-check;
- course-approved word choices;
- typing the approved line.

No fallback reduces lesson access, changes the whitelist, or records a technical error as a learner mistake. Raw audio is not stored by the site.

### Future local voice adapters

The voice layer exposes interfaces for a later local OpenAI-compatible transcription endpoint and local speech endpoint. They are not required for the first release because Ollama and LM Studio text servers do not guarantee those audio endpoints.

## State and Data Flow

The app keeps separate modules for:

- course data and dialogue definitions;
- lesson lexicon and dialogue validation;
- deterministic dialogue selection;
- optional local-model adapter;
- voice input/output capability;
- speaking-session state and progress;
- view rendering and navigation.

A speaking session freezes `lessonId`, `courseVersion`, `whitelistVersion`, `scenarioId`, and current pass. Changing the active Part or course version ends the current session before new content is loaded.

Progress distinguishes `listen`, `repeat`, `guided-produce`, and `independent-produce`. It records attempts and support use per dialogue line and sentence frame. Existing word progress is migrated without being treated as speaking mastery.

If `localStorage` is unavailable or corrupted, the app uses in-memory progress for the current tab and explains that progress will not persist.

## Visual Design

Use the selected Guided Dialogue Coach concept as the visual target:

- preserve the current cream, clay, and olive palette;
- keep the friendly rounded geometry while reducing nested cards;
- use a two-column desktop practice screen;
- keep the conversation transcript wider than the coaching rail;
- anchor a persistent voice bar to the bottom of the practice surface;
- use large bilingual type, clear speaker labels, and a visible active turn;
- stack the coach beneath the active turn on mobile;
- make `基础模式` and `本地 AI 已连接` calm status indicators rather than warnings;
- show `只使用本课词汇` throughout the speaking session.

The current animated organic background remains subtle and respects `prefers-reduced-motion`.

## Error and Safety Behavior

- AI unavailable: continue in basic mode without a blocking modal.
- AI response invalid: silently use a validated local response and note `已使用基础模式` in status.
- CORS/local-network blocked: keep the site usable and show setup help only in Settings.
- Speech recognition unavailable or denied: offer self-check, choices, and typing.
- Speech synthesis unavailable: keep visible text and progression controls.
- Rapid double-submit: accept only the first action for the current turn.
- Route or Part change: cancel speech, recognition, pending model calls, and stale callbacks.
- Model text and transcripts are always rendered as text, never as HTML.
- Local AI requests omit cookies and send only the active Part's minimal approved state.

## Accessibility

- Every control is keyboard-operable and at least 44px on touch screens.
- The active turn receives focus when it changes.
- Status and feedback use a small dedicated `aria-live` region; the whole application is not live.
- Speaker and success state are conveyed with text and shape, not color alone.
- Every audio line has visible English and Chinese text.
- Recording state, microphone permission, listening timeout, and stop action are explicit.
- The experience supports 200% zoom, narrow mobile layouts, reduced motion, and no timed-answer requirement.

## Testing

### Unit tests

- Build a separate whitelist for each Part from every approved courseware field.
- Accept only registered punctuation, spelling, phrase, and contraction variants.
- Reject unknown tokens, future-Part tokens, unseen inflections, and legal words in illegal patterns.
- Validate every bundled fallback dialogue and every English hint.
- Ensure the rule generator returns only IDs belonging to the frozen Part.
- Reject malformed or cross-Part model selections and fall back deterministically.
- Preserve session scope and progress through serialization and migration.

### Static UI tests

- Speaking is the primary Today action.
- Dialogue, Settings, local-AI status, voice controls, support controls, and whitelist status are rendered.
- No API key is embedded in tracked source.
- Navigation cancels speech, recognition, and pending model calls.
- The whole `#app` is no longer an `aria-live` region.

### Browser tests

- Desktop and mobile layouts match the selected concept without overflow or clipped controls.
- The full three-pass flow works with AI disabled.
- Ollama and LM Studio connection failures degrade safely.
- Speech permission denial and unsupported recognition preserve a complete path.
- Keyboard-only navigation, 200% zoom, reduced motion, and focus transitions work.
- A generated or model-selected cross-Part item never reaches the visible transcript or TTS.

## Acceptance Criteria

- The deployed GitHub Pages site works from first load without an API or local model.
- Part 1 is the default and future-Part English does not appear in its main practice.
- Every Part has at least three validated 4–6 turn fallback scenarios.
- Every scenario supports listen, role A, and role B passes.
- The active speaking screen follows the selected two-column visual direction and has a usable mobile layout.
- A learner can replay, slow down, reveal help, speak or self-check, and finish a scenario.
- Settings can test and use supported loopback local-model endpoints without storing a remote secret.
- An invalid or unavailable model never blocks the lesson and never produces visible or spoken unvalidated English.
- Automated tests prove course scope, dialogue validation, fallback behavior, and the critical visible controls.
- The updated site can be pushed to the existing `main` branch and served from the current GitHub Pages URL.

## Deferred Enhancements

- A small, authenticated local companion service for more reliable browser-to-local-model connectivity.
- Fully local transcription and natural local TTS provider adapters.
- Account sync and teacher dashboards.
- A clearly separated post-course free-conversation mode after all six Parts are mastered.
