import { SecureTokenManager } from "./secureTokenManager.js";
import { config } from "../config.js";

let heartbeatInterval: number | null = null;

export const startHeartbeat = () => {
  console.log('Starting heartbeat - version 2.0 (no content-type header)');
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  const sendHeartbeat = async () => {
    if (!isUserAuthorized()) {
      stopHeartbeat();
      return;
    }

    try {
      const userId = getUserId();
      if (userId) {
        // Use XMLHttpRequest to avoid any potential fetch middleware issues
        const xhr = new XMLHttpRequest();
        xhr.open('PATCH', `${config.apiUrl}/api/users/${userId}/heartbeat`);
        xhr.setRequestHeader('Authorization', `Bearer ${getAccessToken()}`);
        // Explicitly do NOT set Content-Type header
        
        xhr.onload = function() {
          if (xhr.status === 200) {
            console.log('Heartbeat sent successfully (XHR method)');
          } else {
            console.error('Heartbeat failed (XHR):', xhr.status, xhr.responseText);
            
            if (xhr.status === 404 || xhr.status === 405) {
              console.warn('Heartbeat endpoint not available, stopping heartbeat');
              stopHeartbeat();
            }
          }
        };
        
        xhr.onerror = function() {
          console.error('Failed to send heartbeat (XHR error)');
        };
        
        xhr.send();
      }
    } catch (error) {
      console.error('Failed to send heartbeat:', error);
    }
  };

  sendHeartbeat();
  
  // Send heartbeat every 30 seconds
  heartbeatInterval = window.setInterval(sendHeartbeat, 30000);
};

export const stopHeartbeat = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
};

export const isUserAuthorized = (): boolean => {
  return (
    SecureTokenManager.getInstance().isAuthenticated() && localStorage.getItem("userId") !== null
  );
};

export const showError = (message: string): void => {
  const errorContainer = document.getElementById("error-container");
  if (errorContainer) {
    errorContainer.textContent = message;
    errorContainer.style.display = "block";
  }
};

export const getUserId = (): string | null => {
  return localStorage.getItem("userId");
};

export const getAccessToken = (): string | null => {
  return SecureTokenManager.getInstance().getAccessToken();
};

export const getUsername = (): string | null => {
  return localStorage.getItem("username");
};
