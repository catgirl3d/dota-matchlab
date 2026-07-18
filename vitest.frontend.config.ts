import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/react-app/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/react-app/test/setup.ts'],
  },
});
