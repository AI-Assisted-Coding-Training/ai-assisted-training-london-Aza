import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidRoomId } from '../app/room.js';

test('a well-formed room id is valid', () => {
  assert.equal(isValidRoomId('xk29-4plm'), true);
});

test('a room id with uppercase or invalid characters is rejected', () => {
  assert.equal(isValidRoomId('XK29-4PLM'), false);
  assert.equal(isValidRoomId('xk29_4plm'), false);
  assert.equal(isValidRoomId('xk29 4plm'), false);
});

test('a room id with a too-short segment is rejected', () => {
  assert.equal(isValidRoomId('xk2-4plm'), false);
});

test('an empty or missing room id is rejected', () => {
  assert.equal(isValidRoomId(''), false);
  assert.equal(isValidRoomId(null), false);
  assert.equal(isValidRoomId(undefined), false);
});
