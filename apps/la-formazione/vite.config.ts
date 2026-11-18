import { defineConfig } from 'vite';

// Spotify accetta come redirect solo HTTPS o 127.0.0.1 (non localhost):
// registra http://127.0.0.1:5172/ nella Developer Dashboard.
export default defineConfig({
  envDir: '../..',
  base: './',
  server: { host: '127.0.0.1', port: 5172, strictPort: true },
  preview: { host: '127.0.0.1', port: 5172, strictPort: true },
  build: { target: 'es2022' },
});
