import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { jiraServerPlugin } from './jira-server-plugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react(), jiraServerPlugin()],
  resolve: {
    alias: {
      // Ensure the library's bundled code can resolve its own deps
      // from the parent's node_modules (needed for file:.. symlink)
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    fs: {
      allow: [
        // Allow serving files from the parent library directory
        path.resolve(__dirname, '..'),
      ],
    },
    proxy: {
      // Proxy Linear GraphQL requests to avoid CORS in dev
      '/api/linear': {
        target: 'https://api.linear.app',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/linear/, ''),
      },
      // Proxy Google Cloud Storage uploads (Linear returns signed GCS URLs)
      '/api/gcs': {
        target: 'https://storage.googleapis.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/gcs/, ''),
      },
      // Jira is handled server-side by jiraServerPlugin() — no proxy needed
    },
  },
  optimizeDeps: {
    include: [
      'bug-reporter-react',
    ],
  },
})
