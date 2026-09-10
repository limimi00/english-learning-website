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
