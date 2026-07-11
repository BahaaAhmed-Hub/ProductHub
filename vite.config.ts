import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Relative base so the built app works under any GitHub Pages sub-path
  // (https://<user>.github.io/<repo>/) without hardcoding the repo name.
  base: './',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    // Force a single React instance (recharts/others otherwise pull a second
    // copy → "Cannot read properties of null (reading 'useRef')").
    dedupe: ['react', 'react-dom'],
  },
  server: { port: 5173 },
});
