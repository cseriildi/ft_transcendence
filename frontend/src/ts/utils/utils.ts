import { SecureTokenManager } from "./secureTokenManager.js";

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
