import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 사이드 패널의 버전 비교 (sidepanel.js는 크롬 전용 코드라 함수만 떼어 같은 규칙으로 확인합니다)
function isOlder(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x < y;
  }
  return false;
}

test('버전 비교는 숫자로 합니다 (0.2.9 < 0.2.10)', () => {
  assert.equal(isOlder('0.2.9', '0.2.10'), true);
  assert.equal(isOlder('0.2.20', '0.2.20'), false);
  assert.equal(isOlder('0.3.0', '0.2.99'), false);
});

test('update.xml과 manifest의 버전이 같습니다', () => {
  const manifest = JSON.parse(readFileSync(new URL('../extension/public/manifest.json', import.meta.url)));
  const xml = readFileSync(new URL('../public/extension/update.xml', import.meta.url), 'utf8');
  assert.match(xml, new RegExp(`version=['"]${manifest.version.replace(/\./g, '\\.')}['"]`));
});
