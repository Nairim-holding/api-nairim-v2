import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Espelha o alias "@/*" -> "src/*" do tsconfig; sem isso os módulos que importam
// por alias (ex.: "@/env") não resolvem sob o Vitest.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
