# Lesson-Scoped Daily Study Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lesson-scoped Today study plans, a lesson detail start action, a restrained visual refresh, and mobile/GitHub Pages readiness.

**Architecture:** Keep the existing static app shape. The scheduling API in `assets/js/study-engine.js` accepts an optional `lessonId` and filters the already-deduplicated vocabulary before prioritizing review, wrong, and new words. `assets/js/app.js` stores the selected scope in settings and renders scope-aware Today, Study, and Lesson Detail flows.

**Tech Stack:** Browser JavaScript modules, localStorage, CSS, Node built-in test runner, static GitHub Pages deployment.

---

### Task 1: Lesson-Scoped Study Engine

**Files:**
- Modify: `tests/study-engine.test.mjs`
- Modify: `assets/js/study-engine.js`

- [ ] **Step 1: Write failing tests for lesson scope filtering**

Add these tests to `tests/study-engine.test.mjs` before the `evaluateWordProgress` tests:

```js
test('buildDailyPlan limits new words to the selected lesson source', () => {
  const vocab = [
    { key: 'teacher', sources: ['part-1'], firstLessonOrder: 1, firstSeenOrder: 0 },
    { key: 'coffee', sources: ['part-2'], firstLessonOrder: 2, firstSeenOrder: 1 },
    { key: 'watch tv', sources: ['part-2'], firstLessonOrder: 2, firstSeenOrder: 2 },
  ];

  const plan = buildDailyPlan({
    vocabulary: vocab,
    progress: {},
    today: '2026-06-03',
    limit: 10,
    lessonId: 'part-2',
  });

  assert.equal(plan.lessonId, 'part-2');
  assert.equal(plan.totalAvailable, 2);
  assert.deepEqual(plan.items.map((item) => item.key), ['coffee', 'watch tv']);
  assert.deepEqual(plan.counts, { review: 0, wrong: 0, new: 2 });
});

test('buildDailyPlan filters due review and wrong words to the selected lesson', () => {
  const vocab = [
    { key: 'teacher', sources: ['part-1'], firstLessonOrder: 1, firstSeenOrder: 0 },
    { key: 'coffee', sources: ['part-2'], firstLessonOrder: 2, firstSeenOrder: 1 },
    { key: 'watch tv', sources: ['part-2'], firstLessonOrder: 2, firstSeenOrder: 2 },
    { key: 'student', sources: ['part-1'], firstLessonOrder: 1, firstSeenOrder: 3 },
  ];
  const progress = {
    teacher: { status: 'review', dueDate: '2026-06-02', wrongCount: 0 },
    coffee: { status: 'review', dueDate: '2026-06-01', wrongCount: 0 },
    'watch tv': { status: 'mastered', dueDate: null, wrongCount: 2 },
    student: { status: 'learning', dueDate: '2026-06-04', wrongCount: 3 },
  };

  const plan = buildDailyPlan({
    vocabulary: vocab,
    progress,
    today: '2026-06-03',
    limit: 10,
    lessonId: 'part-2',
  });

  assert.deepEqual(plan.items.map((item) => item.key), ['coffee', 'watch tv']);
  assert.deepEqual(plan.counts, { review: 1, wrong: 1, new: 0 });
});

test('buildDailyPlan keeps all-lesson behavior and includes multi-source words in matching lessons', () => {
  const vocab = [
    { key: 'teacher', sources: ['part-1', 'part-2'], firstLessonOrder: 1, firstSeenOrder: 0 },
    { key: 'coffee', sources: ['part-2'], firstLessonOrder: 2, firstSeenOrder: 1 },
    { key: 'fish', sources: ['part-3'], firstLessonOrder: 3, firstSeenOrder: 2 },
  ];

  const scoped = buildDailyPlan({
    vocabulary: vocab,
    progress: {},
    today: '2026-06-03',
    limit: 10,
    lessonId: 'part-2',
  });
  const all = buildDailyPlan({
    vocabulary: vocab,
    progress: {},
    today: '2026-06-03',
    limit: 10,
    lessonId: 'all',
  });

  assert.deepEqual(scoped.items.map((item) => item.key), ['teacher', 'coffee']);
  assert.equal(scoped.totalAvailable, 2);
  assert.deepEqual(all.items.map((item) => item.key), ['teacher', 'coffee', 'fish']);
  assert.equal(all.totalAvailable, 3);
});
```

- [ ] **Step 2: Run the engine tests and verify the new tests fail**

Run: `node --test tests/study-engine.test.mjs`

