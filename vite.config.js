import { defineConfig } from 'vite';

// 메인 사이트 빌드 설정 (Cloudflare Pages가 dist/ 폴더를 배포합니다)
export default defineConfig({
  build: { outDir: 'dist' },
});
