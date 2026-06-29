const REVIEW_INTERVAL_DAYS = [1, 3, 7];
export const WRONG_CLEAR_CORRECT_COUNT = 5;
const SPELLING_VARIANTS = new Map([
  ['centre', 'center'],
  ['grey', 'gray'],
]);
const GENERATED_SUBJECTS = [
  { key: 'i', en: 'I', cn: '我', be: 'am' },
  { key: 'you', en: 'You', cn: '你', be: 'are' },
  { key: 'she', en: 'She', cn: '她', be: 'is' },
  { key: 'he', en: 'He', cn: '他', be: 'is' },
  { key: 'we', en: 'We', cn: '我们', be: 'are' },
  { key: 'they', en: 'They', cn: '他们', be: 'are' },
];
const GENERATED_ACTION_SUBJECTS = GENERATED_SUBJECTS.filter((subject) => ['i', 'you', 'we', 'they'].includes(subject.key));
const ACTION_START_TOKENS = new Set([
  'arrive', 'arrived', 'argue', 'book', 'booked', 'call', 'change', 'changed',
  'check', 'checked', 'come', 'cook', 'cooked', 'cry', 'cried', 'dance', 'do',
  'draw', 'drink', 'drive', 'drove', 'earn', 'earned', 'eat', 'exercise',
  'finish', 'finished', 'get', 'give', 'go', 'got', 'had', 'have', 'hear',
  'help', 'kiss', 'kissed', 'land', 'landed', 'leave', 'like', 'listen',
  'listened', 'live', 'lived', 'look', 'looked', 'make', 'meet', 'met',
  'order', 'paint', 'park', 'pay', 'play', 'prefer', 'read', 'relax', 'rent',
  'rented', 'see', 'sit', 'ski', 'sleep', 'smoke', 'smoked', 'speak', 'spoke',
  'start', 'started', 'stay', 'stayed', 'study', 'swim', 'take', 'talk',
  'travel', 'use', 'used', 'wait', 'waited', 'wake', 'walk', 'want', 'wanted',
  'watch', 'wear', 'went', 'work', 'worked', 'write',
]);

