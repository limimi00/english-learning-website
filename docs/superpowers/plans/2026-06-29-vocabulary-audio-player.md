# Vocabulary Audio Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deduplicated vocabulary audio player that reads each word as English, Chinese, English with multi-textbook selection and loop playback.

**Architecture:** Keep queue construction in `assets/js/study-engine.js` as a pure helper so lesson selection and deduplication are testable without browser APIs. Add vocabulary-page player state and speech-synthesis orchestration in `assets/js/app.js`, reusing the existing vocabulary index and single-word speech approach. Add focused CSS for a compact player panel that fits the current organic card style.

**Tech Stack:** Browser JavaScript modules, Web Speech API `speechSynthesis`, CSS, Node built-in test runner, static UI source tests.

---

### Task 1: Playback Queue Helper

**Files:**
- Modify: `tests/study-engine.test.mjs`
- Modify: `assets/js/study-engine.js`

- [ ] **Step 1: Write failing queue tests**

In `tests/study-engine.test.mjs`, update the import block to include `buildVocabularyPlaybackItems`:

```js
import {
  normalizeTermKey,
  buildVocabularyIndex,
  buildDailyPlan,
  buildGeneratedSentenceItems,
  buildVocabularyPlaybackItems,
  buildWordPracticeItems,
  evaluateWordProgress,
  isAnswerMatch,
  normalizeAnswer,
} from '../assets/js/study-engine.js';
```

Add these tests after `buildVocabularyIndex deduplicates spelling variants within a lesson`:

```js
test('buildVocabularyPlaybackItems returns all deduplicated words for all scope', () => {
  const index = buildVocabularyIndex([
    {
      id: 'part-1',
      order: 1,
      vocabulary: [
        { en: 'Teacher', cn: '老师', category: 'people' },
        { en: 'centre', cn: '中心', category: 'places' },
      ],
    },
    {
      id: 'part-2',
      order: 2,
      vocabulary: [
        { en: 'teacher', cn: '老师', category: 'people' },
        { en: 'coffee', cn: '咖啡', category: 'food' },
      ],
    },
  ]);

  const items = buildVocabularyPlaybackItems(index, ['all']);

  assert.deepEqual(items.map((item) => item.key), ['teacher', 'center', 'coffee']);
});

test('buildVocabularyPlaybackItems filters to one textbook and uses lesson-specific meaning', () => {
  const index = buildVocabularyIndex([
    {
      id: 'part-1',
      order: 1,
      vocabulary: [
        { en: 'am', cn: '是', category: 'grammar' },
        { en: 'teacher', cn: '老师', category: 'people' },
      ],
    },
    {
      id: 'part-2',
      order: 2,
      vocabulary: [
        { en: 'coffee', cn: '咖啡', category: 'food' },
        { en: 'am', cn: '上午', category: 'time' },
      ],
    },
  ]);

  const items = buildVocabularyPlaybackItems(index, ['part-2']);

  assert.deepEqual(items.map((item) => item.key), ['coffee', 'am']);
  assert.equal(items[1].cn, '上午');
  assert.equal(items[1].category, 'time');
});

test('buildVocabularyPlaybackItems unions multiple textbooks without duplicates', () => {
  const index = buildVocabularyIndex([
    {
      id: 'part-1',
      order: 1,
      vocabulary: [
        { en: 'teacher', cn: '老师', category: 'people' },
        { en: 'student', cn: '学生', category: 'people' },
      ],
    },
    {
      id: 'part-2',
      order: 2,
      vocabulary: [
        { en: 'teacher', cn: '老师', category: 'people' },
        { en: 'coffee', cn: '咖啡', category: 'food' },
      ],
    },
    {
      id: 'part-3',
      order: 3,
      vocabulary: [
        { en: 'cinema', cn: '电影院', category: 'places' },
      ],
    },
  ]);

  const items = buildVocabularyPlaybackItems(index, ['part-2', 'part-3']);

  assert.deepEqual(items.map((item) => item.key), ['teacher', 'coffee', 'cinema']);
});

test('buildVocabularyPlaybackItems treats empty selection as all scope', () => {
  const index = buildVocabularyIndex([
    {
      id: 'part-1',
      order: 1,
      vocabulary: [
        { en: 'teacher', cn: '老师', category: 'people' },
      ],
    },
    {
      id: 'part-2',
      order: 2,
      vocabulary: [
        { en: 'coffee', cn: '咖啡', category: 'food' },
      ],
    },
  ]);

  const items = buildVocabularyPlaybackItems(index, []);

  assert.deepEqual(items.map((item) => item.key), ['teacher', 'coffee']);
});
```

