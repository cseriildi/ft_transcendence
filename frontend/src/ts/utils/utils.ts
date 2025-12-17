import { SecureTokenManager } from "./secureTokenManager.js";
import { config } from "../config.js";

let heartbeatInterval: number | null = null;
let isStartingHeartbeat = false;

export const startHeartbeat = () => {
  // Prevent concurrent calls
  if (isStartingHeartbeat) {
    return;
  }

  isStartingHeartbeat = true;

  try {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  } finally {
    // Ensure flag is reset even if clearing fails
    isStartingHeartbeat = false;
  }

  const sendHeartbeat = async () => {
    if (!isUserAuthorized()) {
      stopHeartbeat();
      return;
    }

    const attemptHeartbeat = async (retryOnAuth = true): Promise<void> => {
      const userId = getUserId();
      if (!userId) return;

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PATCH", `${config.apiUrl}/api/users/${userId}/heartbeat`);
        xhr.setRequestHeader("Authorization", `Bearer ${getAccessToken()}`);
        // Explicitly do NOT set Content-Type header

        xhr.onload = async function () {
          if (xhr.status === 200) {
            resolve();
          } else if (xhr.status === 401 && retryOnAuth) {
            try {
              await SecureTokenManager.getInstance().refreshAccessToken();
              // Retry once with the new token
              await attemptHeartbeat(false);
              resolve();
            } catch (refreshError) {
              stopHeartbeat();
              reject(refreshError);
            }
          } else {
            if (xhr.status === 404 || xhr.status === 405) {
              stopHeartbeat();
            }
            reject(new Error(`Heartbeat failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = function () {
          reject(new Error("XHR error"));
        };

        xhr.send();
      });
    };

    try {
      await attemptHeartbeat();
    } catch (error) {
      // Failed to send heartbeat
    }
  };

  sendHeartbeat();

  // Send heartbeat every 30 seconds
  heartbeatInterval = window.setInterval(sendHeartbeat, 30000);
};

export const stopHeartbeat = () => {
  // Wait for any ongoing start operation to complete
  if (isStartingHeartbeat) {
    // Use a small timeout to allow the start operation to finish
    setTimeout(() => stopHeartbeat(), 10);
    return;
  }

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
