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
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
      process.env.VITE_SUPABASE_URL || 'https://pxqyeonymwlpiklfyjbb.supabase.co'
    ),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
      process.env.VITE_SUPABASE_ANON_KEY ||
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4cXllb255bXdscGlrbGZ5amJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MTc2NzAsImV4cCI6MjEwNDQ5MzY3MH0.Oo5y8zsMbS4uq3HuZmWUbkk_VGkvRW0_J-jCGQkhTlg'
    ),
    'import.meta.env.VITE_ALLOW_DEV_SIMULATOR': JSON.stringify(
      process.env.VITE_ALLOW_DEV_SIMULATOR || 'false'
    ),
  },
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