- [ ] **Step 2: Run the engine tests and verify they fail**

Run:

```bash
node --test tests/study-engine.test.mjs
```

Expected: FAIL with a module export error for `buildVocabularyPlaybackItems`, because the helper is not implemented yet.

- [ ] **Step 3: Implement the playback queue helper**

In `assets/js/study-engine.js`, add this exported function after `buildDailyPlan`:

```js
export function buildVocabularyPlaybackItems(vocabulary, lessonIds = ['all']) {
  const selectedIds = Array.isArray(lessonIds)
    ? lessonIds.filter(Boolean)
    : ['all'];
  const selected = new Set(selectedIds);

  if (!selected.size || selected.has('all')) {
    return vocabulary.slice().sort(sortByLessonOrder);
  }

  if (selected.size === 1) {
    const [lessonId] = Array.from(selected);
    return vocabulary
      .filter((item) => item.sources?.includes(lessonId))
      .map((item) => applySourceDetails(item, lessonId))
      .sort(sortByLessonOrder);
  }

  return vocabulary
    .filter((item) => item.sources?.some((sourceId) => selected.has(sourceId)))
    .sort(sortByLessonOrder);
}
```

- [ ] **Step 4: Run the engine tests and verify they pass**

Run:

```bash
node --test tests/study-engine.test.mjs
```

Expected: PASS for all `study-engine` tests.

- [ ] **Step 5: Commit the queue helper**

Run:

```bash
git add tests/study-engine.test.mjs assets/js/study-engine.js
git commit -m "Add vocabulary playback queue helper"
```

Expected: commit succeeds with only the test and engine files included.

### Task 2: Static Tests For Player UI And Lifecycle

**Files:**
- Modify: `tests/ui-static.test.mjs`

- [ ] **Step 1: Write failing static UI tests**

Add these tests near the existing vocabulary-page tests in `tests/ui-static.test.mjs`:

```js
test('vocabulary page renders audio playback controls for deduplicated words', async () => {
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');
  const cssSource = await readFile(new URL('../assets/css/style.css', import.meta.url), 'utf8');

  assert.match(appSource, /buildVocabularyPlaybackItems\(vocabulary, playback\.lessonIds\)/);
  assert.match(appSource, /function renderVocabularyPlayer\(items\)/);
  assert.match(appSource, /class="audio-player/);
  assert.match(appSource, /data-action="play-vocabulary-audio"/);
  assert.match(appSource, /data-action="pause-vocabulary-audio"/);
  assert.match(appSource, /data-action="previous-vocabulary-word"/);
  assert.match(appSource, /data-action="next-vocabulary-word"/);
  assert.match(appSource, /data-action="toggle-vocabulary-loop"/);
  assert.match(cssSource, /\.audio-player\s*\{/);
});

test('vocabulary audio player supports all and multi-part selection', async () => {
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /let playback = \{[\s\S]*lessonIds: \['all'\]/);
  assert.match(appSource, /data-action="toggle-playback-lesson"/);
  assert.match(appSource, /type="checkbox"/);
  assert.match(appSource, /updatePlaybackLessons\(action\.value, action\.checked\)/);
  assert.match(appSource, /playback\.lessonIds = selected\.size \? Array\.from\(selected\) : \['all'\]/);
});

test('vocabulary audio player speaks English Chinese English and stops on navigation', async () => {
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /const PLAYBACK_PHASES = \[[\s\S]*field: 'en'[\s\S]*field: 'cn'[\s\S]*field: 'en'/);
  assert.match(appSource, /lang: 'en-US'/);
  assert.match(appSource, /lang: 'zh-CN'/);
  assert.match(appSource, /function stopVocabularyPlayback\(/);
  assert.match(appSource, /function navigate\(nextRoute\)/);
  assert.match(appSource, /if \(nextRoute !== 'vocabulary'\) stopVocabularyPlayback/);
});
```

