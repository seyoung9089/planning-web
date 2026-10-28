// 빌드된 크롬 확장(dist-extension/)을 zip으로 묶어 사이트에서 내려받을 수 있게 dist/에 넣습니다
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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
