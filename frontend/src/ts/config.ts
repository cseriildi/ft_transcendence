// Runtime configuration for frontend
// These values are injected at runtime via index.html

// Extend Window interface to include our config
declare global {
  interface Window {
    APP_CONFIG?: {
      API_URL: string;
      WS_URL: string;
    };
  }
}

// Helper to get config value with fallback
function getConfigValue(
  key: keyof NonNullable<typeof window.APP_CONFIG>,
  fallback: string
): string {
  return window.APP_CONFIG?.[key] || fallback;
}

// Export configuration
export const config = {
  apiUrl: getConfigValue("API_URL", "https://localhost:8443/api"),
  wsUrl: getConfigValue("WS_URL", "wss://localhost:8443/ws"),
} as const;

// Log configuration on load (only in development)
if (window.APP_CONFIG) {
  console.log("🚀 Frontend config loaded:", config);
}
