import test from 'node:test';
import assert from 'node:assert/strict';
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

test('normalizeTermKey keeps phrases stable and ignores case and extra spaces', () => {
  assert.equal(normalizeTermKey('  Teacher  '), 'teacher');
  assert.equal(normalizeTermKey('Watch   TV'), 'watch tv');
  assert.equal(normalizeTermKey('Good-Looking'), 'good-looking');
});

test('normalizeTermKey folds common spelling variants into one study key', () => {
  assert.equal(normalizeTermKey('centre'), 'center');
  assert.equal(normalizeTermKey('shopping centre'), 'shopping center');
  assert.equal(normalizeTermKey('grey'), 'gray');
});

test('buildVocabularyIndex deduplicates by normalized English and preserves lesson sources', () => {
  const lessons = [
    {
      id: 'part-1',
      order: 1,
      vocabulary: [
        { en: 'Teacher', cn: '老师', category: 'people' },
        { en: 'watch TV', cn: '看电视', category: 'daily life' },
      ],
    },
    {
      id: 'part-2',
      order: 2,
      vocabulary: [
        { en: 'teacher', cn: '老师', category: 'people' },
        { en: 'watch  tv', cn: '看电视', category: 'daily life' },
        { en: 'coffee', cn: '咖啡', category: 'food' },
      ],
    },
  ];

  const index = buildVocabularyIndex(lessons);

  assert.equal(index.length, 3);
  assert.deepEqual(index.map((item) => item.key), ['teacher', 'watch tv', 'coffee']);
  assert.deepEqual(index[0].sources, ['part-1', 'part-2']);
  assert.equal(index[0].firstLessonOrder, 1);
});

test('buildVocabularyIndex deduplicates spelling variants within a lesson', () => {
  const lessons = [
    {
      id: 'part-1',
      order: 1,
      vocabulary: [
        { en: 'center', cn: '中心', category: 'places' },
        { en: 'centre', cn: '中心', category: 'places' },
        { en: 'grey', cn: '灰色', category: 'colors' },
        { en: 'gray', cn: '灰色', category: 'colors' },
      ],
    },
  ];

  const index = buildVocabularyIndex(lessons);

  assert.deepEqual(index.map((item) => item.key), ['center', 'gray']);
  assert.deepEqual(index.map((item) => item.en), ['center', 'grey']);
});

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

test('buildDailyPlan prioritizes due review, then wrong words, then new words in lesson order', () => {
  const today = '2026-06-02';
  const vocab = [
    { key: 'a', firstLessonOrder: 1, firstSeenOrder: 0 },
    { key: 'b', firstLessonOrder: 1, firstSeenOrder: 1 },
    { key: 'c', firstLessonOrder: 2, firstSeenOrder: 2 },
    { key: 'd', firstLessonOrder: 2, firstSeenOrder: 3 },
  ];
  const progress = {
    b: { status: 'review', dueDate: '2026-06-01', wrongCount: 0 },
    c: { status: 'learning', dueDate: '2026-06-05', wrongCount: 2 },
    a: { status: 'new', wrongCount: 0 },
  };

  const plan = buildDailyPlan({ vocabulary: vocab, progress, today, limit: 3 });

  assert.deepEqual(plan.items.map((item) => item.key), ['b', 'c', 'a']);
  assert.deepEqual(plan.counts, { review: 1, wrong: 1, new: 1 });
});

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

