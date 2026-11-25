import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { EXTENSION_ID } from '../src/shared/extensionId.js';

// 크롬 확장 ID = manifest key(공개 키)의 SHA-256 앞 32글자(16진수)를 a~p로 바꾼 것
test('사이트에 적어 둔 확장 ID가 manifest의 key와 맞습니다', () => {
  const manifest = JSON.parse(readFileSync(new URL('../extension/public/manifest.json', import.meta.url)));
  const hex = createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex').slice(0, 32);
  const id = [...hex].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
  assert.equal(id, EXTENSION_ID);
});
