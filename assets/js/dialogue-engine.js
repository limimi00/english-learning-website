const SPELLING_VARIANTS = new Map([
  ['centre', 'center'],
  ['grey', 'gray'],
]);

export function tokenizeCourseEnglish(value) {
  return String(value || '')
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .match(/[a-z]+(?:'[a-z]+)?|\d+(?::\d+)?/g)?.map((token) => SPELLING_VARIANTS.get(token) || token) || [];
}

function lessonEnglishStrings(lesson) {
  return [
    ...(lesson.vocabulary || []).map((item) => item.en),
    ...(lesson.grammar || []).flatMap((item) => item.patterns || []),
    ...(lesson.sentences || []),
    ...(lesson.fillBlanks || []).flatMap((item) => [item.q, item.a]),
    ...(lesson.translations || []).map((item) => item.en),
    ...(lesson.questions || []),
  ].filter(Boolean);
}

export function buildLessonWhitelist(lesson) {
  const sourceStrings = lessonEnglishStrings(lesson);
  return {
    lessonId: lesson.id,
    version: 1,
    sourceStrings,
    tokens: new Set(sourceStrings.flatMap(tokenizeCourseEnglish)),
  };
}

export function buildLessonWhitelists(lessons) {
  return new Map(lessons.map((lesson) => [lesson.id, buildLessonWhitelist(lesson)]));
}

export function validateTextAgainstWhitelist(text, whitelist) {
  const tokens = tokenizeCourseEnglish(text);
  const invalidTokens = [...new Set(tokens.filter((token) => !whitelist.tokens.has(token)))];
  return { valid: invalidTokens.length === 0, tokens, invalidTokens };
}