- [ ] **Step 2: Run the static UI tests and verify they fail**

Run:

```bash
node --test tests/ui-static.test.mjs
```

Expected: FAIL because the playback UI, state, phase list, and navigation stop helper are not implemented yet.

### Task 3: Player State, Rendering, And Lesson Selection

**Files:**
- Modify: `assets/js/app.js`

- [ ] **Step 1: Import the queue helper**

Modify the import from `./study-engine.js` in `assets/js/app.js`:

```js
import {
  buildDailyPlan,
  buildGeneratedSentenceItems,
  buildVocabularyIndex,
  buildVocabularyPlaybackItems,
  buildWordPracticeItems,
  evaluateWordProgress,
  isAnswerMatch,
  normalizeTermKey,
  todayKey,
  WRONG_CLEAR_CORRECT_COUNT,
} from './study-engine.js';
```

- [ ] **Step 2: Add playback state and phases**

After `let vocabularyFilters = { query: '', lessonId: 'all' };`, add:

```js
let playback = {
  lessonIds: ['all'],
  index: 0,
  playing: false,
  loop: false,
  phase: 'idle',
  token: 0,
};

const PLAYBACK_PHASES = [
  { field: 'en', lang: 'en-US', rate: 0.82 },
  { field: 'cn', lang: 'zh-CN', rate: 0.9 },
  { field: 'en', lang: 'en-US', rate: 0.82 },
];
```

- [ ] **Step 3: Route all navigation through a stop-aware helper**

Add this helper near `setActiveNav`:

```js
function navigate(nextRoute) {
  if (nextRoute !== 'vocabulary') stopVocabularyPlayback({ rerender: false });
  route = nextRoute;
}
```

Replace direct route assignments that move between screens:

```js
route = button.dataset.route;
```

with:

```js
navigate(button.dataset.route);
```

Replace direct assignments such as:

```js
route = 'home';
route = 'wrongbook';
route = 'lesson-detail';
route = 'study';
route = action.dataset.route || 'home';
```

with the matching `navigate(...)` calls:

```js
navigate('home');
navigate('wrongbook');
navigate('lesson-detail');
navigate('study');
navigate(action.dataset.route || 'home');
```

Keep calls to `renderGrammarPractice()` and `renderQuestionPractice()` unchanged because those draw practice sub-screens without changing the app route.

- [ ] **Step 4: Add click handlers for playback controls**

Inside the existing `app.addEventListener('click', ...)` handler, add:

```js
if (name === 'play-vocabulary-audio') startVocabularyPlayback();
if (name === 'pause-vocabulary-audio') pauseVocabularyPlayback();
if (name === 'previous-vocabulary-word') moveVocabularyPlayback(-1);
if (name === 'next-vocabulary-word') moveVocabularyPlayback(1);
if (name === 'toggle-vocabulary-loop') {
  playback.loop = !playback.loop;
  renderVocabulary();
}
```

- [ ] **Step 5: Add change handling for multi-select Parts**

Inside the existing `app.addEventListener('change', ...)` handler, add this before the `lesson-filter` branch or after it:

```js
const action = event.target.closest('[data-action]');
if (action?.dataset.action === 'toggle-playback-lesson') {
  updatePlaybackLessons(action.value, action.checked);
  renderVocabulary();
  return;
}
```

- [ ] **Step 6: Render the player on the vocabulary page**

In `renderVocabulary()`, compute playback items after `filtered`:

```js
const playbackItems = buildVocabularyPlaybackItems(vocabulary, playback.lessonIds);
```

Then insert the player section between the header and the vocabulary results:

```js
${renderVocabularyPlayer(playbackItems)}
```

The rendered structure should be:

