import { lessons } from '../../data/lessons.js';
import {
  buildDailyPlan,
  buildGeneratedSentenceItems,
  buildVocabularyPlaybackItems,
  buildVocabularyIndex,
  buildWordPracticeItems,
  evaluateWordProgress,
  isAnswerMatch,
  normalizeTermKey,
  todayKey,
  WRONG_CLEAR_CORRECT_COUNT,
} from './study-engine.js';

const STORAGE_KEY = 'english_learning_v2_progress';
const SETTINGS_KEY = 'english_learning_v2_settings';
const DRILL_PROGRESS_KEY = 'english_learning_v2_drill_progress';
const STAGES = ['listen', 'choice', 'dictation', 'fillblank'];

const app = document.querySelector('#app');
const navButtons = Array.from(document.querySelectorAll('.nav-button'));
const vocabulary = buildVocabularyIndex(lessons);
const wordPracticeItems = buildWordPracticeItems(lessons);
const sentencePracticeItems = buildGeneratedSentenceItems(lessons);

let route = 'home';
let activeLessonId = null;
let activeFeedback = null;
let session = null;
let drillSession = null;
let progress = loadJson(STORAGE_KEY, {});
let settings = loadJson(SETTINGS_KEY, { dailyLimit: 15, dailyLessonId: 'all' });
let drillProgress = normalizeDrillProgress(loadJson(DRILL_PROGRESS_KEY, emptyDrillProgress()));
let vocabularyFilters = { query: '', lessonId: 'all' };
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
const PLAYBACK_GAP_MS = 1000;

render();

navButtons.forEach((button) => {
  button.addEventListener('click', () => {
    navigate(button.dataset.route);
    activeFeedback = null;
    session = null;
    drillSession = null;
    setActiveNav();
    render();
  });
});

app.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]');
  if (!action) return;

  const { action: name } = action.dataset;
  if (name === 'start-daily') startDaily(Number(action.dataset.limit));
  if (name === 'start-custom') startDaily(Number(document.querySelector('#custom-limit')?.value || 15));
  if (name === 'set-daily-lesson') {
    setDailyLesson(action.dataset.lessonId);
    render();
  }
  if (name === 'start-lesson-daily') startLessonDaily(action.dataset.lessonId);
  if (name === 'switch-all-lessons') {
    setDailyLesson('all');
    navigate('home');
    activeFeedback = null;
    session = null;
    drillSession = null;
    render();
  }
  if (name === 'next-stage') nextStage();
  if (name === 'choose-answer') {
    action.blur();
    checkChoice(action.dataset.answer);
  }
  if (name === 'retry-stage') retryStage();
  if (name === 'continue-after-feedback') continueAfterFeedback();
  if (name === 'open-wrongbook') {
    navigate('wrongbook');
    activeFeedback = null;
    render();
  }
  if (name === 'start-wrong-practice') startWrongPractice();
  if (name === 'speak') speak(action.dataset.text);
  if (name === 'lesson') {
    activeLessonId = action.dataset.lessonId;
    navigate('lesson-detail');
    render();
  }
  if (name === 'practice-grammar') renderGrammarPractice();
  if (name === 'practice-questions') renderQuestionPractice();
  if (name === 'start-word-learning') startWordLearning();
  if (name === 'start-word-practice') startWordPractice();
  if (name === 'start-sentence-learning') startSentenceLearning();
  if (name === 'start-sentence-practice') startSentencePractice();
  if (name === 'next-drill') nextDrillItem();
  if (name === 'restart-drill') restartDrillPractice();
  if (name === 'reset-progress') resetProgress();
  if (name === 'play-vocabulary-audio') startVocabularyPlayback();
  if (name === 'pause-vocabulary-audio') pauseVocabularyPlayback();
  if (name === 'previous-vocabulary-word') moveVocabularyPlayback(-1);
  if (name === 'next-vocabulary-word') moveVocabularyPlayback(1);
  if (name === 'toggle-vocabulary-loop') {
    playback.loop = !playback.loop;
    renderVocabulary();
  }
  if (name === 'back') {
    navigate(action.dataset.route || 'home');
    activeFeedback = null;
    drillSession = null;
    render();
  }
  setActiveNav();
});

app.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const action = event.target.closest('[data-action]');
  if (!action || action.tagName === 'BUTTON') return;
  event.preventDefault();
  action.click();
});

document.addEventListener('keydown', handleDrillShortcut);

app.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;
  if (form.dataset.form === 'dictation') {
    checkTextAnswer(form, currentItem().en);
  }
  if (form.dataset.form === 'fillblank') {
    checkTextAnswer(form, currentFillBlank().answer);
  }
  if (form.dataset.form === 'translation') {
    const item = form.dataset.index ? allTranslations()[Number(form.dataset.index)] : null;
    checkPracticeAnswer(form, item?.en || '');
  }
  if (form.dataset.form === 'drill-practice') {
    checkDrillAnswer(form);
  }
});

app.addEventListener('input', (event) => {
  if (event.target.id === 'word-search') {
    vocabularyFilters.query = event.target.value;
    renderVocabulary();
  }
  if (event.target.id === 'drill-answer') {
    updateDrillSlots(event.target.value);
  }
});

app.addEventListener('change', (event) => {
  const action = event.target.closest('[data-action]');
  if (action?.dataset.action === 'toggle-playback-lesson') {
    updatePlaybackLessons(action.value, action.checked);
    renderVocabulary();
    return;
  }
  if (event.target.id === 'lesson-filter') {
    vocabularyFilters.lessonId = event.target.value;
    renderVocabulary();
  }
});

