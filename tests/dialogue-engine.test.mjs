import test from 'node:test';
import assert from 'node:assert/strict';
import { lessons } from '../data/lessons.js';
import { dialoguePacks, getDialoguePack } from '../data/dialogues.js';
import {
  buildLessonWhitelist,
  buildLessonWhitelists,
  tokenizeCourseEnglish,
  validateDialoguePack,
  validateDialoguePacks,
  validateTextAgainstWhitelist,
} from '../assets/js/dialogue-engine.js';

test('tokenizeCourseEnglish normalizes course punctuation without inventing variants', () => {
  assert.deepEqual(tokenizeCourseEnglish("  That’s why.  I am OK! "), ["that's", 'why', 'i', 'am', 'ok']);
  assert.deepEqual(tokenizeCourseEnglish('grey / gray'), ['gray', 'gray']);
});

test('buildLessonWhitelists keeps future Part tokens out of Part 1', () => {
  const byLesson = buildLessonWhitelists(lessons);
  assert.equal(byLesson.get('part-1').tokens.has('teacher'), true);
  assert.equal(byLesson.get('part-1').tokens.has('yesterday'), false);
  assert.equal(byLesson.get('part-4').tokens.has('yesterday'), true);
});

test('whitelist includes English from every approved field in one lesson', () => {
  const whitelist = buildLessonWhitelist(lessons[0]);
  assert.equal(whitelist.tokens.has('where'), true);
  assert.equal(whitelist.tokens.has('from'), true);
  assert.equal(whitelist.tokens.has('teacher'), true);
});

test('validation reports an exact unknown token', () => {
  const whitelist = buildLessonWhitelist(lessons[0]);
  assert.deepEqual(validateTextAgainstWhitelist('I was busy.', whitelist), {
    valid: false,
    tokens: ['i', 'was', 'busy'],
    invalidTokens: ['was'],
  });
});

test('every Part has the required fallback scenarios with alternating four-to-six-turn dialogues', () => {
  const requiredScenarioIds = new Map([
    ['part-1', ['meet-colleague', 'feelings', 'objects-colors']],
    ['part-2', ['breakfast', 'daily-routine', 'home-work']],
    ['part-3', ['ability', 'ask-help', 'permission']],
    ['part-4', ['last-night', 'yesterday', 'free-time']],
    ['part-5', ['last-weekend', 'travel', 'past-actions']],
    ['part-6', ['hotel-room', 'home-items', 'past-place']],
  ]);

  assert.deepEqual(dialoguePacks.map((pack) => pack.lessonId), lessons.map((lesson) => lesson.id));
  dialoguePacks.forEach((pack) => {
    assert.equal(pack.version, 1);
    assert.deepEqual(pack.scenarios.map((scenario) => scenario.id), requiredScenarioIds.get(pack.lessonId));
    pack.scenarios.forEach((scenario) => {
      assert.ok(scenario.titleCn && scenario.goalCn);
      assert.ok(scenario.turns.length >= 4 && scenario.turns.length <= 6);
      scenario.turns.forEach((turn, index) => {
        assert.equal(turn.role, index % 2 === 0 ? 'A' : 'B');
        assert.ok(turn.id && turn.en && turn.cn && turn.intentCn && turn.patternId);
        assert.ok(Array.isArray(turn.sourceIds) && turn.sourceIds.length > 0);
        assert.ok(Array.isArray(turn.variantIds));
      });
      scenario.variants.forEach((variant) => {
        assert.ok(variant.id && variant.en && variant.cn && variant.intentCn && variant.patternId);
        assert.ok(Array.isArray(variant.sourceIds) && variant.sourceIds.length > 0);
      });
      const variantIds = new Set(scenario.variants.map((variant) => variant.id));
      assert.ok(scenario.turns.every((turn) => turn.variantIds.every((id) => variantIds.has(id))));
    });
  });
});

test('every canonical variant preserves the owning turn intent and response pattern', () => {
  for (const pack of dialoguePacks) {
    for (const scenario of pack.scenarios) {
      const variants = new Map(scenario.variants.map((item) => [item.id, item]));
      for (const turn of scenario.turns) {
        for (const variantId of turn.variantIds) {
          const item = variants.get(variantId);
          assert.equal(item.intentCn, turn.intentCn, `${pack.lessonId}/${scenario.id}/${variantId} changes intent`);
          assert.equal(item.patternId, turn.patternId, `${pack.lessonId}/${scenario.id}/${variantId} changes response pattern`);
        }
      }
    }
  }
});