```js
app.innerHTML = `
  ${header('去重词库', '同一个词只保留一次，但会记录它来自哪些课本。', `
    <div class="toolbar">
      <input id="word-search" class="search-input" type="search" placeholder="搜索英文或中文" value="${escapeHtml(rawQuery)}">
      <select id="lesson-filter" class="select-input" aria-label="筛选课本">
        <option value="all">全部</option>
        ${lessons.map((lesson) => `<option value="${lesson.id}" ${lessonFilter === lesson.id ? 'selected' : ''}>${escapeHtml(lesson.title)}</option>`).join('')}
      </select>
    </div>
    <p class="meta">当前显示 ${filtered.length} 个 / 去重总数 ${vocabulary.length} 个 · ${escapeHtml(selectedLessonTitle)}</p>
  `)}
  ${renderVocabularyPlayer(playbackItems)}
  <section class="section-band vocabulary-results">
    <div class="list two-col">
      ${filtered.map(wordCard).join('') || empty('没有找到匹配词汇')}
    </div>
  </section>
`;
```

- [ ] **Step 7: Add player render helpers**

Add these helpers near `lessonScopeControl`:

```js
function renderVocabularyPlayer(items) {
  const supported = canSpeak();
  const current = items[playback.index] || items[0] || null;
  const disabled = !supported || !items.length;
  const status = current
    ? `${playback.index + 1} / ${items.length}`
    : `0 / ${items.length}`;
  const sourceLabel = current?.sources?.length ? current.sources.map(sourceTitle).join('、') : '暂无来源';

  return `
    <section class="section-band audio-player" aria-label="词库在线播放">
      <div class="audio-player-copy">
        <p class="eyebrow">Audio</p>
        <h2>在线播放</h2>
        <p class="meta">按去重词朗读：英文、中文、英文。</p>
      </div>
      ${renderPlaybackScopeOptions()}
      <div class="audio-now">
        <div>
          <div class="word-en">${escapeHtml(current?.en || '暂无词汇')}</div>
          <div class="word-cn">${escapeHtml(current?.cn || '中文释义待补充')}</div>
          <p class="meta">${escapeHtml(sourceLabel)} · ${escapeHtml(status)}</p>
        </div>
        <span class="pill">${playback.loop ? '循环' : '单轮'}</span>
      </div>
      ${supported ? '' : '<p class="feedback bad">当前浏览器不支持语音朗读。</p>'}
      <div class="audio-controls" role="group" aria-label="播放控制">
        <button class="icon-button" type="button" data-action="previous-vocabulary-word" ${disabled ? 'disabled' : ''} aria-label="上一个词">‹</button>
        <button class="primary-button" type="button" data-action="play-vocabulary-audio" ${disabled || playback.playing ? 'disabled' : ''}>播放</button>
        <button class="secondary-button" type="button" data-action="pause-vocabulary-audio" ${disabled || !playback.playing ? 'disabled' : ''}>暂停</button>
        <button class="icon-button" type="button" data-action="next-vocabulary-word" ${disabled ? 'disabled' : ''} aria-label="下一个词">›</button>
        <button class="ghost-button ${playback.loop ? 'active-toggle' : ''}" type="button" data-action="toggle-vocabulary-loop" aria-pressed="${playback.loop ? 'true' : 'false'}">循环</button>
      </div>
    </section>
  `;
}

function renderPlaybackScopeOptions() {
  const selected = new Set(playback.lessonIds);
  const allSelected = selected.has('all');
  const options = [
    { id: 'all', label: '全部' },
    ...lessons.map((lesson) => ({ id: lesson.id, label: sourceTitle(lesson.id) })),
  ];

  return `
    <div class="playback-scope" aria-label="在线播放课本范围">
      ${options.map((option) => `
        <label class="check-pill">
          <input
            type="checkbox"
            data-action="toggle-playback-lesson"
            value="${escapeAttr(option.id)}"
            ${allSelected ? option.id === 'all' ? 'checked' : '' : selected.has(option.id) ? 'checked' : ''}
          >
          <span>${escapeHtml(option.label)}</span>
        </label>
      `).join('')}
    </div>
  `;
}
```

- [ ] **Step 8: Add lesson-selection state helper**

Add this helper after `renderPlaybackScopeOptions()`:

```js
function updatePlaybackLessons(lessonId, checked) {
  stopVocabularyPlayback({ rerender: false });

  if (lessonId === 'all') {
    playback.lessonIds = ['all'];
    playback.index = 0;
    playback.phase = 'idle';
    return;
  }

  const selected = new Set(playback.lessonIds.includes('all') ? [] : playback.lessonIds);
  if (checked) {
    selected.add(lessonId);
  } else {
    selected.delete(lessonId);
  }

  playback.lessonIds = selected.size ? Array.from(selected) : ['all'];
  playback.index = 0;
  playback.phase = 'idle';
}
```