function render() {
  if (route === 'home') renderHome();
  if (route === 'lessons') renderLessons();
  if (route === 'lesson-detail') renderLessonDetail();
  if (route === 'vocabulary') renderVocabulary();
  if (route === 'practice') renderPractice();
  if (route === 'wrongbook') renderWrongBook();
  if (route === 'study') renderStudy();
}

function renderHome() {
  const lessonId = currentDailyLessonId();
  const stats = getStats(lessonId);
  const plan = buildDailyPlan({ vocabulary, progress, today: todayKey(), limit: settings.dailyLimit, lessonId: currentDailyLessonId() });
  const scopeName = scopeTitle(lessonId);

  app.innerHTML = `
    <section class="hero-band">
      <p class="eyebrow">English Learning</p>
      <h1>今日学习</h1>
      <p class="lead">按当前范围推进新词，同时自动插入本范围内的错词和到期复习词。</p>
      ${lessonScopeControl(lessonId)}
      <p class="scope-note">当前：${escapeHtml(scopeName)} · 复习、错词、新词都${lessonId === 'all' ? '来自全部课本' : '只来自本课'}。</p>
      <div class="stats-grid">
        ${statBlock(plan.totalAvailable, '去重词汇')}
        ${statBlock(stats.mastered, '已掌握')}
        ${statBlock(plan.items.length, '今日可学')}
      </div>
    </section>

    <section class="section-band">
      <h2>开始今天</h2>
      <div class="button-row three">
        <button class="primary-button" type="button" data-action="start-daily" data-limit="15">15 个</button>
        <button class="secondary-button" type="button" data-action="start-daily" data-limit="25">25 个</button>
        <button class="ghost-button" type="button" data-action="start-custom">自定义</button>
      </div>
      <div class="toolbar" style="margin-top:12px">
        <input id="custom-limit" class="search-input" type="number" min="5" max="80" value="${escapeHtml(settings.dailyLimit)}" aria-label="自定义数量">
      </div>
      <p class="meta">今日建议：复习 ${plan.counts.review}，错词 ${plan.counts.wrong}，新词 ${plan.counts.new}。</p>
    </section>

    <section class="section-band">
      <h2>学习进度</h2>
      <div class="list">
        <div class="practice-item">
          <strong>课本主线</strong>
          <p class="meta">${escapeHtml(nextNewLabel(lessonId))}</p>
        </div>
        <div class="practice-item">
          <strong>延迟复习</strong>
          <p class="meta">当天学会后，明天、3 天后、7 天后继续复习；都答对才算掌握。</p>
        </div>
      </div>
    </section>
  `;
}

function renderLessons() {
  app.innerHTML = `
    ${header('课本目录', '6 个 Part 按原课本顺序排列。')}
    <section class="list">
      ${lessons.map((lesson) => `
        <button class="lesson-item lesson-card-button" type="button" data-action="lesson" data-lesson-id="${lesson.id}" aria-label="打开 ${escapeHtml(lesson.title)}">
          <div>
            <h3>${escapeHtml(lesson.title)}</h3>
            <p class="meta">${escapeHtml(lesson.focus)}</p>
            <div class="pill-row">
              <span class="pill">${scopedVocabulary(lesson.id).length} 个词/短语</span>
              <span class="pill">${lesson.sentences.length} 个句子</span>
              <span class="pill">${lesson.questions.length} 个问答</span>
            </div>
          </div>
          <span class="icon-button lesson-arrow" aria-hidden="true">›</span>
        </button>
      `).join('')}
    </section>
  `;
}

