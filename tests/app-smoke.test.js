const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const appHtmlPath = path.join(__dirname, '..', 'app', 'index.html');

test('app/index.html exists and renders the app root marker', () => {
  const html = readFileSync(appHtmlPath, 'utf8');
  assert.match(html, /data-testid="app-root"/);
});
