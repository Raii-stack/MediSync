import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow external connections (needed for Docker)
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true, // Enable polling for Docker environments
    },
    hmr: {
      clientPort: 5173, // Hot Module Replacement port
    },
    // Proxy API calls to the backend service
    proxy: {
      '/api': {
        target: 'http://medisync-backend:3001',
        changeOrigin: true,
        rewrite: (path) => path, // Keep the path as-is
      },
    },
  },
})