test('buildWordPracticeItems creates a separate deduplicated word drill list', () => {
  const items = buildWordPracticeItems([
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

  assert.deepEqual(
    items.map((item) => `${item.type}:${item.en}`),
    [
      'word:Teacher',
      'word:centre',
      'word:coffee',
    ],
  );
  assert.equal(items[0].id, 'word-teacher');
  assert.equal(items[0].key, 'teacher');
  assert.equal(items[0].lessonId, 'part-1');
});

test('buildGeneratedSentenceItems uses only tokens that exist in the textbook vocabulary', () => {
  const lessons = [
    {
      id: 'part-1',
      order: 1,
      vocabulary: [
        { en: 'I', cn: '我', category: 'pronouns and be' },
        { en: 'you', cn: '你/你们', category: 'pronouns and be' },
        { en: 'she', cn: '她', category: 'pronouns and be' },
        { en: 'am', cn: '是', category: 'pronouns and be' },
        { en: 'are', cn: '是', category: 'pronouns and be' },
        { en: 'is', cn: '是', category: 'pronouns and be' },
        { en: 'busy', cn: '忙的', category: 'adjectives' },
        { en: 'cold', cn: '冷的', category: 'adjectives' },
        { en: 'teacher', cn: '老师', category: 'people' },
      ],
    },
  ];

  const textbookTokens = new Set(
    buildVocabularyIndex(lessons)
      .flatMap((item) => normalizeAnswer(item.en).split(' ').filter(Boolean)),
  );
  const sentences = buildGeneratedSentenceItems(lessons);

  assert.deepEqual(
    sentences.slice(0, 6).map((item) => item.en),
    ['I am busy.', 'You are busy.', 'She is busy.', 'I am cold.', 'You are cold.', 'She is cold.'],
  );
  assert.ok(sentences.length > 0);
  assert.ok(sentences.every((item) => item.type === 'sentence'));
  for (const item of sentences) {
    const tokens = normalizeAnswer(item.en).split(' ').filter(Boolean);
    assert.deepEqual(item.tokens, tokens);
    assert.ok(item.sourceWordKeys.length >= tokens.length);
    for (const token of tokens) {
      assert.ok(textbookTokens.has(token), `${item.en} uses non-textbook token ${token}`);
    }
  }
});

test('lesson-scoped plans use the selected lesson meaning and item order for repeated English terms', () => {
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

  const plan = buildDailyPlan({
    vocabulary: index,
    progress: {},
    today: '2026-06-03',
    limit: 10,
    lessonId: 'part-2',
  });

  assert.deepEqual(plan.items.map((item) => item.key), ['coffee', 'am']);
  assert.equal(plan.items[1].cn, '上午');
  assert.equal(plan.items[1].category, 'time');
});

test('evaluateWordProgress uses delayed review steps before mastery', () => {
  const today = '2026-06-02';

  const firstPass = evaluateWordProgress(undefined, {
    correct: true,
    today,
    completedStages: ['choice', 'dictation', 'fillblank'],
  });
  assert.equal(firstPass.status, 'review');
  assert.equal(firstPass.dueDate, '2026-06-03');
  assert.equal(firstPass.reviewLevel, 1);

  const secondPass = evaluateWordProgress(firstPass, {
    correct: true,
    today: '2026-06-03',
    completedStages: ['review'],
  });
  assert.equal(secondPass.dueDate, '2026-06-06');
  assert.equal(secondPass.reviewLevel, 2);

  const wrong = evaluateWordProgress(secondPass, {
    correct: false,
    today: '2026-06-04',
    completedStages: ['dictation'],
  });
  assert.equal(wrong.status, 'learning');
  assert.equal(wrong.dueDate, '2026-06-05');
  assert.equal(wrong.wrongCount, 1);
});

test('wrong words stay in the wrong book until answered correctly five times', () => {
  let state = evaluateWordProgress(undefined, {
    correct: false,
    today: '2026-06-02',
    completedStages: ['dictation'],
  });

  assert.equal(state.wrongCount, 1);
  assert.equal(state.wrongCorrectCount, 0);

  for (let index = 1; index <= 4; index += 1) {
    state = evaluateWordProgress(state, {
      correct: true,
      today: `2026-06-0${index + 2}`,
      completedStages: ['choice', 'dictation', 'fillblank'],
    });

    assert.equal(state.wrongCount, 1);
    assert.equal(state.wrongCorrectCount, index);
  }

  state = evaluateWordProgress(state, {
    correct: true,
    today: '2026-06-07',
    completedStages: ['choice', 'dictation', 'fillblank'],
  });

  assert.equal(state.wrongCount, 0);
  assert.equal(state.wrongCorrectCount, 0);
});

test('daily plan keeps wrong words until the five-correct threshold is reached', () => {
  const vocab = [
    { key: 'teacher', firstLessonOrder: 1, firstSeenOrder: 0 },
    { key: 'student', firstLessonOrder: 1, firstSeenOrder: 1 },
  ];
  const progress = {
    teacher: { status: 'mastered', wrongCount: 1, wrongCorrectCount: 4, dueDate: null },
    student: { status: 'new' },
  };

  const plan = buildDailyPlan({ vocabulary: vocab, progress, today: '2026-06-02', limit: 2 });

  assert.deepEqual(plan.items.map((item) => item.key), ['teacher', 'student']);
  assert.deepEqual(plan.counts, { review: 0, wrong: 1, new: 1 });
});

test('isAnswerMatch ignores punctuation, case, and extra spaces', () => {
  assert.equal(isAnswerMatch('I am busy.', 'i  am busy'), true);
  assert.equal(isAnswerMatch("No, I'm not.", 'no im not'), true);
  assert.equal(isAnswerMatch('teacher', 'student'), false);
});
