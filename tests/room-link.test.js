import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoomFromUrl, buildShareableLink } from '../app/room-link.js';

test('a shareable link built for a room id round-trips back to that room id', () => {
  const link = buildShareableLink('https://example.com/app/', 'xk29-4plm');
  assert.equal(parseRoomFromUrl(link), 'xk29-4plm');
});

test('a URL with no room query param has no room', () => {
  assert.equal(parseRoomFromUrl('https://example.com/app/'), null);
});

test('a URL with an empty room query param has no room', () => {
  assert.equal(parseRoomFromUrl('https://example.com/app/?room='), null);
});

test('the shareable link preserves the base path and uses a room query param', () => {
  const link = buildShareableLink('https://example.com/app/', 'xk29-4plm');
  assert.equal(link, 'https://example.com/app/?room=xk29-4plm');
});