- [ ] **Step 9: Run static UI tests and verify the UI tests still fail only on speech functions or CSS**

Run:

```bash
node --test tests/ui-static.test.mjs
```

Expected: FAIL remains until Task 4 and Task 5 add speech functions and CSS. Failures should no longer mention missing player controls or multi-select state.

### Task 4: Speech Playback Controls

**Files:**
- Modify: `assets/js/app.js`

- [ ] **Step 1: Add speech capability and queue helpers**

Add these helpers near `speak(text)`:

```js
function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

function currentPlaybackItems() {
  return buildVocabularyPlaybackItems(vocabulary, playback.lessonIds);
}

function normalizePlaybackIndex(items) {
  if (!items.length) {
    playback.index = 0;
    return;
  }
  playback.index = Math.max(0, Math.min(playback.index, items.length - 1));
}
```

- [ ] **Step 2: Add start, pause, stop, and move functions**

Add these helpers before `speak(text)`:

```js
function startVocabularyPlayback() {
  if (!canSpeak()) return;
  const items = currentPlaybackItems();
  normalizePlaybackIndex(items);
  if (!items.length) return;

  playback.playing = true;
  playback.phase = 'en';
  playback.token += 1;
  window.speechSynthesis.cancel();
  renderVocabulary();
  speakPlaybackPhase(playback.token, 0);
}

function pauseVocabularyPlayback() {
  stopVocabularyPlayback({ rerender: route === 'vocabulary' });
}

function stopVocabularyPlayback(options = {}) {
  const rerender = options.rerender === true;
  playback.playing = false;
  playback.phase = 'idle';
  playback.token += 1;
  if (canSpeak()) window.speechSynthesis.cancel();
  if (rerender) renderVocabulary();
}

function moveVocabularyPlayback(direction) {
  const items = currentPlaybackItems();
  if (!items.length) return;

  stopVocabularyPlayback({ rerender: false });
  const nextIndex = playback.index + direction;
  if (nextIndex < 0) {
    playback.index = playback.loop ? items.length - 1 : 0;
  } else if (nextIndex >= items.length) {
    playback.index = playback.loop ? 0 : items.length - 1;
  } else {
    playback.index = nextIndex;
  }
  renderVocabulary();
}
```

- [ ] **Step 3: Add phase-by-phase speech orchestration**

Add these helpers before `speak(text)`:

```js
function speakPlaybackPhase(token, phaseIndex) {
  if (!playback.playing || token !== playback.token) return;

  const items = currentPlaybackItems();
  normalizePlaybackIndex(items);
  const item = items[playback.index];
  const phase = PLAYBACK_PHASES[phaseIndex];

  if (!item || !phase) {
    finishPlaybackWord(token);
    return;
  }

  const text = phase.field === 'cn' ? item.cn : item.en;
  if (!text && phase.field === 'cn') {
    speakPlaybackPhase(token, phaseIndex + 1);
    return;
  }
  if (!text) {
    finishPlaybackWord(token);
    return;
  }

  playback.phase = phase.field;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = phase.lang;
  utterance.rate = phase.rate;
  utterance.onend = () => {
    if (!playback.playing || token !== playback.token) return;
    if (phaseIndex < PLAYBACK_PHASES.length - 1) {
      speakPlaybackPhase(token, phaseIndex + 1);
      return;
    }
    finishPlaybackWord(token);
  };
  utterance.onerror = () => {
    if (token !== playback.token) return;
    stopVocabularyPlayback({ rerender: route === 'vocabulary' });
  };
  window.speechSynthesis.speak(utterance);
}

function finishPlaybackWord(token) {
  if (!playback.playing || token !== playback.token) return;

  const items = currentPlaybackItems();
  const atLast = playback.index >= items.length - 1;
  if (atLast && !playback.loop) {
    stopVocabularyPlayback({ rerender: route === 'vocabulary' });
    return;
  }

  playback.index = atLast ? 0 : playback.index + 1;
  playback.phase = 'en';
  if (route === 'vocabulary') renderVocabulary();
  speakPlaybackPhase(token, 0);
}
```

