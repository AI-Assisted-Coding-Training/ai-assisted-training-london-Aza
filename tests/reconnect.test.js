import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconnectDelayMs } from '../app/reconnect.js';

test('a server-shutdown close (1001) gets a longer reconnect delay', () => {
  assert.equal(reconnectDelayMs(1001), 3000);
});

test('any other unexpected close gets the short reconnect delay', () => {
  assert.equal(reconnectDelayMs(1006), 2000);
  assert.equal(reconnectDelayMs(1011), 2000);
});
