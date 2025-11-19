import { Router } from "../router/Router.js";

class SecureTokenManager {
  private static instance: SecureTokenManager;
  private accessToken: string | null = null;
  private refreshTimer: number | null = null;
  private onTokenExpiry?: () => void;
  private router: Router;

  constructor(router: Router) {
    this.router = router;
  }

  static getInstance(router?: Router): SecureTokenManager {
    if (!SecureTokenManager.instance) {
      SecureTokenManager.instance = new SecureTokenManager(router || new Router());
    }
    return SecureTokenManager.instance;
  }

  setAccessToken(token: string): void {
    this.accessToken = token;

    this.scheduleTokenRefresh();
  }

  private scheduleTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    // Refresh token 3 minutes before expiration (15min - 3min = 12min)
    this.refreshTimer = window.setTimeout(
      async () => {
        try {
          await this.refreshAccessToken();
        } catch (error) {
          console.error("Scheduled token refresh failed:", error);
          this.handleTokenExpiry();
        }
      },
      12 * 60 * 1000
    );
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  clearTokens(): void {
    this.accessToken = null;
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  async refreshAccessToken(): Promise<void> {
    const { config } = await import("../config.js");

    const response = await fetch(`${config.apiUrl}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (response.ok) {
      const data = await response.json();
      if (data.data?.tokens?.accessToken) {
        this.setAccessToken(data.data.tokens.accessToken);
        console.log("🔄 Token refreshed successfully");
      }
    } else {
      throw new Error("Token refresh failed");
    }
  }

  setTokenExpiryCallback(callback: () => void): void {
    this.onTokenExpiry = callback;
  }

  handleTokenExpiry(): void {
    this.clearTokens();

    localStorage.removeItem("userId");
    localStorage.removeItem("username");

    // Use callback if available, otherwise fall back to window.location
    if (this.onTokenExpiry) {
      this.onTokenExpiry();
    } else {
      console.warn("No token expiry callback set, using window.location fallback");
      this.router.navigate("/");
    }
  }

  async initialize(): Promise<void> {
    // Check if we have a valid refresh token by trying to refresh
    try {
      await this.refreshAccessToken();
    } catch (error) {
      console.log("No valid session found");
    }
  }
}

export { SecureTokenManager };
