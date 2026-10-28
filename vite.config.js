import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// 메인 사이트 빌드 설정 (Cloudflare Pages가 dist/ 폴더를 배포합니다)
export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        extension: resolve(import.meta.dirname, 'extension.html'), // 확장 프로그램 소개 페이지
      },
    },
  },
});
