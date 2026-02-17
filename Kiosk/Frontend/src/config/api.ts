// API Configuration
// Centralized configuration for backend URLs

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_BASE_URL;

console.log('🔧 Frontend Config:', {
  API_BASE_URL,
  SOCKET_URL,
});
