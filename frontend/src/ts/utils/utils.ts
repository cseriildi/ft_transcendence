export const isUserAuthorized = (): boolean => {
  return localStorage.getItem("accessToken") !== null;
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
  return localStorage.getItem("accessToken");
};

export const getUsername = (): string | null => {
  return localStorage.getItem("username");
};
