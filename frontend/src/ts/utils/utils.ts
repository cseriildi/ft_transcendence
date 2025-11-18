import { SecureTokenManager } from "./secureTokenManager.js";
import { config } from "../config.js";

let heartbeatInterval: number | null = null;

export const startHeartbeat = () => {
  console.log("Starting heartbeat - version 2.0 (no content-type header)");
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
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
            console.log("Heartbeat sent successfully (XHR method)");
            resolve();
          } else if (xhr.status === 401 && retryOnAuth) {
            console.log("Heartbeat failed with 401, attempting token refresh...");
            try {
              await SecureTokenManager.getInstance().refreshAccessToken();
              console.log("Token refreshed, retrying heartbeat...");
              // Retry once with the new token
              await attemptHeartbeat(false);
              resolve();
            } catch (refreshError) {
              console.error("Token refresh failed during heartbeat:", refreshError);
              stopHeartbeat();
              reject(refreshError);
            }
          } else {
            console.error("Heartbeat failed (XHR):", xhr.status, xhr.responseText);

            if (xhr.status === 404 || xhr.status === 405) {
              console.warn("Heartbeat endpoint not available, stopping heartbeat");
              stopHeartbeat();
            }
            reject(new Error(`Heartbeat failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = function () {
          console.error("Failed to send heartbeat (XHR error)");
          reject(new Error("XHR error"));
        };

        xhr.send();
      });
    };

    try {
      await attemptHeartbeat();
    } catch (error) {
      console.error("Failed to send heartbeat:", error);
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
