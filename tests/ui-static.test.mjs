import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('lesson cards are clickable, focusable controls', async () => {
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /<button class="lesson-item lesson-card-button" type="button" data-action="lesson"/);
  assert.doesNotMatch(appSource, /<button class="icon-button" type="button" data-action="lesson"/);
  assert.match(appSource, /app\.addEventListener\('keydown'/);
});

test('lesson detail adapts raw lesson vocabulary before rendering word cards', async () => {
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /wordCard\(\{ \.\.\.item, key: normalizeTermKey\(item\.en\), sources: \[lesson\.id\] \}\)/);
});

test('vocabulary lesson filter uses stable state and change events', async () => {
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /let vocabularyFilters = \{ query: '', lessonId: 'all' \};/);
  assert.match(appSource, /app\.addEventListener\('input', \(event\) => \{[\s\S]*event\.target\.id === 'word-search'[\s\S]*vocabularyFilters\.query = event\.target\.value;/);
  assert.match(appSource, /app\.addEventListener\('change', \(event\) => \{[\s\S]*event\.target\.id === 'lesson-filter'[\s\S]*vocabularyFilters\.lessonId = event\.target\.value;/);
});

test('vocabulary page reports filtered and total word counts', async () => {
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /当前显示 \$\{filtered\.length\} 个/);
  assert.match(appSource, /去重总数 \$\{vocabulary\.length\} 个/);
});

test('study answers advance automatically when correct and only pause on errors', async () => {
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /if \(name === 'choose-answer'\) checkChoice\(action\.dataset\.answer\);/);
  assert.match(appSource, /if \(correct\) \{\s*recordStage\(true\);\s*advance\(\);\s*return;\s*\}/);
  assert.match(appSource, /showStageError\(`正确答案：/);
  assert.doesNotMatch(appSource, /function renderStudyWithContinue/);
});

test('study error feedback supports retry and continue without double-recording', async () => {
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /if \(name === 'retry-stage'\) retryStage\(\);/);
  assert.match(appSource, /if \(name === 'continue-after-feedback'\) continueAfterFeedback\(\);/);
  assert.match(appSource, /function continueAfterFeedback\(\) \{\s*if \(!session\) return;\s*advance\(\);\s*\}/);
  assert.match(appSource, /data-action="retry-stage"/);
  assert.match(appSource, /data-action="continue-after-feedback"/);
});

test('dictation and fillblank inputs are optimized for fast mobile entry', async () => {
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /class="answer-input" name="answer" autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="done" autofocus/);
  assert.match(appSource, /class="study-form"/);
  assert.match(appSource, />确认<\/button>/);
});

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
