# Lesson-Scoped Daily Study Design

## Goal

Improve the English learning static site so the Today page can study within a selected lesson scope. When a learner selects a Part, Today should show and start a daily plan from that Part's deduplicated vocabulary only. The change should also improve mobile usability and add a restrained visual refresh with light glassmorphism and subtle breathing feedback.

## Confirmed Decisions

- The selected approach is: Today page scope switcher plus lesson detail page linkage.
- Lesson scope options are `all` and each lesson id, such as `part-1` through `part-6`.
- When a specific lesson is selected, due reviews, wrong words, and fresh words are all limited to deduplicated vocabulary whose `sources` include that lesson id.
- A word that appears in multiple lessons is eligible for any selected lesson listed in its `sources`.
- The selected visual style is light glassmorphism plus subtle breathing, used sparingly.
- The site should remain a static HTML/CSS/JS app suitable for GitHub Pages.

## Current Architecture

The project is a plain static app:

- `data/lessons.js` stores structured lesson content.
- `assets/js/study-engine.js` contains reusable learning logic, including vocabulary deduplication and daily plan scheduling.
- `assets/js/app.js` owns UI state, routing, rendering, localStorage settings, and study sessions.
- `assets/css/style.css` defines mobile-first layout and visual styling.
- `tests/study-engine.test.mjs` covers the learning engine behavior.
- `tests/ui-static.test.mjs` checks important UI source patterns.

There is no Git repository in the current folder, so spec committing cannot be performed until the folder is initialized or moved into a repository.

## Data And State

Extend settings stored under `english_learning_v2_settings`:

```js
{
  dailyLimit: 15,
  dailyLessonId: 'all'
}
```

The app should tolerate existing users whose settings only contain `dailyLimit`. Missing `dailyLessonId` should default to `all`.

No new progress storage key is required. Existing progress remains keyed by normalized vocabulary term.

## Study Engine Design

Add lesson-scope support to `buildDailyPlan`:

```js
buildDailyPlan({
  vocabulary,
  progress,
  today,
  limit,
  lessonId: 'all'
})
```

The engine should derive `scopedVocabulary` before scheduling:

- If `lessonId` is `all` or missing, use the full vocabulary array.
- If `lessonId` is a lesson id, include only items whose `sources` includes that id.

Then run the existing priority order within that scoped list:

1. Due review words.
2. Wrong words.
3. Fresh words.

The returned plan should include enough information for the UI to explain the current scope:

```js
{
  date,
  limit,
  lessonId,
  totalAvailable,
  counts,
  items
}
```

`totalAvailable` is the number of deduplicated terms in the current scope.

## UI Design

### Today Page

Add a compact lesson scope control near the top of the Today page:

- `全部课本`
- `Part 1`
- `Part 2`
- `Part 3`
- `Part 4`
- `Part 5`
- `Part 6`

On mobile, use a horizontally scrollable segmented control or a select-like compact control if width becomes tight. The control must not overlap the hero statistics or bottom navigation.

The Today hero statistics should reflect the selected scope:

- Deduplicated vocabulary count for current scope.
- Mastered count within current scope.
- Today available count from the scoped plan.

The copy should make the scope explicit. For example, when Part 2 is active: `当前：Part 2 · 复习、错词、新词都只来自本课。`

### Start Today

The existing `15`, `25`, and custom flows should call `startDaily(limit, lessonId)` using the current setting. The resulting session should keep its scope metadata so the study screen can show context such as `Part 2 · 今日 1 / 15`.

### Lesson Detail

Add a primary action in the lesson detail top area:

- `学习本课`

Clicking it should:

1. Set `settings.dailyLessonId` to that lesson id.
2. Persist settings.
3. Start a daily plan for that lesson using the current or selected daily limit.

The existing Back action remains available.

### Vocabulary Page

Keep the existing vocabulary lesson filter independent from the Today scope. Filtering the vocabulary list should not silently change the daily study scope. This prevents accidental study scope changes while browsing.

### Empty States

If the selected lesson has no eligible words for Today, show an empty state that names the scope and offers clear next actions:

- Switch to all lessons.
- Browse the selected lesson.
- Open the vocabulary page.

## Visual Refresh

Use a restrained version of glassmorphism and breathing feedback:

- Background: subtle layered light gradient with strong readability.
- Hero and study card: semi-transparent white panels, slightly stronger shadow, `backdrop-filter` only where supported.
- Primary active actions: subtle breathing ring or glow with low opacity.
- Bottom navigation: translucent white panel with a mild blur and safe-area padding.
- Respect `prefers-reduced-motion: reduce` by disabling breathing animation.

Avoid large decorative blobs, busy gradients, or heavy animation. The interface should still feel like a focused learning tool.

## Mobile Layout Requirements

Verify the app at common mobile widths, especially around 390 px and 430 px:

- Today page scope control does not wrap into awkward tall blocks.
- Hero stats stay readable and do not overflow.
- Start buttons remain tappable and do not squeeze text.
- Lesson detail top actions fit without collision.
- Study forms keep the input and confirm button usable.
- Bottom navigation does not cover content or feedback actions.
- Long English phrases and Chinese labels wrap cleanly inside cards.

## Testing Plan

Add or update engine tests:

- `buildDailyPlan` filters fresh words to the selected lesson.
- Due review and wrong words are also filtered by selected lesson.
- `lessonId: 'all'` preserves current global behavior.
- A word with multiple sources appears in plans for any matching lesson.

Add or update static UI tests:

- Settings include `dailyLessonId`.
- Today page renders a lesson scope control.
- Scope changes persist through settings.
- Lesson detail includes a `学习本课` action.
- Starting daily study passes the selected scope to the plan.

Manual or browser verification:

- Run the test suite.
- Serve the static app locally.
- Check desktop and mobile widths.
- Walk through Today scope selection, lesson detail `学习本课`, and a short study session.

## GitHub Pages Notes

The app is suitable for GitHub Pages because it is static and has `index.html` at the project root. After implementation, upload the site files to a GitHub repository and configure Pages to deploy from the `main` branch and `/(root)` folder.

Do not upload temporary brainstorming files from `.superpowers/`. Consider adding `.superpowers/` to `.gitignore` before initializing or uploading the repository.

If GitHub Pages tries to process the site with Jekyll, adding a root `.nojekyll` file is a safe static-site option.
