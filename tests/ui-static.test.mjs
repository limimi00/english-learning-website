import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

function sourceSection(source, startPattern, endPattern, label = 'source section') {
  const start = source.search(startPattern);
  assert.notEqual(start, -1, `Expected ${label} to be present`);

  const remaining = source.slice(start);
  const end = remaining.search(endPattern);
  assert.notEqual(end, -1, `Expected ${label} to end before ${endPattern}`);

  return remaining.slice(0, end);
}

test('lesson cards are clickable, focusable controls', async () => {
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /<button class="lesson-item lesson-card-button" type="button" data-action="lesson"/);
  assert.doesNotMatch(appSource, /<button class="icon-button" type="button" data-action="lesson"/);
  assert.match(appSource, /app\.addEventListener\('keydown'/);
});

test('lesson detail renders the lesson-scoped deduplicated vocabulary before word cards', async () => {
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /scopedVocabulary\(lesson\.id\)\.slice\(0, 80\)\.map\(\(item\) => wordCard\(item\)\)/);
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

test('vocabulary page renders audio playback controls for deduplicated words', async () => {
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');
  const cssSource = await readFile(new URL('../assets/css/style.css', import.meta.url), 'utf8');
  const renderVocabularySource = sourceSection(appSource, /function renderVocabulary\(\) \{/, /\nfunction renderPractice\(\)/, 'renderVocabulary() function');

  assert.match(renderVocabularySource, /const playbackItems = buildVocabularyPlaybackItems\(vocabulary, playback\.lessonIds\);/);
  assert.match(renderVocabularySource, /\$\{renderVocabularyPlayer\(playbackItems\)\}/);
  const renderVocabularyPlayerSource = sourceSection(appSource, /function renderVocabularyPlayer\(items\) \{/, /\nfunction /, 'renderVocabularyPlayer(items) function');

  assert.match(renderVocabularyPlayerSource, /class="audio-player/);
  assert.match(renderVocabularyPlayerSource, /data-action="play-vocabulary-audio"/);
  assert.match(renderVocabularyPlayerSource, /data-action="pause-vocabulary-audio"/);
  assert.match(renderVocabularyPlayerSource, /data-action="previous-vocabulary-word"/);
  assert.match(renderVocabularyPlayerSource, /data-action="next-vocabulary-word"/);
  assert.match(renderVocabularyPlayerSource, /data-action="toggle-vocabulary-loop"/);
  assert.match(cssSource, /\.audio-player\s*\{/);
});

test('vocabulary audio player supports all and multi-part selection', async () => {
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');
  const renderPlaybackScopeOptionsSource = sourceSection(appSource, /function renderPlaybackScopeOptions\(\) \{/, /\nfunction /, 'renderPlaybackScopeOptions() function');
  const changeListenerSource = sourceSection(appSource, /app\.addEventListener\('change', \(event\) => \{/, /\n\}\);/, 'change event listener');
  const updatePlaybackLessonsSource = sourceSection(appSource, /function updatePlaybackLessons\([^)]*\) \{/, /\nfunction /, 'updatePlaybackLessons(...) function');

  assert.match(appSource, /let playback = \{[\s\S]*lessonIds: \['all'\]/);
  assert.match(renderPlaybackScopeOptionsSource, /<input[^>]+type="checkbox"[^>]+data-action="toggle-playback-lesson"|<input[^>]+data-action="toggle-playback-lesson"[^>]+type="checkbox"/);
  assert.match(changeListenerSource, /(?:action\?\.dataset\.action|action\.dataset\.action)[\s\S]*'toggle-playback-lesson'[\s\S]*updatePlaybackLessons\(action\.value, action\.checked\)/);

  assert.match(updatePlaybackLessonsSource, /lessonId\s*===\s*'all'/);
  assert.match(updatePlaybackLessonsSource, /\bchecked\b/);
  assert.match(updatePlaybackLessonsSource, /selected\.add\(lessonId\)/);
  assert.match(updatePlaybackLessonsSource, /selected\.delete\(lessonId\)/);
  assert.match(
    updatePlaybackLessonsSource,
    /if\s*\(\s*checked\s*\)\s*(?:\{[\s\S]*?selected\.add\(lessonId\);?[\s\S]*?\}|selected\.add\(lessonId\);?)\s*else\s*(?:\{[\s\S]*?selected\.delete\(lessonId\);?[\s\S]*?\}|selected\.delete\(lessonId\);?)/
  );
  assert.match(
    updatePlaybackLessonsSource,
    /if\s*\(\s*(?:!selected\.size|selected\.size\s*===\s*0|selected\.size\s*<\s*1)\s*\)\s*\{[\s\S]*?playback\.lessonIds\s*=\s*\['all'\]|if\s*\(\s*selected\.size\s*\)\s*\{[\s\S]*?\}\s*else\s*\{[\s\S]*?playback\.lessonIds\s*=\s*\['all'\]|playback\.lessonIds\s*=\s*selected\.size\s*\?[\s\S]*?:\s*\['all'\]/
  );
});

test('vocabulary audio player speaks English Chinese English and stops on navigation', async () => {
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');
  const phaseSource = sourceSection(appSource, /const PLAYBACK_PHASES = \[/, /\n\];/, 'PLAYBACK_PHASES constant');
  const phaseBlocks = Array.from(phaseSource.matchAll(/\{[\s\S]*?\}/g), ([phase]) => phase);
  const phaseEntries = phaseBlocks.map((phase) => ({
    field: phase.match(/field: '([^']+)'/)?.[1],
    lang: phase.match(/lang: '([^']+)'/)?.[1],
  }));
  const navClickSource = sourceSection(appSource, /navButtons\.forEach\(\(button\) => \{/, /\n\}\);\n\napp\.addEventListener\('click'/, 'bottom navigation click handler');
  const appClickSource = sourceSection(appSource, /app\.addEventListener\('click', \(event\) => \{/, /\n\}\);\n\napp\.addEventListener\('keydown'/, 'app click event listener');
  const navigateSource = sourceSection(appSource, /function navigate\(nextRoute\) \{/, /\nfunction /, 'navigate(nextRoute) function');

  assert.deepEqual(phaseEntries, [
    { field: 'en', lang: 'en-US' },
    { field: 'cn', lang: 'zh-CN' },
    { field: 'en', lang: 'en-US' },
  ]);
  const speakPlaybackPhaseSource = sourceSection(appSource, /function speakPlaybackPhase\(token, phaseIndex\) \{/, /\nfunction /, 'speakPlaybackPhase(token, phaseIndex) function');

  assert.match(speakPlaybackPhaseSource, /PLAYBACK_PHASES\[phaseIndex\]/);
  assert.match(speakPlaybackPhaseSource, /new SpeechSynthesisUtterance/);
  assert.match(speakPlaybackPhaseSource, /utterance\.lang\s*=\s*phase\.lang/);
  assert.match(appSource, /function stopVocabularyPlayback\(/);
  assert.match(navClickSource, /navigate\(button\.dataset\.route\);/);
  assert.doesNotMatch(navClickSource, /route\s*=\s*button\.dataset\.route/);
  assert.match(appClickSource, /if \(name === 'switch-all-lessons'\) \{[\s\S]*navigate\('home'\);/);
  assert.match(appClickSource, /if \(name === 'open-wrongbook'\) \{[\s\S]*navigate\('wrongbook'\);/);
  assert.match(appClickSource, /if \(name === 'lesson'\) \{[\s\S]*navigate\('lesson-detail'\);/);
  assert.match(appClickSource, /if \(name === 'back'\) \{[\s\S]*navigate\(action\.dataset\.route \|\| 'home'\);/);
  assert.doesNotMatch(appClickSource, /\broute\s*=(?!=)/);
  assert.match(navigateSource, /nextRoute !== 'vocabulary'/);
  assert.match(navigateSource, /stopVocabularyPlayback/);
});

test('study answers advance automatically when correct and only pause on errors', async () => {
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /if \(name === 'choose-answer'\) \{\s*action\.blur\(\);\s*checkChoice\(action\.dataset\.answer\);\s*\}/);
  assert.match(appSource, /if \(correct\) \{\s*recordStage\(true\);\s*advance\(\);\s*return;\s*\}/);
  assert.match(appSource, /showStageError\(`正确答案：/);
  assert.doesNotMatch(appSource, /function renderStudyWithContinue/);
});

test('choice option hover feedback does not persist on touch screens', async () => {
  const cssSource = await readFile(new URL('../assets/css/style.css', import.meta.url), 'utf8');

  assert.doesNotMatch(cssSource, /\.choice-button:hover,\s*\.choice-button:focus-visible\s*\{/);
  assert.match(cssSource, /@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)\s*\{[\s\S]*\.choice-button:hover\s*\{/);
  assert.match(cssSource, /\.choice-button:focus-visible\s*\{[\s\S]*outline:\s*3px solid rgba\(208, 138, 97, 0\.14\);/);
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

test('dashboard treats reviewed words as mastered for visible progress counts', async () => {
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /item\.status === 'mastered' \|\| item\.status === 'review'/);
  assert.match(appSource, /item\.status === 'learning'\)\.length/);
});

test('wrong book is a bottom navigation destination after practice', async () => {
  const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');

  assert.match(indexSource, /data-route="practice"[\s\S]*<span>练习<\/span>[\s\S]*data-route="wrongbook"/);
  assert.match(indexSource, /<span>错题<\/span>/);
  assert.match(appSource, /button\.dataset\.route === route/);
  assert.doesNotMatch(appSource, /route === 'wrongbook' && button\.dataset\.route === 'practice'/);
});

test('grammar and question practice screens include a top exit action', async () => {
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /practiceHeader\('语法填空'/);
  assert.match(appSource, /practiceHeader\('问答练习'/);
  assert.match(appSource, /data-action="back" data-route="practice">退出<\/button>/);
});

test('practice page separates word and sentence learning from locked practice', async () => {
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');
  const cssSource = await readFile(new URL('../assets/css/style.css', import.meta.url), 'utf8');

  assert.match(appSource, /buildWordPracticeItems\(lessons\)/);
  assert.match(appSource, /buildGeneratedSentenceItems\(lessons\)/);
  assert.match(appSource, /data-action="start-word-learning"/);
  assert.match(appSource, /data-action="start-word-practice"/);
  assert.match(appSource, /data-action="start-sentence-learning"/);
  assert.match(appSource, /data-action="start-sentence-practice"/);
  assert.match(appSource, /function canPracticeWords\(\)/);
  assert.match(appSource, /function canPracticeSentences\(\)/);
  assert.match(appSource, /function startWordLearning\(\)/);
  assert.match(appSource, /function startSentencePractice\(\)/);
  assert.match(appSource, /data-form="drill-practice"/);
  assert.match(appSource, /function checkDrillAnswer\(form\)/);
  assert.match(appSource, /launchConfetti\(\);/);
  assert.doesNotMatch(appSource, /data-action="practice-word-sentence"/);
  assert.match(cssSource, /\.word-sentence-card\s*\{/);
  assert.match(cssSource, /\.answer-slots\s*\{/);
  assert.match(cssSource, /\.confetti-layer\s*\{/);
  assert.match(cssSource, /@keyframes\s+confettiBurst/);
});

test('separated drills advance with Enter after a correct answer', async () => {
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /document\.addEventListener\('keydown', handleDrillShortcut\);/);
  assert.match(appSource, /answered \? focusDrillNext\(\) : focusDrillInput\(\);/);
  assert.match(appSource, /data-action="next-drill"[\s\S]*下一题/);
  assert.match(appSource, /const action = event\.target\?\.closest\?\.\('\[data-action\]'\);[\s\S]*action\.dataset\.action !== 'next-drill'/);
  assert.match(appSource, /function handleDrillShortcut\(event\) \{[\s\S]*event\.key !== 'Enter'[\s\S]*drillSession\?\.feedback\?\.type !== 'ok'[\s\S]*event\.preventDefault\(\);[\s\S]*nextDrillItem\(\);/);
});

test('section title bars stay visible while scrolling on list pages', async () => {
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');
  const cssSource = await readFile(new URL('../assets/css/style.css', import.meta.url), 'utf8');

  assert.match(appSource, /header\('课本目录'/);
  assert.match(appSource, /header\('去重词库'/);
  assert.match(appSource, /header\('综合练习'/);
  assert.match(appSource, /header\('错题汇总'/);
  assert.match(appSource, /class="topbar sticky-titlebar\$\{extra \?/);
  assert.match(cssSource, /\.sticky-titlebar\s*\{[\s\S]*position: sticky;[\s\S]*top: 0;/);
});

test('sticky title panels keep copy away from the panel edge', async () => {
  const cssSource = await readFile(new URL('../assets/css/style.css', import.meta.url), 'utf8');
  const stickyRules = cssSource.match(/\.sticky-titlebar\s*\{(?<rules>[\s\S]*?)\}/)?.groups?.rules || '';

  assert.match(stickyRules, /padding:\s*14px\s+18px\s+16px;/);
  assert.doesNotMatch(stickyRules, /padding:\s*[^;]*\s0(?:px)?\s*;/);
});

test('visual system uses warm organic blob styling', async () => {
  const cssSource = await readFile(new URL('../assets/css/style.css', import.meta.url), 'utf8');

  assert.match(cssSource, /--earth/);
  assert.match(cssSource, /--clay/);
  assert.match(cssSource, /--organic-radius/);
  assert.match(cssSource, /body::before/);
  assert.match(cssSource, /body::after/);
  assert.match(cssSource, /animation:\s*blobBreath/);
  assert.match(cssSource, /@keyframes\s+blobBreath/);
  assert.match(cssSource, /@keyframes\s+organicRadius/);
});

test('content panels use safe organic card radii instead of clipping blob radii', async () => {
  const cssSource = await readFile(new URL('../assets/css/style.css', import.meta.url), 'utf8');
  const heroRules = cssSource.match(/\.hero-band\s*\{(?<rules>[\s\S]*?)\}/)?.groups?.rules || '';
  const studyRules = cssSource.match(/\.study-card\s*\{(?<rules>[\s\S]*?)\}/)?.groups?.rules || '';

  assert.match(heroRules, /border-radius:\s*var\(--organic-card-radius\);/);
  assert.match(studyRules, /border-radius:\s*var\(--organic-card-radius\);/);
  assert.doesNotMatch(heroRules, /animation:\s*organicRadius/);
  assert.doesNotMatch(studyRules, /animation:\s*organicRadius/);
});

test('vocabulary filters and count line live in one fixed title panel', async () => {
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');
  const cssSource = await readFile(new URL('../assets/css/style.css', import.meta.url), 'utf8');

  assert.match(appSource, /header\('去重词库'[\s\S]*<div class="toolbar">[\s\S]*当前显示 \$\{filtered\.length\} 个/);
  assert.match(appSource, /<section class="section-band vocabulary-results">/);
  assert.match(cssSource, /\.stacked-titlebar\s*\{/);
  assert.doesNotMatch(cssSource, /\.sticky-subtitlebar/);
});

test('wrong summary action count row lives in one fixed title panel', async () => {
  const appSource = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');

  assert.match(appSource, /header\('错题汇总'[\s\S]*data-action="start-wrong-practice"[\s\S]*\$\{items\.length\} 个错题/);
  assert.doesNotMatch(appSource, /<h1>错题汇总<\/h1>[\s\S]*data-action="back" data-route="practice">返回<\/button>[\s\S]*<section class="section-band">/);
  assert.match(appSource, /<section class="section-band wrongbook-results">/);
});
