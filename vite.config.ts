import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Bind IPv4 explicitly — Windows often listens on [::1] only by default,
    // which breaks external browsers while Cursor's preview still works.
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // Allow Cloudflare quick-tunnel hostnames (otherwise tunnel returns 403).
    allowedHosts: ['.trycloudflare.com'],
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
