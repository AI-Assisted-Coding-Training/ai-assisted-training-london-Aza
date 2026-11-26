import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appHtmlPath = path.join(__dirname, '..', 'app', 'index.html');

test('app/index.html exists and renders the app root marker', () => {
  const html = readFileSync(appHtmlPath, 'utf8');
  assert.match(html, /data-testid="app-root"/);
});