export function normalizeTermKey(term) {
  const normalized = String(term || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  return normalized
    .split(' ')
    .map((part) => SPELLING_VARIANTS.get(part) || part)
    .join(' ');
}

export function buildVocabularyIndex(lessons) {
  const byKey = new Map();

  lessons
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .forEach((lesson) => {
      (lesson.vocabulary || []).forEach((item, itemIndex) => {
        const key = normalizeTermKey(item.en);
        if (!key) return;

        if (!byKey.has(key)) {
          byKey.set(key, {
            ...item,
            key,
            sources: [],
            sourceDetails: {},
            firstLessonOrder: lesson.order || 0,
            firstSeenOrder: byKey.size,
            lessonItemOrder: itemIndex,
          });
        }

        const existing = byKey.get(key);
        if (!existing.sources.includes(lesson.id)) {
          existing.sources.push(lesson.id);
        }
        existing.sourceDetails[lesson.id] = {
          cn: item.cn,
          category: item.category,
          examples: item.examples,
          lessonOrder: lesson.order || 0,
          lessonItemOrder: itemIndex,
        };
        if (!existing.cn && item.cn) existing.cn = item.cn;
        if (!existing.category && item.category) existing.category = item.category;
        if (!existing.examples && item.examples) existing.examples = item.examples;
      });
    });

  return Array.from(byKey.values()).sort(sortByLessonOrder);
}

export function buildWordPracticeItems(lessons) {
  return buildVocabularyIndex(lessons)
    .filter((item) => item.cn && item.en)
    .map((item) => ({
      id: `word-${item.key}`,
      key: item.key,
      type: 'word',
      cn: item.cn,
      en: item.en,
      lessonId: item.sources?.[0] || '',
      sources: item.sources || [],
    }));
}

export function buildGeneratedSentenceItems(lessons) {
  const orderedLessons = lessons
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const words = buildVocabularyIndex(orderedLessons);
  const tokenSet = textbookTokenSet(words);
  const adjectiveItems = words
    .filter((item) => item.cn && item.en && item.category === 'adjectives')
    .filter((item) => item.key !== 'favorite');
  const sentences = [];
  const seenAnswers = new Set();

  adjectiveItems.forEach((adjective) => {
    GENERATED_SUBJECTS.forEach((subject) => {
      const sentence = `${subject.en} ${subject.be} ${adjective.en}.`;
      const tokens = answerTokenKeys(sentence);
      if (!tokens.length || !tokens.every((token) => tokenSet.has(token))) return;
      addGeneratedSentence({
        id: `generated-sentence-${sentences.length + 1}`,
        type: 'sentence',
        cn: `${subject.cn}很${sentenceAdjectiveCn(adjective.cn)}。`,
        en: sentence,
        lessonId: adjective.sources?.[0] || '',
        sourceWordKeys: [subject.key, subject.be, ...answerTokenKeys(adjective.en)],
        tokens,
      });
    });
  });
  words
    .filter((item) => item.cn && item.en)
    .filter((item) => ACTION_START_TOKENS.has(answerTokenKeys(item.en)[0]))
    .forEach((action) => {
      GENERATED_ACTION_SUBJECTS.forEach((subject) => {
        const sentence = `${subject.en} ${action.en}.`;
        const tokens = answerTokenKeys(sentence);
        if (!tokens.length || !tokens.every((token) => tokenSet.has(token))) return;
        addGeneratedSentence({
          id: `generated-sentence-${sentences.length + 1}`,
          type: 'sentence',
          cn: `${subject.cn}${sentenceActionCn(action.cn)}。`,
          en: sentence,
          lessonId: action.sources?.[0] || '',
          sourceWordKeys: [subject.key, ...answerTokenKeys(action.en)],
          tokens,
        });
      });
    });

  return sentences;

  function addGeneratedSentence(item) {
    const key = normalizeAnswer(item.en);
    if (seenAnswers.has(key)) return;
    seenAnswers.add(key);
    sentences.push(item);
  }
}

export function buildWordSentencePracticeItems(lessons) {
  return [...legacyTranslationSentenceItems(lessons), ...buildWordPracticeItems(lessons)];
}

function legacyTranslationSentenceItems(lessons) {
  return lessons
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .flatMap((lesson) => (
      (lesson.translations || [])
        .filter((item) => item.cn && item.en)
        .map((item, index) => ({
          id: `sentence-${lesson.id}-${index}`,
          type: 'sentence',
          cn: item.cn,
          en: item.en,
          lessonId: lesson.id,
        }))
    ));
}

export function buildDailyPlan({ vocabulary, progress = {}, today = todayKey(), limit = 15, lessonId = 'all' }) {
  const remaining = Number(limit) || 15;
  const scopeId = lessonId || 'all';
  const scopedVocabulary = scopeId === 'all'
    ? vocabulary
    : vocabulary
      .filter((item) => item.sources?.includes(scopeId))
      .map((item) => applySourceDetails(item, scopeId));
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
    .map((item) => {
      const sourceId = selectedIds.find((lessonId) => item.sources?.includes(lessonId));
      return sourceId ? applySourceDetails(item, sourceId) : item;
    })
    .sort(sortByLessonOrder);
}

export function evaluateWordProgress(current, result) {
  const base = {
    status: 'new',
    reviewLevel: 0,
    wrongCount: 0,
    wrongCorrectCount: 0,
    correctCount: 0,
    history: [],
    ...(current || {}),
  };
  const today = result.today || todayKey();
  const historyItem = {
    date: today,
    correct: Boolean(result.correct),
    stages: result.completedStages || [],
  };

  if (!result.correct) {
    return {
      ...base,
      status: 'learning',
      reviewLevel: 0,
      wrongCount: (base.wrongCount || 0) + 1,
      wrongCorrectCount: 0,
      correctCount: 0,
      dueDate: addDays(today, 1),
      lastStudied: today,
      history: [...(base.history || []), historyItem],
    };
  }

  const nextLevel = Math.min((base.reviewLevel || 0) + 1, REVIEW_INTERVAL_DAYS.length);
  const mastered = nextLevel >= REVIEW_INTERVAL_DAYS.length;
  const interval = REVIEW_INTERVAL_DAYS[nextLevel - 1];
  const wasWrong = (base.wrongCount || 0) > 0;
  const nextWrongCorrectCount = wasWrong ? (base.wrongCorrectCount || 0) + 1 : 0;
  const keepWrong = wasWrong && nextWrongCorrectCount < WRONG_CLEAR_CORRECT_COUNT;

  return {
    ...base,
    status: mastered ? 'mastered' : 'review',
    reviewLevel: nextLevel,
    wrongCount: keepWrong ? base.wrongCount : 0,
    wrongCorrectCount: keepWrong ? nextWrongCorrectCount : 0,
    correctCount: (base.correctCount || 0) + 1,
    dueDate: mastered ? null : addDays(today, interval),
    masteredDate: mastered ? today : base.masteredDate,
    lastStudied: today,
    history: [...(base.history || []), historyItem],
  };
}

export function isAnswerMatch(expected, actual) {
  return normalizeAnswer(expected) === normalizeAnswer(actual);
}

export function normalizeAnswer(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return todayKey(date);
}

function sortByLessonOrder(a, b) {
  return (
    (a.firstLessonOrder || 0) - (b.firstLessonOrder || 0) ||
    (a.firstSeenOrder || 0) - (b.firstSeenOrder || 0) ||
    (a.lessonItemOrder || 0) - (b.lessonItemOrder || 0)
  );
}

function textbookTokenSet(vocabulary) {
  return new Set(vocabulary.flatMap((item) => answerTokenKeys(item.en)));
}

function answerTokenKeys(value) {
  return normalizeAnswer(value).split(' ').filter(Boolean);
}

function sentenceAdjectiveCn(value) {
  const firstMeaning = String(value || '').split('/')[0] || value;
  return firstMeaning.replace(/的$/, '') || firstMeaning;
}

function sentenceActionCn(value) {
  const firstMeaning = String(value || '').split('/')[0] || value;
  return firstMeaning.replace(/（.*?）/g, '');
}

function sortByDueThenLesson(progress) {
  return (a, b) => {
    const dueCompare = String(progress[a.key]?.dueDate || '').localeCompare(String(progress[b.key]?.dueDate || ''));
    return dueCompare || sortByLessonOrder(a, b);
  };
}

function isSelected(selectedKeys, item) {
  return selectedKeys.has(item.key);
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
