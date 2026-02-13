import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(() => {
  const isCodespace = Boolean(process.env.CODESPACE_NAME)
  const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
  const codespaceHost = isCodespace && forwardingDomain
    ? `${process.env.CODESPACE_NAME}-5173.${forwardingDomain}`
    : 'localhost'
  const codespaceOrigin = isCodespace ? `https://${codespaceHost}` : undefined

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0', // Allow external connections (needed for Docker)
      port: 5173,
      strictPort: true,
      allowedHosts: isCodespace
        ? [
            codespaceHost,
            `.${forwardingDomain}`,
            '.github.dev',
            'localhost',
            '127.0.0.1',
          ]
        : undefined,
      origin: codespaceOrigin,
      watch: {
        usePolling: true, // Enable polling for Docker environments
        interval: 100,
      },
      hmr: {
        host: codespaceHost,
        port: 5173,
        clientPort: isCodespace ? 443 : 5173,
        protocol: isCodespace ? 'wss' : 'ws',
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
  }
})