Expected: the new tests fail because `buildDailyPlan` does not yet return `lessonId` or `totalAvailable`, and does not filter by selected lesson.

- [ ] **Step 3: Implement lesson scope support**

Update `buildDailyPlan` in `assets/js/study-engine.js` to accept `lessonId = 'all'`, derive `scopedVocabulary`, use that scoped list in all three priority buckets, and return `lessonId` plus `totalAvailable`.

```js
export function buildDailyPlan({ vocabulary, progress = {}, today = todayKey(), limit = 15, lessonId = 'all' }) {
  const remaining = Number(limit) || 15;
  const scopeId = lessonId || 'all';
  const scopedVocabulary = scopeId === 'all'
    ? vocabulary
    : vocabulary.filter((item) => item.sources?.includes(scopeId));
  const selected = [];
  const selectedKeys = new Set();

  const dueReview = scopedVocabulary
    .filter((item) => {
      const state = progress[item.key];
      return state && state.status === 'review' && state.dueDate <= today;
    })
    .sort(sortByDueThenLesson(progress));

  const wrong = scopedVocabulary
    .filter((item) => {
      const state = progress[item.key];
      return state && state.wrongCount > 0 && !isSelected(selectedKeys, item);
    })
    .sort((a, b) => (progress[b.key]?.wrongCount || 0) - (progress[a.key]?.wrongCount || 0) || sortByLessonOrder(a, b));

  const fresh = scopedVocabulary
    .filter((item) => {
      const state = progress[item.key];
      return !state || state.status === 'new';
    })
    .sort(sortByLessonOrder);

  const counts = { review: 0, wrong: 0, new: 0 };
  takeItems(dueReview, remaining, 'review');
  takeItems(wrong, remaining, 'wrong');
  takeItems(fresh, remaining, 'new');

  function takeItems(items, max, type) {
    for (const item of items) {
      if (selected.length >= max) break;
      if (selectedKeys.has(item.key)) continue;
      selected.push({ ...item, planType: type });
      selectedKeys.add(item.key);
      counts[type] += 1;
    }
  }

  return { date: today, limit: remaining, lessonId: scopeId, totalAvailable: scopedVocabulary.length, counts, items: selected };
}
```

- [ ] **Step 4: Run engine tests and verify they pass**

Run: `node --test tests/study-engine.test.mjs`

Expected: all engine tests pass.

### Task 2: Scope-Aware UI State And Actions

**Files:**
- Modify: `tests/ui-static.test.mjs`
- Modify: `assets/js/app.js`

- [ ] **Step 1: Write failing static UI tests**

Add these tests to `tests/ui-static.test.mjs`:

```js
test('today page stores and renders the selected daily lesson scope', async () => {
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /dailyLessonId: 'all'/);
  assert.match(appSource, /data-action="set-daily-lesson"/);
  assert.match(appSource, /function lessonScopeControl\(/);
  assert.match(appSource, /buildDailyPlan\(\{ vocabulary, progress, today: todayKey\(\), limit: settings\.dailyLimit, lessonId: currentDailyLessonId\(\) \}\)/);
});

test('lesson detail can start a daily plan scoped to that lesson', async () => {
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /data-action="start-lesson-daily"/);
  assert.match(appSource, /function startLessonDaily\(lessonId\)/);
  assert.match(appSource, /startDaily\(settings\.dailyLimit, lessonId\)/);
});

test('study session and empty states keep lesson scope metadata', async () => {
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /lessonId: plan\.lessonId/);
  assert.match(appSource, /scopeTitle\(session\.lessonId\)/);
  assert.match(appSource, /data-action="switch-all-lessons"/);
});
```

- [ ] **Step 2: Run static UI tests and verify they fail**

Run: `node --test tests/ui-static.test.mjs`

Expected: the new tests fail because the scope control, lesson action, and session metadata are not implemented yet.

- [ ] **Step 3: Implement settings, action handlers, and scoped start**

Modify `assets/js/app.js`:

- Initialize settings with `{ dailyLimit: 15, dailyLessonId: 'all' }`.
- Add click handling for `set-daily-lesson`, `start-lesson-daily`, and `switch-all-lessons`.
- Change `startDaily(limit)` to `startDaily(limit, lessonId = currentDailyLessonId())`.
- Store `lessonId`, `scopeLabel`, and `planCounts` on `session`.
- Persist `settings.dailyLessonId` whenever the scope changes.

