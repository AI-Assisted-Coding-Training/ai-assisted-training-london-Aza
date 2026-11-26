import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDisplayName } from '../app/display-name.js';

test('a blank display name is rejected with a friendly message', () => {
  const result = validateDisplayName('   ');
  assert.equal(result.valid, false);
  assert.match(result.message, /name/i);
});

test('a display name over 32 characters (after trimming) is rejected', () => {
  const result = validateDisplayName('  ' + 'a'.repeat(33) + '  ');
  assert.equal(result.valid, false);
  assert.match(result.message, /name/i);
});

test('a well-formed display name is accepted, trimmed', () => {
  const result = validateDisplayName('  Alice  ');
  assert.equal(result.valid, true);
  assert.equal(result.trimmedName, 'Alice');
});

test('a display name of exactly 32 characters (after trimming) is accepted', () => {
  const result = validateDisplayName('a'.repeat(32));
  assert.equal(result.valid, true);
});
