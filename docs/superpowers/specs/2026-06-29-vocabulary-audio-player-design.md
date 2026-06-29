# Vocabulary Audio Player Design

## Summary

Add an online reading player to the deduplicated vocabulary page. The player reads only unique vocabulary items, supports selecting all textbooks or multiple specific textbooks, and reads each item in this sequence:

1. English
2. Chinese
3. English

The feature is scoped to vocabulary words and phrases only. It does not play lesson sentences, generated sentence drills, grammar fill blanks, or questions.

## Goals

- Let learners listen through deduplicated vocabulary without tapping each word.
- Support all textbooks and multi-select textbook scopes.
- Keep repeated English terms deduplicated while still letting a word appear in any selected textbook where it belongs.
- Support continuous playback with an optional loop mode.
- Reuse the existing browser speech synthesis approach where possible.

## Non-Goals

- No server-side audio generation.
- No downloaded audio files or offline audio cache.
- No background playback after leaving the web app or closing the browser tab.
- No sentence playlist in this iteration.
- No per-word progress updates from passive listening.

## User Experience

The player appears on the `去重词库` page near the current search and lesson filter controls.

Controls:

- Textbook scope selector:
  - `全部`
  - one checkbox for each Part
  - multiple Parts can be selected together
- Main playback controls:
  - Play
  - Pause
  - Previous word
  - Next word
  - Loop toggle
- Current playback status:
  - current English term
  - Chinese meaning
  - source Parts
  - position, such as `12 / 180`

Behavior:

- Selecting `全部` plays every deduplicated vocabulary item.
- Selecting one or more Parts plays every deduplicated vocabulary item whose `sources` includes at least one selected Part.
- If a selected Part has a lesson-specific meaning for a repeated English term, the displayed Chinese meaning follows that Part when only one Part is selected. With multiple Parts selected, the player uses the first selected matching Part's source-specific details.
- Pressing Play starts at the currently selected item. If there is no current item, it starts at the first item in the filtered player queue.
- Pressing Pause stops the current utterance and preserves the current item index.
- Pressing Next stops current speech and advances to the next word.
- Pressing Previous stops current speech and moves to the previous word.
- If Loop is enabled, playback wraps from the last item to the first item.
- If Loop is disabled, playback stops after the last item.
- Changing the selected textbooks rebuilds the player queue and resets playback to the first item in the new queue.
- If the user unchecks every Part, the selector automatically returns to `全部`.

## Architecture

### Data

The player uses the existing `vocabulary` value built by `buildVocabularyIndex(lessons)`.

Add a small pure helper in `study-engine.js` to build the player queue:

```js
buildVocabularyPlaybackItems(vocabulary, lessonIds)
```

Inputs:

- `vocabulary`: deduplicated items from `buildVocabularyIndex`.
- `lessonIds`: either `['all']` or an array of selected lesson ids. An empty array is treated as `['all']`.

Output:

- Ordered vocabulary items matching the selected scope.
- Each item keeps `key`, `en`, `cn`, `sources`, `category`, and ordering fields.
- For a single selected lesson, items use that lesson's source-specific details when available.

Ordering:

- Preserve the same textbook order used by the deduplicated vocabulary list.
- For lesson-scoped queues, preserve that lesson's item order through existing source detail ordering.

### UI State

Add a `playback` state object in `app.js`:

```js
let playback = {
  lessonIds: ['all'],
  index: 0,
  playing: false,
  loop: false,
  phase: 'idle'
};
```

The exact shape can be adjusted during implementation, but it should keep these responsibilities separate:

- selected scope
- current index
- playing or stopped state
- loop preference
- current utterance phase

### Speech Flow

Use `window.speechSynthesis` and `SpeechSynthesisUtterance`.

For each vocabulary item, enqueue sequential utterances:

1. `{ text: item.en, lang: 'en-US', rate: 0.82 }`
2. `{ text: item.cn, lang: 'zh-CN', rate: 0.9 }`
3. `{ text: item.en, lang: 'en-US', rate: 0.82 }`

The player should speak one utterance at a time and start the next phase from the `onend` callback. After the third phase, it advances to the next word or stops based on loop and queue position.

Because speech synthesis is browser-managed, playback functions should guard against stale callbacks after the user changes scope, presses Pause, or navigates away. A monotonically increasing playback token or session id is enough.

### Route Changes

When navigating away from the vocabulary page, stop active playback with `speechSynthesis.cancel()` and set `playback.playing = false`.

If the user returns to the vocabulary page in the same session, the selected scope and loop setting can remain in memory.

## Error Handling

- If `speechSynthesis` is unavailable, show a small message in the player area and disable Play.
- If the selected scope has no vocabulary, show an empty state and disable Play, Previous, and Next.
- If a word has no Chinese meaning, read only English twice with a visible `中文释义待补充` label.
- If the browser voice list is not loaded yet, use language codes without requiring a specific voice.

## Testing

### Unit Tests

Add tests for `buildVocabularyPlaybackItems`:

- `['all']` returns all deduplicated vocabulary in order.
- a single Part returns only words whose `sources` includes that Part.
- multiple Parts return the union of matching deduplicated words without duplicates.
- repeated English terms use lesson-specific meaning for single-Part playback.
- empty lesson selection behaves like `['all']`.

### Static UI Tests

Add static tests confirming:

- vocabulary page renders a playback control area.
- Part checkboxes are present for multi-select playback.
- Play, Pause, Previous, Next, and Loop actions exist.
- route changes or navigation actions stop playback.

### Manual Verification

Run the existing test suite:

```bash
npm test
```

Manual browser checks:

- All textbooks playback starts and advances.
- Multiple selected Parts produce a deduplicated union.
- Single Part playback uses that Part's meaning where a repeated term has different meanings.
- Pause stops speech and preserves the current item.
- Next and Previous cancel current speech and move immediately.
- Loop wraps from the last item to the first item.
- Leaving the vocabulary page stops speech.

## Acceptance Criteria

- The vocabulary page has an online reading player.
- The player reads each vocabulary item as English, Chinese, English.
- The player uses only deduplicated vocabulary items.
- The player supports all textbooks and multi-select Part scopes.
- The player supports loop mode.
- Playback can be started, paused, moved forward, and moved backward.
- Speech stops when the user navigates away from the vocabulary page.
- Automated tests cover the queue-building behavior and the visible controls.
