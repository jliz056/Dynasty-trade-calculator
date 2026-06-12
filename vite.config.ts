import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // KeepTradeCut has no public API and blocks cross-origin requests,
      // so the devy rankings page is fetched through this proxy.
      '/ktc': {
        target: 'https://keeptradecut.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ktc/, ''),
      },
    },
  },
});