- [ ] **Step 4: Stop playlist playback before one-off speech**

Replace the beginning of `speak(text)`:

```js
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
```

with:

```js
function speak(text) {
  stopVocabularyPlayback({ rerender: false });
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
```

Keep the existing `SpeechSynthesisUtterance` setup below it:

```js
const utterance = new SpeechSynthesisUtterance(text);
utterance.lang = 'en-US';
utterance.rate = 0.82;
window.speechSynthesis.speak(utterance);
```

- [ ] **Step 5: Run static UI tests and verify failures now only mention CSS if CSS is still missing**

Run:

```bash
node --test tests/ui-static.test.mjs
```

Expected: any remaining failure should be for missing `.audio-player` CSS if Task 5 has not run yet.

### Task 5: Player Styling

**Files:**
- Modify: `assets/css/style.css`

- [ ] **Step 1: Add CSS for the player panel**

Add these rules after `.vocabulary-results, .wrongbook-results`:

```css
.audio-player {
  display: grid;
  gap: 14px;
}

.audio-player-copy h2 {
  margin-bottom: 6px;
}

.playback-scope {
  display: flex;
  gap: 8px;
  margin: 0 -2px;
  padding: 2px 2px 6px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.playback-scope::-webkit-scrollbar {
  display: none;
}

.check-pill {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 10px;
  border: 1px solid rgba(156, 103, 71, 0.2);
  border-radius: 999px;
  background: rgba(255, 250, 242, 0.68);
  color: var(--soil);
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 800;
}

.check-pill input {
  accent-color: var(--clay);
}

.audio-now {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 14px;
  border: 1px solid rgba(232, 207, 181, 0.72);
  border-radius: 24px 18px 28px 20px / 18px 26px 20px 28px;
  background: rgba(247, 231, 207, 0.72);
}

.audio-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.audio-controls .primary-button,
.audio-controls .secondary-button,
.audio-controls .ghost-button {
  min-width: 96px;
  padding: 0 14px;
}

.active-toggle {
  border-color: rgba(208, 138, 97, 0.46);
  background: rgba(208, 138, 97, 0.16);
  color: var(--earth);
}
```

- [ ] **Step 2: Add small-screen control layout**

Inside `@media (max-width: 420px)`, add:

```css
.audio-now {
  grid-template-columns: minmax(0, 1fr);
}

.audio-controls {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) minmax(0, 1fr) 44px;
}

.audio-controls .ghost-button {
  grid-column: 1 / -1;
}
```

- [ ] **Step 3: Run static UI tests and verify they pass**

Run:

```bash
node --test tests/ui-static.test.mjs
```

Expected: PASS for all static UI tests.

- [ ] **Step 4: Commit the UI and styling**

Run:

```bash
git add tests/ui-static.test.mjs assets/js/app.js assets/css/style.css
git commit -m "Add vocabulary audio player UI"
```

Expected: commit succeeds with the static UI tests, app UI, and player CSS included.

### Task 6: Full Verification

**Files:**
- No file changes expected.

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: all tests pass with exit code 0.

- [ ] **Step 2: Start the local preview server**

Run:

```bash
npm run preview
```

Expected: local preview starts and prints a localhost URL. Keep the server running for browser verification.

- [ ] **Step 3: Manual browser verification**

Open the preview URL and check these cases:

```text
1. Go to 词库.
2. Confirm 在线播放 panel appears above the vocabulary list.
3. Press 播放 with 全部 selected.
4. Confirm the current item is read English, Chinese, English.
5. Press 暂停 and confirm speech stops while the same item remains visible.
6. Select two Parts and confirm the count/status changes to that deduplicated union.
7. Press 下一个 and 上一个 and confirm the visible current word changes.
8. Turn 循环 on and confirm the loop badge changes to 循环.
9. Navigate to 今日 or 课本 and confirm speech stops.
```

- [ ] **Step 4: Stop the preview server**

Stop the running preview process with `Ctrl-C`.

Expected: the process exits cleanly.

- [ ] **Step 5: Check git status**

Run:

```bash
git status --short
```

Expected: no uncommitted changes.
