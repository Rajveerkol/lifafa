import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Cloudflare Workers Static Assets uses native not_found_handling = "single-page-application"
// Exclude legacy server config files and problematic _redirects from dist
function cleanCloudflareDistPlugin(): Plugin {
  return {
    name: 'clean-cloudflare-dist',
    closeBundle() {
      const filesToClean = ['dist/_redirects', 'dist/.htaccess'];
      for (const relPath of filesToClean) {
        const fullPath = path.resolve(__dirname, relPath);
        if (fs.existsSync(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
          } catch {}
        }
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), cleanCloudflareDistPlugin()],
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

