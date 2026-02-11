import { io } from 'socket.io-client';

// Determine the backend URL - called at RUNTIME in the browser
export function getBackendUrl() {
  // Check environment variable first (takes precedence)
  const envUrl = import.meta.env.VITE_API_BASE;
  if (envUrl) {
    console.log('[getBackendUrl] Using VITE_API_BASE:', envUrl);
    return envUrl;
  }

  // Must be running in browser context
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
  
  console.log('[getBackendUrl] Window hostname:', host, 'protocol:', protocol);
  
  // If running on Codespaces domain (*.app.github.dev)
  if (host?.includes('app.github.dev')) {
    // Extract the base hostname and replace port
    // e.g., 'upgrade-abc-5173.app.github.dev' -> 'upgrade-abc-3001.app.github.dev'
    const baseHost = host.replace(/-\d+\.app\.github\.dev$/, '');
    const url = `${protocol}//${baseHost}-3001.app.github.dev`;
    console.log('[getBackendUrl] Detected Codespaces, using:', url);
    return url;
  }

  // Check for localhost or 127.0.0.1
  if (host?.includes('localhost') || host?.includes('127.0.0.1')) {
    const url = `${protocol}//${host.split(':')[0]}:3001`;
    console.log('[getBackendUrl] Detected localhost, using:', url);
    return url;
  }

  // For other environments (like Docker IP, etc.)
  const defaultUrl = `${protocol}//${host}:3001`;
  console.log('[getBackendUrl] Using default:', defaultUrl);
  return defaultUrl;
}

// Create socket with URL determined at runtime (called when module loads in browser)
let socketInstance = null;

export function getSocket() {
  if (!socketInstance) {
    const url = getBackendUrl();
    console.log('[getSocket] Creating socket with URL:', url);
    socketInstance = io(url, {
      transports: ['polling', 'websocket'], // Try polling first in Codespaces
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      timeout: 20000,
      forceNew: false,
      upgrade: true // Allow upgrading to websocket after polling connects
    });

    socketInstance.on('connect', () => {
      console.log('[socket.js] ✅ Connected to backend at:', url);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('[socket.js] ❌ Connection error:', error.message);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[socket.js] Disconnected from backend:', reason);
    });
  }
  return socketInstance;
}

// For backwards compatibility, create socket immediately
export const socket = getSocket();

// Export API_BASE as a function that gets called at runtime
export function getApiBase() {
  return getBackendUrl();
}



