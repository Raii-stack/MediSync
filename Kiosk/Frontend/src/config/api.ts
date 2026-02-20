// API Configuration
// Dynamically determines the backend URL at runtime

const getBackendUrl = () => {
  // 1. Check environment variable (can be set via .env at build time)
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    console.log('✅ Using VITE_API_URL from env:', envUrl);
    return envUrl;
  }

  // 2. Runtime fallback: use current hostname with port 3001
  // This works for: http://192.168.42.18 -> http://192.168.42.18:3001
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const url = `${protocol}//${hostname}:3001`;
  console.log('📍 Using runtime fallback:', url);
  return url;
};

export const API_BASE_URL = getBackendUrl();
export const SOCKET_URL = API_BASE_URL;

console.log('🔧 Frontend Config:', {
  API_BASE_URL,
  SOCKET_URL,
  ORIGIN: window.location.origin,
});