- [ ] **Step 4: Implement scope-aware render helpers**

Add helpers in `assets/js/app.js`:

```js
function currentDailyLessonId() {
  return lessons.some((lesson) => lesson.id === settings.dailyLessonId) ? settings.dailyLessonId : 'all';
}

function scopedVocabulary(lessonId = currentDailyLessonId()) {
  return lessonId === 'all' ? vocabulary : vocabulary.filter((item) => item.sources.includes(lessonId));
}

function scopeTitle(lessonId = currentDailyLessonId()) {
  if (lessonId === 'all') return '全部课本';
  return sourceTitle(lessonId);
}

function setDailyLesson(lessonId) {
  settings.dailyLessonId = lessons.some((lesson) => lesson.id === lessonId) ? lessonId : 'all';
  saveJson(SETTINGS_KEY, settings);
}
```

Use these helpers in `renderHome`, `getStats`, and `nextNewLabel`.

- [ ] **Step 5: Run static UI tests and verify they pass**

Run: `node --test tests/ui-static.test.mjs`

Expected: all static UI tests pass.

### Task 3: Today Page And Lesson Detail Rendering

**Files:**
- Modify: `assets/js/app.js`

- [ ] **Step 1: Render the Today scope control**

In `renderHome`, render `lessonScopeControl(currentDailyLessonId())` inside the hero. The helper should output buttons with `data-action="set-daily-lesson"` and `data-lesson-id`.

- [ ] **Step 2: Update Today stats and labels**

In `renderHome`, compute:

```js
const lessonId = currentDailyLessonId();
const stats = getStats(lessonId);
const plan = buildDailyPlan({ vocabulary, progress, today: todayKey(), limit: settings.dailyLimit, lessonId });
```

Use `plan.totalAvailable` for the deduplicated count, and show text naming the selected scope.

- [ ] **Step 3: Add lesson detail start action**

In `renderLessonDetail`, add a primary `学习本课` button with `data-action="start-lesson-daily"` and `data-lesson-id="${lesson.id}"` next to the existing Back button.

- [ ] **Step 4: Add scoped empty state actions**

When a session has no items, render an empty state naming the selected scope. Include:

```html
<button class="primary-button" type="button" data-action="switch-all-lessons">切到全部课本</button>
<button class="ghost-button" type="button" data-action="back" data-route="lessons">看课本</button>
```

### Task 4: Visual Refresh And Mobile Layout

**Files:**
- Modify: `assets/css/style.css`

- [ ] **Step 1: Add glass and breathing tokens**

Add CSS variables for glass panels, active glow, and safe-area padding.

- [ ] **Step 2: Style scope controls**

Add `.scope-strip`, `.scope-button`, and active/focus states. Use horizontal overflow on mobile.

- [ ] **Step 3: Refresh panels and navigation**

Update `.hero-band`, `.section-band`, `.study-card`, `.bottom-nav`, and main buttons with restrained glass and shadow. Preserve readability.

- [ ] **Step 4: Add reduced-motion handling**

Add:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 5: Add mobile fit rules**

Ensure `.topbar`, `.study-form`, `.stats-grid`, `.button-row.three`, and long text can fit on 390 px mobile widths.

### Task 5: GitHub Pages Safety

**Files:**
- Create: `.gitignore`
- Create: `.nojekyll`

- [ ] **Step 1: Add `.gitignore`**

Create `.gitignore`:

```gitignore
.superpowers/
node_modules/
.DS_Store
```

- [ ] **Step 2: Add `.nojekyll`**

Create an empty `.nojekyll` file so GitHub Pages treats the project as plain static files.

### Task 6: Verification

**Files:**
- No code changes unless verification finds a root cause.

- [ ] **Step 1: Run full automated tests**

Run: `npm test`

Expected: study engine tests pass.

Run: `node --test tests/ui-static.test.mjs`

Expected: static UI tests pass.

- [ ] **Step 2: Start local preview**

Run: `npm run preview`

Expected: local static server starts and prints a localhost URL.

- [ ] **Step 3: Browser mobile verification**

Use the browser at the local preview URL. Check at mobile widths around 390 px and 430 px:

- Today scope control fits.
- Lesson detail action buttons fit.
- Study flow can start from a selected lesson.
- Input forms and bottom nav do not collide.
- No obvious console-breaking errors.

- [ ] **Step 4: Report GitHub Pages steps**

Report that the project can be uploaded to GitHub and published from `main` / `/(root)`, and remind that `.superpowers/` is ignored.