function renderLessonDetail() {
  const lesson = lessons.find((item) => item.id === activeLessonId) || lessons[0];
  app.innerHTML = `
    <div class="topbar">
      <div>
        <p class="eyebrow">Lesson</p>
        <h1>${escapeHtml(lesson.title)}</h1>
      </div>
      <div class="topbar-actions">
        <button class="primary-button" type="button" data-action="start-lesson-daily" data-lesson-id="${lesson.id}">学习本课</button>
        <button class="ghost-button" type="button" data-action="back" data-route="lessons">返回</button>
      </div>
    </div>
    <section class="section-band">
      <h2>语法</h2>
      <div class="list">
        ${lesson.grammar.map((item) => `
          <article class="practice-item">
            <h3>${escapeHtml(item.title)}</h3>
            <p class="meta">${escapeHtml(item.explanation)}</p>
            <div class="pill-row">${item.patterns.map((pattern) => `<span class="pill">${escapeHtml(pattern)}</span>`).join('')}</div>
          </article>
        `).join('')}
      </div>
    </section>
    <section class="section-band">
      <h2>词汇</h2>
      <div class="list two-col">
        ${scopedVocabulary(lesson.id).slice(0, 80).map((item) => wordCard(item)).join('')}
      </div>
    </section>
    <section class="section-band">
      <h2>课文句子</h2>
      <div class="list">
        ${lesson.sentences.map((sentence) => `
          <article class="practice-item sentence">
            ${escapeHtml(sentence)}
            <button class="icon-button" type="button" data-action="speak" data-text="${escapeAttr(sentence)}" aria-label="朗读句子">▶</button>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function renderVocabulary() {
  const rawQuery = vocabularyFilters.query || '';
  const query = normalizeTermKey(rawQuery);
  const lessonFilter = vocabularyFilters.lessonId || 'all';
  const selectedLessonTitle = lessonFilter === 'all' ? '全部课本' : sourceTitle(lessonFilter);
  const filtered = vocabulary.filter((item) => {
    const matchesQuery = !query || item.key.includes(query) || normalizeTermKey(item.cn).includes(query);
    const matchesLesson = lessonFilter === 'all' || item.sources.includes(lessonFilter);
    return matchesQuery && matchesLesson;
  });
  const playbackItems = buildVocabularyPlaybackItems(vocabulary, playback.lessonIds);

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
}

function renderPractice() {
  const stats = getStats();
  const drillStats = getDrillStats();
  const wordPracticeReady = canPracticeWords();
  const sentencePracticeReady = canPracticeSentences();
  app.innerHTML = `
    ${header('综合练习', '单词和句子分开学习；先学习，才可以进入对应练习。')}
    <section class="section-band">
      <div class="list">
        <article class="practice-item">
          <h3>单词学习</h3>
          <p class="meta">全课本去重词汇 ${wordPracticeItems.length} 个，已记住 ${drillStats.learnedWords} 个。</p>
          <button class="primary-button" type="button" data-action="start-word-learning">开始学习</button>
        </article>
        <article class="practice-item">
          <h3>单词练习</h3>
          <p class="meta">${wordPracticeReady ? `练已学习的 ${drillStats.learnedWords} 个单词。` : '先完成单词学习，才能进入单词练习。'}</p>
          <button class="secondary-button" type="button" data-action="start-word-practice" ${wordPracticeReady ? '' : 'disabled'}>开始练习</button>
        </article>
        <article class="practice-item">
          <h3>句子学习</h3>
          <p class="meta">用全课本词汇生成新句子 ${sentencePracticeItems.length} 句，已学习 ${drillStats.learnedSentences} 句。</p>
          <button class="primary-button" type="button" data-action="start-sentence-learning">开始学习</button>
        </article>
        <article class="practice-item">
          <h3>句子练习</h3>
          <p class="meta">${sentencePracticeReady ? `练已学习的 ${drillStats.learnedSentences} 个句子。` : '先完成句子学习，才能进入句子练习。'}</p>
          <button class="secondary-button" type="button" data-action="start-sentence-practice" ${sentencePracticeReady ? '' : 'disabled'}>开始练习</button>
        </article>
        <article class="practice-item">
          <h3>语法填空</h3>
          <p class="meta">从所有课本的语法填空中抽题。</p>
          <button class="secondary-button" type="button" data-action="practice-grammar">开始</button>
        </article>
        <article class="practice-item">
          <h3>问答练习</h3>
          <p class="meta">回答课本里的口语问题，可先听问题再自己说。</p>
          <button class="secondary-button" type="button" data-action="practice-questions">开始</button>
        </article>
        <article class="practice-item">
          <h3>记录</h3>
          <p class="meta">已掌握 ${stats.mastered} 个，学习中 ${stats.learning} 个，错题 ${stats.wrong} 个，到期复习 ${stats.due} 个。</p>
          <button class="danger-button" type="button" data-action="reset-progress">清除本机进度</button>
        </article>
      </div>
    </section>
  `;
}

function renderWrongBook() {
  const items = wrongVocabulary();
  app.innerHTML = `
    ${header('错题汇总', `错题答对 ${WRONG_CLEAR_CORRECT_COUNT} 次后会自动移出。`, `
      <div class="toolbar">
        <button class="primary-button" type="button" data-action="start-wrong-practice" ${items.length ? '' : 'disabled'}>练这些错题</button>
        <span class="pill">${items.length} 个错题</span>
      </div>
    `)}
    <section class="section-band wrongbook-results">
      <div class="list two-col">
        ${items.map(wordCard).join('') || empty('暂时没有错题。')}
      </div>
    </section>
  `;
}

function renderStudy() {
  if (!session || session.items.length === 0) {
    const lessonId = session?.lessonId || currentDailyLessonId();
    app.innerHTML = `
      ${header('今日学习', `${scopeTitle(lessonId)} 今天没有可安排的新词或复习词。`)}
      <section class="section-band">
        ${empty('可以切到全部课本，或者去课本和词库自由复习。')}
        <div class="button-row" style="margin-top:14px">
          <button class="primary-button" type="button" data-action="switch-all-lessons">切到全部课本</button>
          <button class="ghost-button" type="button" data-action="back" data-route="lessons">看课本</button>
        </div>
      </section>
    `;
    return;
  }

  const item = currentItem();
  const stage = STAGES[session.stageIndex];
  const percent = Math.round(((session.index + session.stageIndex / STAGES.length) / session.items.length) * 100);
  const sessionScopeTitle = scopeTitle(session.lessonId);

  app.innerHTML = `
    <div class="topbar">
      <div>
        <p class="eyebrow">${escapeHtml(sessionScopeTitle)} · 今日 ${session.index + 1} / ${session.items.length}</p>
        <h1>${stageTitle(stage)}</h1>
      </div>
      <button class="ghost-button" type="button" data-action="back" data-route="home">退出</button>
    </div>
    <div class="progress-line"><span style="width:${percent}%"></span></div>
    <section class="study-card">
      ${renderStage(stage, item)}
      ${activeFeedback ? feedbackBlock(activeFeedback) : ''}
    </section>
  `;
  focusStudyInput();
}

function renderStage(stage, item) {
  if (stage === 'listen') {
    return `
      <div class="word-pair">
        <div class="word-en">${escapeHtml(item.en)}</div>
        <div class="word-cn">${escapeHtml(item.cn || '中文释义待补充')}</div>
        <p class="meta">来源：${item.sources.map(sourceTitle).join('、')} · ${escapeHtml(item.category || '词汇')}</p>
      </div>
      <div class="button-row" style="margin-top:14px">
        <button class="primary-button" type="button" data-action="speak" data-text="${escapeAttr(item.en)}">美式跟读</button>
        <button class="ghost-button" type="button" data-action="next-stage">我读完了</button>
      </div>
    `;
  }

  if (stage === 'choice') {
    return `
      <p class="meta">选择正确中文</p>
      <div class="prompt">${escapeHtml(item.en)}</div>
      <div class="choice-grid">
        ${choiceOptions(item).map((option) => `
          <button class="choice-button" type="button" data-action="choose-answer" data-answer="${escapeAttr(option)}">${escapeHtml(option)}</button>
        `).join('')}
      </div>
    `;
  }

  if (stage === 'dictation') {
    return `
      <p class="meta">根据中文默写英文</p>
      <div class="prompt cn">${escapeHtml(item.cn || item.en)}</div>
      <form class="study-form" data-form="dictation">
        <input class="answer-input" name="answer" autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="done" autofocus placeholder="输入英文">
        <button class="primary-button" type="submit">确认</button>
      </form>
    `;
  }

  const fill = currentFillBlank();
  return `
    <p class="meta">课文句子填空</p>
    <div class="prompt">${escapeHtml(fill.question)}</div>
    <form class="study-form" data-form="fillblank">
      <input class="answer-input" name="answer" autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="done" autofocus placeholder="补全空格">
      <button class="primary-button" type="submit">确认</button>
    </form>
  `;
}

function renderGrammarPractice() {
  const questions = allFillBlanks().slice(0, 12);
  app.innerHTML = `
    ${practiceHeader('语法填空', '答错会看到正确答案，可以反复练。')}
    <section class="section-band">
      <div class="list">
        ${questions.map((item, index) => `
          <article class="practice-item">
            <p class="prompt">${escapeHtml(item.q.replace('___', '_____'))}</p>
            <form data-form="inline-blank" data-index="${index}" onsubmit="window.EnglishApp.checkInlineBlank(event, '${escapeAttr(item.a)}')">
              <input class="answer-input" name="answer" autocomplete="off" placeholder="${escapeAttr(item.hint || '输入答案')}">
              <button class="primary-button" type="submit">检查</button>
              <div class="feedback" hidden></div>
            </form>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function renderQuestionPractice() {
  const questions = allQuestions().slice(0, 20);
  app.innerHTML = `
    ${practiceHeader('问答练习', '点朗读，自己口头回答；也可以写下答案。')}
    <section class="section-band">
      <div class="list">
        ${questions.map((question) => `
          <article class="practice-item">
            <p class="prompt">${escapeHtml(question)}</p>
            <div class="button-row">
              <button class="primary-button" type="button" data-action="speak" data-text="${escapeAttr(question)}">朗读</button>
              <button class="ghost-button" type="button" onclick="this.closest('article').querySelector('textarea').focus()">回答</button>
            </div>
            <textarea class="answer-input" placeholder="写下你的回答，或者直接口头回答"></textarea>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function startWordLearning() {
  startDrillSession('word', 'learn', wordPracticeItems);
}

function startWordPractice() {
  const learned = learnedWordKeys();
  const items = wordPracticeItems.filter((item) => learned.has(item.key));
  if (!items.length) {
    renderDrillLocked('单词练习', '先完成单词学习，才能进入单词练习。', 'start-word-learning', '去学习单词');
    return;
  }
  startDrillSession('word', 'practice', shuffle(items).slice(0, 24));
}

function startSentenceLearning() {
  startDrillSession('sentence', 'learn', sentencePracticeItems);
}

function startSentencePractice() {
  const learned = learnedSentenceIds();
  const items = sentencePracticeItems.filter((item) => learned.has(item.id));
  if (!items.length) {
    renderDrillLocked('句子练习', '先完成句子学习，才能进入句子练习。', 'start-sentence-learning', '去学习句子');
    return;
  }
  startDrillSession('sentence', 'practice', shuffle(items).slice(0, 24));
}

function startDrillSession(type, mode, items) {
  drillSession = {
    type,
    mode,
    items,
    index: 0,
    feedback: null,
  };
  renderDrillPractice();
}

function renderDrillLocked(title, text, action, label) {
  app.innerHTML = `
    ${practiceHeader(title, text)}
    <section class="section-band">
      <div class="practice-item">
        <h3>还不能练习</h3>
        <p class="meta">${escapeHtml(text)}</p>
        <div class="button-row" style="margin-top:12px">
          <button class="primary-button" type="button" data-action="${action}">${escapeHtml(label)}</button>
          <button class="ghost-button" type="button" data-action="back" data-route="practice">返回练习</button>
        </div>
      </div>
    </section>
  `;
}

function renderDrillPractice() {
  if (!drillSession || !drillSession.items.length) {
    app.innerHTML = `
      ${practiceHeader(drillTitle(), '题库里暂时没有可学习的内容。')}
      <section class="section-band">
        ${empty('可以先去课本页查看已有词汇和句子。')}
      </section>
    `;
    return;
  }

  const item = currentDrillItem();
  const feedback = drillSession.feedback;
  const answered = feedback?.type === 'ok';
  const learning = drillSession.mode === 'learn';
  const progressLabel = `${drillSession.index + 1} / ${drillSession.items.length}`;
  const detail = `${drillTypeLabel()} · ${sourceTitle(item.lessonId)}`;

  app.innerHTML = `
    ${practiceHeader(drillTitle(), `第 ${progressLabel} 题 · ${detail}`)}
    <section class="section-band word-sentence-panel">
      <article class="word-sentence-card">
        <div class="word-sentence-cn">${escapeHtml(item.cn)}</div>
        ${answerSlots(item.en, learning || answered)}
        ${item.type === 'sentence' ? `<p class="meta drill-source">课本词汇：${item.tokens.map((token) => escapeHtml(token)).join(' / ')}</p>` : ''}
        ${learning ? drillLearnActions() : drillPracticeForm(answered)}
        ${feedback ? drillFeedback(feedback) : ''}
      </article>
    </section>
  `;
  answered ? focusDrillNext() : focusDrillInput();
}

function drillPracticeForm(answered) {
  return answered ? '' : `
    <form class="study-form word-sentence-form" data-form="drill-practice">
      <input id="drill-answer" class="answer-input" name="answer" autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="done" autofocus placeholder="输入完整英文">
      <button class="primary-button" type="submit">提交</button>
    </form>
  `;
}

function drillLearnActions() {
  return `
    <div class="feedback-actions">
      <button class="primary-button" type="button" data-action="next-drill">记住了</button>
    </div>
  `;
}

function renderDrillComplete() {
  const type = drillSession?.type || 'word';
  const learning = drillSession?.mode === 'learn';
  const practiceAction = type === 'word' ? 'start-word-practice' : 'start-sentence-practice';
  const completedTitle = type === 'word' ? '单词学习完成' : '句子学习完成';
  const title = learning ? completedTitle : `${drillTypeLabel()}练习完成`;
  const text = learning ? '已经记住本轮内容，可以开始练习。' : '可以再来一轮，或回到综合练习。';

  app.innerHTML = `
    ${practiceHeader(title, text)}
    <section class="section-band">
      <div class="practice-item">
        <h3>完成一轮</h3>
        <p class="meta">${escapeHtml(text)}</p>
        <div class="button-row" style="margin-top:12px">
          <button class="primary-button" type="button" data-action="${learning ? practiceAction : 'restart-drill'}">${learning ? '开始练习' : '再练一轮'}</button>
          <button class="ghost-button" type="button" data-action="back" data-route="practice">返回练习</button>
        </div>
      </div>
    </section>
  `;
}

function currentDrillItem() {
  return drillSession.items[drillSession.index];
}

function checkDrillAnswer(form) {
  if (!drillSession) return;
  const item = currentDrillItem();
  const answer = new FormData(form).get('answer');

  if (!normalizeTermKey(answer)) {
    drillSession.feedback = { type: 'bad', text: '先输入答案再提交。' };
    renderDrillPractice();
    return;
  }

  if (isAnswerMatch(item.en, answer)) {
    drillSession.feedback = { type: 'ok', text: '回答正确。' };
    launchConfetti();
    renderDrillPractice();
    return;
  }

  drillSession.feedback = { type: 'bad', text: `参考答案：${item.en}` };
  renderDrillPractice();
}

function nextDrillItem() {
  if (!drillSession) return;
  if (drillSession.mode === 'learn') rememberDrillItem(currentDrillItem());
  drillSession.index += 1;
  drillSession.feedback = null;

  if (drillSession.index >= drillSession.items.length) {
    renderDrillComplete();
    return;
  }

  renderDrillPractice();
}

function restartDrillPractice() {
  if (!drillSession) {
    renderPractice();
    return;
  }
  if (drillSession.type === 'sentence') {
    startSentencePractice();
    return;
  }
  startWordPractice();
}

function answerSlots(answer, reveal = false) {
  return `
    <div class="answer-slots" aria-label="英文答案">
      ${answerTokens(answer).map((token) => `
        <span class="answer-slot ${reveal ? 'filled' : ''}">${reveal ? escapeHtml(token) : ''}</span>
      `).join('')}
    </div>
  `;
}

function drillFeedback(feedback) {
  return `
    <div class="feedback ${feedback.type}">
      <p>${escapeHtml(feedback.text)}</p>
      ${feedback.type === 'ok' ? `
        <div class="feedback-actions">
          <button class="primary-button" type="button" data-action="next-drill">下一题</button>
        </div>
      ` : ''}
    </div>
  `;
}

function updateDrillSlots(value) {
  const typedTokens = answerTokens(value);
  app.querySelectorAll('.answer-slot').forEach((slot, index) => {
    const token = typedTokens[index] || '';
    slot.textContent = token;
    slot.classList.toggle('filled', Boolean(token));
  });
}

function startDaily(limit, lessonId = currentDailyLessonId()) {
  settings.dailyLimit = limit;
  setDailyLesson(lessonId);
  saveJson(SETTINGS_KEY, settings);
  const plan = buildDailyPlan({ vocabulary, progress, today: todayKey(), limit, lessonId: currentDailyLessonId() });
  session = {
    items: plan.items,
    index: 0,
    stageIndex: 0,
    results: {},
    lessonId: plan.lessonId,
    scopeLabel: scopeTitle(plan.lessonId),
    planCounts: plan.counts,
  };
  activeFeedback = null;
  navigate('study');
  render();
}

function startLessonDaily(lessonId) {
  startDaily(settings.dailyLimit, lessonId);
}

function startWrongPractice() {
  const items = wrongVocabulary().slice(0, 25);
  if (!items.length) {
    navigate('wrongbook');
    render();
    return;
  }
  session = {
    items: items.map((item) => ({ ...item, planType: 'wrong' })),
    index: 0,
    stageIndex: 0,
    results: {},
  };
  activeFeedback = null;
  navigate('study');
  render();
}

function currentItem() {
  return session.items[session.index];
}

function nextStage() {
  if (!session) return;
  recordStage(true);
  advance();
}

function checkChoice(answer) {
  const item = currentItem();
  const correct = answer === item.cn;
  if (correct) {
    recordStage(true);
    advance();
    return;
  }
  recordStage(false);
  showStageError(`正确答案：${item.cn}`);
}

function checkTextAnswer(form, expected) {
  const answer = new FormData(form).get('answer');
  if (!normalizeTermKey(answer)) {
    showStageError('先输入答案再确认。', { canContinue: false });
    return;
  }
  const correct = isAnswerMatch(expected, answer);
  if (correct) {
    recordStage(true);
    advance();
    return;
  }
  recordStage(false);
  showStageError(`正确答案：${expected}`);
}

function checkPracticeAnswer(form, expected) {
  const answer = new FormData(form).get('answer');
  const feedback = form.querySelector('.feedback');
  const correct = isAnswerMatch(expected, answer);
  feedback.hidden = false;
  feedback.className = `feedback ${correct ? 'ok' : 'bad'}`;
  feedback.textContent = correct ? '回答正确。' : `参考答案：${expected}`;
}

function checkInlineBlank(event, expected) {
  event.preventDefault();
  checkPracticeAnswer(event.currentTarget, expected);
}

function showStageError(text, options = {}) {
  activeFeedback = {
    type: 'bad',
    text,
    canContinue: options.canContinue !== false,
  };
  render();
}

function retryStage() {
  activeFeedback = null;
  render();
}

function continueAfterFeedback() {
  if (!session) return;
  advance();
}

function recordStage(correct) {
  const item = currentItem();
  const stage = STAGES[session.stageIndex];
  if (!session.results[item.key]) {
    session.results[item.key] = { correct: true, stages: [] };
  }
  session.results[item.key].correct = session.results[item.key].correct && correct;
  if (!session.results[item.key].stages.includes(stage)) {
    session.results[item.key].stages.push(stage);
  }
}

function advance() {
  activeFeedback = null;
  if (session.stageIndex < STAGES.length - 1) {
    session.stageIndex += 1;
    render();
    return;
  }

  const item = currentItem();
  const result = session.results[item.key] || { correct: true, stages: STAGES };
  progress[item.key] = evaluateWordProgress(progress[item.key], {
    correct: result.correct,
    today: todayKey(),
    completedStages: result.stages,
  });
  saveJson(STORAGE_KEY, progress);

  session.index += 1;
  session.stageIndex = 0;
  if (session.index >= session.items.length) {
    navigate('home');
    session = null;
  }
  render();
}

function currentFillBlank() {
  const item = currentItem();
  const lesson = lessons.find((candidate) => item.sources.includes(candidate.id));
  const sentence = (lesson?.sentences || []).find((line) => normalizeTermKey(line).includes(item.key));
  if (!sentence) {
    return { question: `Please write: ${item.cn || item.en} = _____`, answer: item.en };
  }
  const escaped = escapeRegExp(item.en);
  const question = sentence.replace(new RegExp(escaped, 'i'), '_____');
  return question === sentence
    ? { question: `Please write: ${item.cn || item.en} = _____`, answer: item.en }
    : { question, answer: item.en };
}

function choiceOptions(item) {
  const options = new Set([item.cn || item.en]);
  const pool = vocabulary.filter((candidate) => candidate.key !== item.key && candidate.cn);
  while (options.size < 4 && pool.length) {
    const index = Math.floor(Math.random() * pool.length);
    options.add(pool.splice(index, 1)[0].cn);
  }
  return shuffle(Array.from(options));
}

function wordCard(item) {
  const status = progress[item.key]?.status || 'new';
  const label = isWrongItem(item.key) ? `错题 ${wrongCorrectCount(item.key)} / ${WRONG_CLEAR_CORRECT_COUNT}` : statusLabel(status);
  return `
    <article class="word-item">
      <div class="word-en">${escapeHtml(item.en)}</div>
      <div class="word-cn">${escapeHtml(item.cn || '中文释义待补充')}</div>
      <p class="meta">${item.sources.map(sourceTitle).join('、')} · ${escapeHtml(label)}</p>
      <button class="icon-button" type="button" data-action="speak" data-text="${escapeAttr(item.en)}" aria-label="朗读 ${escapeAttr(item.en)}">▶</button>
    </article>
  `;
}

function header(title, subtitle, extraContent = '') {
  const extra = String(extraContent || '').trim();
  return `
    <div class="topbar sticky-titlebar${extra ? ' stacked-titlebar' : ''}">
      <div class="titlebar-copy">
        <p class="eyebrow">Study</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="lead">${escapeHtml(subtitle)}</p>
      </div>
      ${extra ? `<div class="titlebar-controls">${extra}</div>` : ''}
    </div>
  `;
}

function practiceHeader(title, subtitle) {
  return `
    <div class="topbar">
      <div>
        <p class="eyebrow">Study</p>
        <h1>${escapeHtml(title)}</h1>
        <p class="lead">${escapeHtml(subtitle)}</p>
      </div>
      <button class="ghost-button" type="button" data-action="back" data-route="practice">退出</button>
    </div>
  `;
}

function statBlock(number, label) {
  return `<div class="stat"><span class="stat-number">${number}</span><span class="stat-label">${escapeHtml(label)}</span></div>`;
}

function feedbackBlock(feedback) {
  return `
    <div class="feedback ${feedback.type === 'ok' ? 'ok' : 'bad'}">
      <p>${escapeHtml(feedback.text)}</p>
      <div class="feedback-actions">
        <button class="primary-button" type="button" data-action="retry-stage">再试一次</button>
        ${feedback.canContinue ? '<button class="ghost-button" type="button" data-action="continue-after-feedback">继续</button>' : ''}
      </div>
    </div>
  `;
}

function empty(text) {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function getStats(lessonId = 'all') {
  const words = scopedVocabulary(lessonId);
  const wordKeys = new Set(words.map((item) => item.key));
  const scopedStates = Object.entries(progress)
    .filter(([key]) => wordKeys.has(key))
    .map(([, state]) => state);
  const due = words.filter((item) => progress[item.key]?.status === 'review' && progress[item.key]?.dueDate <= todayKey()).length;
  return {
    total: words.length,
    mastered: scopedStates.filter((item) => item.status === 'mastered' || item.status === 'review').length,
    learning: scopedStates.filter((item) => item.status === 'learning').length,
    wrong: wrongVocabulary(lessonId).length,
    due,
  };
}

function getDrillStats() {
  return {
    learnedWords: learnedWordKeys().size,
    learnedSentences: learnedSentenceIds().size,
  };
}

function canPracticeWords() {
  return learnedWordKeys().size > 0;
}

function canPracticeSentences() {
  return learnedSentenceIds().size > 0;
}

function learnedWordKeys() {
  return new Set(drillProgress.learnedWords);
}

function learnedSentenceIds() {
  return new Set(drillProgress.learnedSentences);
}

function rememberDrillItem(item) {
  if (item.type === 'word') {
    const learned = learnedWordKeys();
    learned.add(item.key);
    drillProgress.learnedWords = wordPracticeItems
      .map((word) => word.key)
      .filter((key) => learned.has(key));
  } else {
    const learned = learnedSentenceIds();
    learned.add(item.id);
    drillProgress.learnedSentences = sentencePracticeItems
      .map((sentence) => sentence.id)
      .filter((id) => learned.has(id));
  }
  saveDrillProgress();
}

function saveDrillProgress() {
  drillProgress = normalizeDrillProgress(drillProgress);
  saveJson(DRILL_PROGRESS_KEY, drillProgress);
}

function emptyDrillProgress() {
  return { learnedWords: [], learnedSentences: [] };
}

function normalizeDrillProgress(value) {
  const progressValue = value && typeof value === 'object' ? value : {};
  return {
    learnedWords: Array.isArray(progressValue.learnedWords) ? progressValue.learnedWords.filter(Boolean) : [],
    learnedSentences: Array.isArray(progressValue.learnedSentences) ? progressValue.learnedSentences.filter(Boolean) : [],
  };
}

function drillTitle() {
  if (!drillSession) return '练习';
  return `${drillTypeLabel()}${drillSession.mode === 'learn' ? '学习' : '练习'}`;
}

function drillTypeLabel() {
  return drillSession?.type === 'sentence' ? '句子' : '单词';
}

function nextNewLabel(lessonId = 'all') {
  const next = scopedVocabulary(lessonId).find((item) => !progress[item.key] || progress[item.key].status === 'new');
  return next ? `下一个新词：${next.en}（${next.cn || '待补充'}）` : '所有词都已经进入学习记录。';
}

function allFillBlanks() {
  return lessons.flatMap((lesson) => lesson.fillBlanks.map((item) => ({ ...item, lessonId: lesson.id })));
}

function allTranslations() {
  return lessons.flatMap((lesson) => lesson.translations.map((item) => ({ ...item, lessonId: lesson.id })));
}

function allQuestions() {
  return lessons.flatMap((lesson) => lesson.questions);
}

function wrongVocabulary(lessonId = 'all') {
  return scopedVocabulary(lessonId).filter((item) => isWrongItem(item.key));
}

function isWrongItem(key) {
  return (progress[key]?.wrongCount || 0) > 0;
}

function wrongCorrectCount(key) {
  return Math.min(progress[key]?.wrongCorrectCount || 0, WRONG_CLEAR_CORRECT_COUNT);
}

function sourceTitle(id) {
  return lessons.find((lesson) => lesson.id === id)?.title.replace(/:.*/, '') || id;
}

function currentDailyLessonId() {
  return lessons.some((lesson) => lesson.id === settings.dailyLessonId) ? settings.dailyLessonId : 'all';
}

function scopedVocabulary(lessonId = currentDailyLessonId()) {
  return lessonId === 'all'
    ? vocabulary
    : vocabulary
      .filter((item) => item.sources.includes(lessonId))
      .map((item) => applySourceDetails(item, lessonId));
}

function scopeTitle(lessonId = currentDailyLessonId()) {
  if (lessonId === 'all') return '全部课本';
  return sourceTitle(lessonId);
}

function setDailyLesson(lessonId) {
  settings.dailyLessonId = lessons.some((lesson) => lesson.id === lessonId) ? lessonId : 'all';
  saveJson(SETTINGS_KEY, settings);
}

function lessonScopeControl(activeLessonId) {
  const options = [
    { id: 'all', label: '全部课本' },
    ...lessons.map((lesson) => ({ id: lesson.id, label: sourceTitle(lesson.id) })),
  ];

  return `
    <div class="scope-strip" role="group" aria-label="今日学习范围">
      ${options.map((option) => `
        <button
          class="scope-button ${option.id === activeLessonId ? 'active' : ''}"
          type="button"
          data-action="set-daily-lesson"
          data-lesson-id="${option.id}"
          aria-pressed="${option.id === activeLessonId ? 'true' : 'false'}"
        >${escapeHtml(option.label)}</button>
      `).join('')}
    </div>
  `;
}

function renderVocabularyPlayer(items) {
  const supported = canSpeak();
  const current = items[playback.index] || items[0] || null;
  const disabled = !supported || !items.length;
  const status = current ? `${playback.index + 1} / ${items.length}` : `0 / ${items.length}`;
  const sourceLabel = current?.sources?.length ? current.sources.map(sourceTitle).join('、') : '暂无来源';

  return `
    <section class="audio-player section-band">
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
    { id: 'all', label: '全部课本' },
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

function applySourceDetails(item, lessonId) {
  const details = item.sourceDetails?.[lessonId];
  if (!details) return item;

  return {
    ...item,
    cn: details.cn || item.cn,
    category: details.category || item.category,
    examples: details.examples || item.examples,
    firstLessonOrder: details.lessonOrder ?? item.firstLessonOrder,
    firstSeenOrder: details.lessonItemOrder ?? item.firstSeenOrder,
    lessonItemOrder: details.lessonItemOrder ?? item.lessonItemOrder,
  };
}

function statusLabel(status) {
  return {
    new: '未学',
    learning: '学习中',
    review: '待复习',
    mastered: '已掌握',
  }[status] || '未学';
}

function stageTitle(stage) {
  return {
    listen: '跟读',
    choice: '选择',
    dictation: '默写',
    fillblank: '填空',
  }[stage];
}

function speak(text) {
  stopVocabularyPlayback({ rerender: false });
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.82;
  window.speechSynthesis.speak(utterance);
}

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

function stopVocabularyPlayback(options = {}) {
  const rerender = options.rerender === true;
  playback.playing = false;
  playback.phase = 'idle';
  playback.token += 1;
  if (canSpeak()) window.speechSynthesis.cancel();
  if (rerender) renderVocabulary();
}

function schedulePlaybackStep(token, callback) {
  window.setTimeout(() => {
    if (!playback.playing || token !== playback.token) return;
    callback();
  }, PLAYBACK_GAP_MS);
}

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
    schedulePlaybackStep(token, () => speakPlaybackPhase(token, phaseIndex + 1));
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
      schedulePlaybackStep(token, () => speakPlaybackPhase(token, phaseIndex + 1));
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
  schedulePlaybackStep(token, () => speakPlaybackPhase(token, 0));
}

function setActiveNav() {
  navButtons.forEach((button) => {
    const active = button.dataset.route === route ||
      (route === 'lesson-detail' && button.dataset.route === 'lessons') ||
      (route === 'study' && button.dataset.route === 'home');
    button.classList.toggle('active', active);
  });
}

function navigate(nextRoute) {
  if (nextRoute !== 'vocabulary') stopVocabularyPlayback({ rerender: false });
  route = nextRoute;
}

function focusStudyInput() {
  queueMicrotask(() => app.querySelector('[autofocus]')?.focus());
}

function focusDrillInput() {
  queueMicrotask(() => app.querySelector('#drill-answer')?.focus());
}

function focusDrillNext() {
  queueMicrotask(() => app.querySelector('[data-action="next-drill"]')?.focus());
}

function handleDrillShortcut(event) {
  if (event.key !== 'Enter') return;
  if (drillSession?.feedback?.type !== 'ok') return;
  const action = event.target?.closest?.('[data-action]');
  if (action && action.dataset.action !== 'next-drill') return;
  if (!action && event.target?.closest?.('button, input, textarea, select, a')) return;
  event.preventDefault();
  nextDrillItem();
}

function answerTokens(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean);
}

function launchConfetti() {
  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  layer.setAttribute('aria-hidden', 'true');

  const colors = ['#d08a61', '#6f8755', '#b78949', '#737d58', '#c97f59', '#fff7ec'];

  for (let index = 0; index < 48; index += 1) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.setProperty('--x', String(Math.round((Math.random() - 0.5) * 720)));
    piece.style.setProperty('--y', String(Math.round(-120 - Math.random() * 420)));
    piece.style.setProperty('--r', String(Math.round(Math.random() * 720 - 360)));
    piece.style.setProperty('--d', `${900 + Math.round(Math.random() * 620)}ms`);
    piece.style.setProperty('--c', colors[index % colors.length]);
    piece.style.left = `${18 + Math.random() * 64}%`;
    piece.style.top = `${48 + Math.random() * 18}%`;
    layer.appendChild(piece);
  }

  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), 1700);
}

function resetProgress() {
  if (!window.confirm('确定清除本机学习进度吗？')) return;
  progress = {};
  drillProgress = emptyDrillProgress();
  saveJson(STORAGE_KEY, progress);
  saveJson(DRILL_PROGRESS_KEY, drillProgress);
  renderPractice();
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function shuffle(items) {
  return items
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
}

window.EnglishApp = {
  checkInlineBlank,
};
