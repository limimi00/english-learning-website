import { addDays, todayKey } from './study-engine.js';

const SPELLING_VARIANTS = new Map([
  ['centre', 'center'],
  ['grey', 'gray'],
]);

const SPEAKING_PASSES = ['listen', 'role-a', 'role-b', 'complete'];
const SPEAKING_REVIEW_INTERVAL_DAYS = [1, 3, 7];
const SPEAKING_SKILLS = ['listen', 'repeat', 'guided-produce', 'independent-produce'];
const UNASSESSED_SPEAKING_RESULTS = new Set(['technical-fallback', 'skipped']);

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

function dialogueShapeError(lessonId, scenarioId, turnId, detail) {
  return {
    code: 'invalid_dialogue_shape',
    lessonId,
    scenarioId,
    turnId,
    detail,
  };
}

function hasRequiredTextFields(item, fields) {
  return fields.every((field) => typeof item?.[field] === 'string' && item[field].trim());
}

function hasSourceIds(item) {
  return Array.isArray(item?.sourceIds)
    && item.sourceIds.length > 0
    && item.sourceIds.every((id) => typeof id === 'string' && id.trim());
}

export function validateDialoguePack(pack, whitelist) {
  const errors = [];
  const lessonId = pack?.lessonId;
  const scenarios = Array.isArray(pack?.scenarios) ? pack.scenarios : [];

  if (!hasRequiredTextFields(pack, ['lessonId'])
      || pack.version !== 1
      || !Array.isArray(pack.scenarios)
      || pack.scenarios.length < 3
      || whitelist?.lessonId !== lessonId) {
    errors.push(dialogueShapeError(lessonId, undefined, undefined, 'invalid_pack'));
  }

  const scenarioIds = new Set();
  for (const scenario of scenarios) {
    const scenarioId = scenario?.id;
    const turns = Array.isArray(scenario?.turns) ? scenario.turns : [];
    const variantItems = Array.isArray(scenario?.variants) ? scenario.variants : [];
    if (scenarioIds.has(scenarioId)) {
      errors.push(dialogueShapeError(lessonId, scenarioId, undefined, 'duplicate_scenario_id'));
    }
    scenarioIds.add(scenarioId);

    if (!hasRequiredTextFields(scenario, ['id', 'titleCn', 'goalCn'])
        || !Array.isArray(scenario.turns)
        || !Array.isArray(scenario.variants)) {
      errors.push(dialogueShapeError(lessonId, scenarioId, undefined, 'invalid_scenario'));
    }

    if (!Array.isArray(scenario.turns) || scenario.turns.length < 4 || scenario.turns.length > 6) {
      errors.push(dialogueShapeError(lessonId, scenarioId, undefined, 'invalid_turn_count'));
    }

    const turnIds = new Set();
    for (const [index, item] of turns.entries()) {
      const turnId = item?.id;
      if (turnIds.has(turnId)) {
        errors.push(dialogueShapeError(lessonId, scenarioId, turnId, 'duplicate_turn_id'));
      }
      turnIds.add(turnId);

      if (!hasRequiredTextFields(item, ['id', 'role', 'en', 'cn', 'intentCn', 'patternId'])
          || !hasSourceIds(item)
          || !Array.isArray(item?.variantIds)
          || item.variantIds.some((id) => typeof id !== 'string' || !id.trim())) {
        errors.push(dialogueShapeError(lessonId, scenarioId, turnId, 'invalid_turn'));
      }
      if (item?.role !== (index % 2 === 0 ? 'A' : 'B')) {
        errors.push(dialogueShapeError(lessonId, scenarioId, turnId, 'non_alternating_roles'));
      }

      if (whitelist && typeof item?.en === 'string') {
        const result = validateTextAgainstWhitelist(item.en, whitelist);
        if (!result.valid) {
          errors.push({
            code: 'unknown_token',
            lessonId,
            scenarioId,
            turnId,
            invalidTokens: result.invalidTokens,
          });
        }
      }
    }

    const variants = new Map();
    for (const item of variantItems) {
      if (variants.has(item?.id)) {
        errors.push(dialogueShapeError(lessonId, scenarioId, undefined, 'duplicate_variant_id'));
      }
      variants.set(item?.id, item);
      if (!hasRequiredTextFields(item, ['id', 'en', 'cn', 'intentCn', 'patternId']) || !hasSourceIds(item)) {
        errors.push(dialogueShapeError(lessonId, scenarioId, undefined, 'invalid_variant'));
      }
    }

    for (const item of turns) {
      for (const variantId of item?.variantIds || []) {
        if (!variants.has(variantId)) {
          errors.push(dialogueShapeError(lessonId, scenarioId, item.id, 'unknown_variant_id'));
        }
      }
    }

    for (const item of variantItems) {
      if (whitelist && typeof item?.en === 'string') {
        const result = validateTextAgainstWhitelist(item.en, whitelist);
        if (!result.valid) {
          const owner = turns.find((candidate) => candidate.variantIds?.includes(item.id));
          errors.push({
            code: 'unknown_token',
            lessonId,
            scenarioId,
            turnId: owner?.id,
            variantId: item.id,
            invalidTokens: result.invalidTokens,
          });
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateDialoguePacks(packs, whitelists) {
  const errors = [];
  const lessonIds = new Set();

  for (const pack of packs || []) {
    if (lessonIds.has(pack?.lessonId)) {
      errors.push(dialogueShapeError(pack?.lessonId, undefined, undefined, 'duplicate_lesson_id'));
    }
    lessonIds.add(pack?.lessonId);
    errors.push(...validateDialoguePack(pack, whitelists?.get(pack?.lessonId)).errors);
  }

  return { valid: errors.length === 0, errors };
}

export function createSpeakingSession(scenario, options = {}) {
  const now = options.now ?? new Date();
  return {
    lessonId: options.lessonId,
    courseVersion: options.courseVersion ?? 1,
    whitelistVersion: options.whitelistVersion ?? 1,
    scenarioId: scenario.id,
    pass: 'listen',
    turnIndex: 0,
    startedDate: typeof now === 'string' ? now : todayKey(now),
  };
}

export function currentSpeakingTurn(session, scenario) {
  if (session.pass === 'complete') return null;
  const turn = scenario.turns[session.turnIndex];
  if (!turn) return null;

  const learnerRole = session.pass === 'role-a'
    ? 'A'
    : session.pass === 'role-b' ? 'B' : null;
  const learnerTurn = turn.role === learnerRole;
  return {
    ...turn,
    learnerTurn,
    systemTurn: session.pass === 'listen' || !learnerTurn,
  };
}

export function advanceSpeakingSession(session, scenario) {
  if (session.pass === 'complete') return { ...session };

  if (session.turnIndex < scenario.turns.length - 1) {
    return { ...session, turnIndex: session.turnIndex + 1 };
  }

  const passIndex = SPEAKING_PASSES.indexOf(session.pass);
  return {
    ...session,
    pass: SPEAKING_PASSES[Math.min(passIndex + 1, SPEAKING_PASSES.length - 1)],
    turnIndex: 0,
  };
}

function emptySpeakingEvidence() {
  return Object.fromEntries(SPEAKING_SKILLS.map((skill) => [skill, {
    attemptCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    technicalFallbackCount: 0,
    skippedCount: 0,
    supportUsedCount: 0,
    lastResult: null,
    lastDate: null,
  }]));
}

function updateSpeakingEvidence(evidence, attempt, supportUsed) {
  const current = evidence[attempt.skill];
  const unassessed = UNASSESSED_SPEAKING_RESULTS.has(attempt.result);
  return {
    ...evidence,
    [attempt.skill]: {
      ...current,
      attemptCount: current.attemptCount + 1,
      correctCount: current.correctCount + (!unassessed && attempt.result !== 'incorrect' ? 1 : 0),
      incorrectCount: current.incorrectCount + (attempt.result === 'incorrect' ? 1 : 0),
      technicalFallbackCount: current.technicalFallbackCount + (attempt.result === 'technical-fallback' ? 1 : 0),
      skippedCount: current.skippedCount + (attempt.result === 'skipped' ? 1 : 0),
      supportUsedCount: current.supportUsedCount + (supportUsed ? 1 : 0),
      lastResult: attempt.result,
      lastDate: attempt.date,
    },
  };
}

export function nextSpeakingReviewDate(dateKey, reviewLevel) {
  const interval = SPEAKING_REVIEW_INTERVAL_DAYS[reviewLevel - 1];
  return interval ? addDays(dateKey, interval) : null;
}

export function recordSpeakingAttempt(progress = {}, attempt) {
  if (!SPEAKING_SKILLS.includes(attempt.skill)) {
    throw new TypeError(`Unknown speaking skill: ${attempt.skill}`);
  }

  const key = `${attempt.lessonId}:${attempt.scenarioId}:${attempt.turnId}`;
  const current = progress[key] || {};
  const base = {
    kind: 'speaking',
    lessonId: attempt.lessonId,
    scenarioId: attempt.scenarioId,
    turnId: attempt.turnId,
    patternId: attempt.patternId,
    status: 'new',
    reviewLevel: 0,
    wrongCount: 0,
    dueDate: null,
    lastPracticed: null,
    evidence: emptySpeakingEvidence(),
    history: [],
    ...current,
  };
  const supportUsed = Boolean(
    attempt.supportUsed || attempt.fullAnswerRevealed || attempt.revealedFullAnswer,
  );
  const unassessed = UNASSESSED_SPEAKING_RESULTS.has(attempt.result);
  const incorrect = attempt.result === 'incorrect';
  const nextLevel = incorrect
    ? 0
    : Math.min(base.reviewLevel + (unassessed ? 0 : 1), SPEAKING_REVIEW_INTERVAL_DAYS.length + 1);
  const dueDate = unassessed
    ? base.dueDate
    : incorrect
      ? addDays(attempt.date, 1)
      : nextSpeakingReviewDate(attempt.date, nextLevel);

  return {
    ...progress,
    [key]: {
      ...base,
      patternId: attempt.patternId ?? base.patternId,
      status: unassessed
        ? base.status
        : nextLevel > SPEAKING_REVIEW_INTERVAL_DAYS.length ? 'mastered' : incorrect ? 'learning' : 'review',
      reviewLevel: nextLevel,
      wrongCount: base.wrongCount + (incorrect ? 1 : 0),
      dueDate,
      lastPracticed: attempt.date,
      evidence: updateSpeakingEvidence(base.evidence, attempt, supportUsed),
      history: [...base.history, {
        date: attempt.date,
        skill: attempt.skill,
        result: attempt.result,
        supportUsed,
      }],
    },
  };
}

export function buildSpeakingReviewQueue(progress = {}, options = {}) {
  const today = options.today ?? todayKey();
  return Object.entries(progress)
    .filter(([, state]) => state?.kind === 'speaking'
      && typeof state.dueDate === 'string'
      && state.dueDate <= today
      && (!options.lessonId || state.lessonId === options.lessonId))
    .map(([key, state]) => ({ key, ...state }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate)
      || (b.wrongCount || 0) - (a.wrongCount || 0)
      || a.key.localeCompare(b.key));
}
