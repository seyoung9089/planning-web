// 빌드된 크롬 확장(dist-extension/)을 zip으로 묶어 사이트에서 내려받을 수 있게 dist/에 넣습니다
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { zipSync } from 'fflate';

const root = 'dist-extension';
const files = {};

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else files[`planning-web-extension/${relative(root, path).replaceAll('\\', '/')}`] = readFileSync(path);
  }
}

walk(root);
writeFileSync('dist/planning-web-extension.zip', zipSync(files, { level: 9 }));
console.log(`dist/planning-web-extension.zip (${Object.keys(files).length}개 파일)`);

// 사이드 패널이 "새 버전이 있어요"를 띄울 때 보는 파일. manifest 버전을 그대로 씁니다
const { version } = JSON.parse(readFileSync('extension/public/manifest.json', 'utf8'));
mkdirSync('dist/extension', { recursive: true });
writeFileSync('dist/extension/version.json', JSON.stringify({ version }) + '\n');
console.log(`dist/extension/version.json (${version})`);
