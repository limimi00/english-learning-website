# English Learning Static Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new mobile-first static English learning website that uses structured lesson data, daily word plans, American pronunciation, mixed drills, delayed review, and a local DOCX conversion helper.

**Architecture:** The site is a plain GitHub Pages-friendly static app. Lesson data lives in `data/lessons.js`; reusable learning logic lives in `assets/js/study-engine.js`; UI orchestration lives in `assets/js/app.js`. The local converter in `tools/convert_docx.py` extracts starter data from `.docx` files for future lessons.

**Tech Stack:** HTML, CSS, browser JavaScript, `localStorage`, Web Speech API, Node built-in test runner, Python standard library for DOCX extraction.

---

### Task 1: Core Study Engine

**Files:**
- Create: `assets/js/study-engine.js`
- Create: `tests/study-engine.test.mjs`

- [x] Write tests for vocabulary normalization, deduplication, daily scheduling, progress transitions, and answer comparison.
- [x] Run tests and verify they fail before implementation.
- [ ] Implement the minimal core logic.
- [ ] Run tests and verify they pass.

### Task 2: Lesson Data

**Files:**
- Create: `data/lessons.js`

- [ ] Add structured data for the current six Part files.
- [ ] Preserve lesson order.
- [ ] Mark vocabulary source lessons and categories.
- [ ] Include grammar drills, sentence fill blanks, translations, and speaking questions.

### Task 3: Mobile Static UI

**Files:**
- Create: `index.html`
- Create: `assets/css/style.css`
- Create: `assets/js/app.js`

- [ ] Build the home dashboard with daily 15/25/custom choices.
- [ ] Build a learning flow: follow/read, bilingual view, choice, dictation, sentence fill.
- [ ] Build lesson directory, vocabulary bank, grammar practice, Q&A practice, and review views.
- [ ] Add American pronunciation with `speechSynthesis` and `en-US`.
- [ ] Persist progress in `localStorage`.

### Task 4: DOCX Converter

**Files:**
- Create: `tools/convert_docx.py`

- [ ] Extract text from `.docx` with Python standard library.
- [ ] Detect lesson title, vocabulary-like bullet lines, reading sentences, translation prompts, and questions.
- [ ] Output starter JSON for manual cleanup.

### Task 5: Verification

**Commands:**
- `node --test tests/study-engine.test.mjs`
- `python3 tools/convert_docx.py "Part 1 (am, is, are).docx" --pretty`
- `python3 -m http.server 8080`
- Browser check at `http://127.0.0.1:8080/`

- [ ] Confirm tests pass.
- [ ] Confirm converter returns structured output.
- [ ] Confirm the static app loads locally.
- [ ] Confirm the main mobile flow works without console-breaking errors.
