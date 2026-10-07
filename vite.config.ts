import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Cloudflare Workers Static Assets uses native not_found_handling = "single-page-application"
// Exclude _redirects from dist to prevent Cloudflare Error 100324 (infinite loop)
function excludeRedirectsFromDistPlugin(): Plugin {
  return {
    name: 'exclude-redirects-from-dist',
    closeBundle() {
      const redirectsPath = path.resolve(__dirname, 'dist/_redirects');
      if (fs.existsSync(redirectsPath)) {
        try {
          fs.unlinkSync(redirectsPath);
        } catch {
          // ignore error if unable to delete
        }
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), excludeRedirectsFromDistPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});

