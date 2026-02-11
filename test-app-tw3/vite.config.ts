import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { jiraServerPlugin } from './jira-server-plugin'

export default defineConfig({
  plugins: [react(), jiraServerPlugin()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 5174,
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
    proxy: {
      '/api/linear': {
        target: 'https://api.linear.app',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/linear/, ''),
      },
      '/api/gcs': {
        target: 'https://storage.googleapis.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/gcs/, ''),
      },
    },
  },
  optimizeDeps: {
    include: ['bug-reporter-react'],
  },
})
