import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    fs: {
      allow: ['..'],
    },
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
