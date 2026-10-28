import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// 크롬 확장 빌드 설정: dist-extension/ 폴더를 크롬에 "압축해제된 확장 프로그램"으로 불러옵니다
export default defineConfig({
  root: resolve(import.meta.dirname, 'extension'),
  base: './',
  publicDir: resolve(import.meta.dirname, 'extension/public'),
  build: {
    outDir: resolve(import.meta.dirname, 'dist-extension'),
    emptyOutDir: true,
    modulePreload: false, // 백그라운드(서비스 워커)에는 document가 없어서 미리 불러오기 코드를 넣지 않습니다
    rollupOptions: {
      input: {
        sidepanel: resolve(import.meta.dirname, 'extension/sidepanel.html'),
        background: resolve(import.meta.dirname, 'extension/background.js'),
      },
      // manifest.json이 background.js라는 이름을 그대로 찾기 때문에 이름을 고정합니다
      output: { entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js') },
    },
  },
});
