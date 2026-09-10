import test from 'node:test';
import assert from 'node:assert/strict';
import { lessons } from '../data/lessons.js';
import {
  buildLessonWhitelist,
  buildLessonWhitelists,
  tokenizeCourseEnglish,
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
