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
    rollupOptions: {
      input: { sidepanel: resolve(import.meta.dirname, 'extension/sidepanel.html') },
    },
  },
});
