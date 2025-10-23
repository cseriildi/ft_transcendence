export const isUserAuthorized = (): boolean => {
    const cookies = document.cookie.split("; ");
    return cookies.some((cookie) => cookie.startsWith("accessToken="));
};

export const showError = (message: string): void => {
    const errorContainer = document.getElementById("error-container");
    if (errorContainer) {
        errorContainer.textContent = message;
        errorContainer.style.display = "block";
    }
};

export const getUserId = (): string | null => {
    const match = document.cookie.match(/(?:^|; )userId=([^;]*)/);
    return match ? match[1] : null;
}

export const getAccessToken = (): string | null =>{
    const match = document.cookie.match(/(?:^|; )accessToken=([^;]*)/);
    return match ? match[1] : null;
}