test('every bundled English line and canonical variant stays inside its own Part whitelist', () => {
  const result = validateDialoguePacks(dialoguePacks, buildLessonWhitelists(lessons));
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
});

test('dialogue validation reports cross-Part English with scenario and turn ids', () => {
  const badPack = structuredClone(dialoguePacks[0]);
  badPack.scenarios[0].turns[0].en = 'I was busy.';
  const result = validateDialoguePacks([badPack], buildLessonWhitelists(lessons));

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors[0], {
    code: 'unknown_token',
    lessonId: 'part-1',
    scenarioId: 'meet-colleague',
    turnId: 'turn-1',
    invalidTokens: ['was'],
  });
});

test('dialogue validation rejects unknown English in approved-id variants', () => {
  const badPack = structuredClone(dialoguePacks[0]);
  const owner = badPack.scenarios[0].turns[0];
  const variant = { ...owner, id: 'turn-1-alt', en: 'I was busy.' };
  delete variant.role;
  delete variant.variantIds;
  owner.variantIds = [variant.id];
  badPack.scenarios[0].variants.push(variant);
  const result = validateDialoguePack(badPack, buildLessonWhitelists(lessons).get('part-1'));

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors[0], {
    code: 'unknown_token',
    lessonId: 'part-1',
    scenarioId: 'meet-colleague',
    turnId: 'turn-1',
    variantId: variant.id,
    invalidTokens: ['was'],
  });
});

test('dialogue validation rejects duplicate ids, missing fields, broken alternation, and invalid turn counts', () => {
  const whitelist = buildLessonWhitelists(lessons).get('part-1');
  const cases = [
    ['duplicate scenario id', (pack) => { pack.scenarios[1].id = pack.scenarios[0].id; }],
    ['duplicate turn id', (pack) => { pack.scenarios[0].turns[1].id = pack.scenarios[0].turns[0].id; }],
    ['duplicate variant id', (pack) => {
      const variant = { ...pack.scenarios[0].turns[0], id: 'variant-1' };
      delete variant.role;
      delete variant.variantIds;
      pack.scenarios[0].variants.push(variant, structuredClone(variant));
    }],
    ['missing turn field', (pack) => { delete pack.scenarios[0].turns[0].intentCn; }],
    ['non-alternating roles', (pack) => { pack.scenarios[0].turns[1].role = 'A'; }],
    ['too few turns', (pack) => { pack.scenarios[0].turns.length = 3; }],
    ['unknown variant id', (pack) => { pack.scenarios[0].turns[0].variantIds = ['missing-variant']; }],
  ];

  for (const [name, mutate] of cases) {
    const badPack = structuredClone(dialoguePacks[0]);
    mutate(badPack);
    const result = validateDialoguePack(badPack, whitelist);
    assert.equal(result.valid, false, name);
    assert.ok(result.errors.some((error) => error.code === 'invalid_dialogue_shape'), name);
  }
});

test('dialogue validation reports malformed container fields without throwing', () => {
  const whitelist = buildLessonWhitelists(lessons).get('part-1');
  const cases = [
    {
      name: 'object scenarios',
      mutate: (pack) => { pack.scenarios = {}; },
      trace: { lessonId: 'part-1', scenarioId: undefined, turnId: undefined, detail: 'invalid_pack' },
    },
    {
      name: 'object turns',
      mutate: (pack) => { pack.scenarios[0].turns = {}; },
      trace: { lessonId: 'part-1', scenarioId: 'meet-colleague', turnId: undefined, detail: 'invalid_scenario' },
    },
    {
      name: 'object variants',
      mutate: (pack) => { pack.scenarios[0].variants = {}; },
      trace: { lessonId: 'part-1', scenarioId: 'meet-colleague', turnId: undefined, detail: 'invalid_scenario' },
    },
  ];

  for (const { name, mutate, trace } of cases) {
    const badPack = structuredClone(dialoguePacks[0]);
    mutate(badPack);
    let result;
    assert.doesNotThrow(() => { result = validateDialoguePack(badPack, whitelist); }, name);
    assert.equal(result.valid, false, name);
    assert.ok(result.errors.some((error) => error.code === 'invalid_dialogue_shape'
      && error.lessonId === trace.lessonId
      && error.scenarioId === trace.scenarioId
      && error.turnId === trace.turnId
      && error.detail === trace.detail), name);
  }
});

test('getDialoguePack returns only the canonical pack for an approved lesson id', () => {
  assert.equal(getDialoguePack('part-3'), dialoguePacks[2]);
  assert.equal(getDialoguePack('part-7'), undefined);
});
