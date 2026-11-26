import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateRoomId } from '../app/room.js';

// Matches the backend's required room id pattern (docs/api-contract.md).
const ROOM_ID_PATTERN = /^[a-z0-9]{4,32}(-[a-z0-9]{4,32})*$/;

test('starting a session gives a room identifier in the required link format', () => {
  const roomId = generateRoomId();
  assert.match(roomId, ROOM_ID_PATTERN);
});
