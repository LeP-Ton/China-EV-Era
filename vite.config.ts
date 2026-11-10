import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // 本地使用根路径；发布时由 Pages 的实际站点路径设置资源前缀。
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  server: { watch: { ignored: ['**/.local/**', '**/test-results/**'] } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
