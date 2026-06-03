const REVIEW_INTERVAL_DAYS = [1, 3, 7];
export const WRONG_CLEAR_CORRECT_COUNT = 5;

export function normalizeTermKey(term) {
  return String(term || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
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
