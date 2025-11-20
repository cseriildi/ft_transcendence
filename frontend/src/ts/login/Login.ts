import { Router } from "../router/Router.js";
import { isUserAuthorized, showError } from "../utils/utils.js";
import { config } from "../config.js";
import { showErrorPopup } from "../main.js";
import { SecureTokenManager } from "../utils/secureTokenManager.js";

export class Login {
  private router: Router;

  constructor(router: Router) {
    this.router = router;
  }

  async handleFormSubmit(e: Event): Promise<{ success: boolean; message?: string }> {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const email = formData.get("email") as string | null;
    const password = formData.get("password") as string | null;

    if (!email || !password) {
      showErrorPopup("Email and password are required."); // Show popup for empty inputs
      return { success: false, message: "Email and password are required." };
    }

    try {
      const response = await fetch(`${config.apiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        if (data.data?.tokens?.accessToken && data.data?.id) {
          localStorage.setItem("userId", data.data.id);
          localStorage.setItem("username", data.data.username);

          SecureTokenManager.getInstance().setAccessToken(data.data.tokens.accessToken);
        }
        return { success: true };
      } else {
        showErrorPopup(data.message || "Login failed");
        return { success: false, message: data.message || "Login failed" };
      }
    } catch (err) {
      console.error("Network error", err);
      showErrorPopup("Network error");
      return { success: false, message: "Network error" };
    }
  }

  async handleGitHubOAuth(): Promise<void> {
    try {
      const response = await fetch(`${config.apiUrl}/api/oauth/github`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        showErrorPopup(errorData.message || "Failed to initiate GitHub OAuth");
        return;
      }

      const data = await response.json();
      if (data.success && data.data?.redirectUrl) {
        // Redirect to GitHub OAuth
        window.location.href = data.data.redirectUrl;
      } else {
        showErrorPopup("Failed to get GitHub OAuth URL");
      }
    } catch (err) {
      console.error("GitHub OAuth error", err);
      showErrorPopup("Network error during GitHub OAuth");
    }
  }

  async handleOAuthCallback(): Promise<void> {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    const error = urlParams.get("error");

    if (error) {
      showErrorPopup(`OAuth error: ${error}`);
      this.router.navigate("/login");
      return;
    }

    if (!code || !state) {
      showErrorPopup("Invalid OAuth callback parameters");
      this.router.navigate("/login");
      return;
    }

    try {
      const response = await fetch(
        `${config.apiUrl}/api/oauth/github/callback?code=${code}&state=${state}`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        showErrorPopup(errorData.message || "OAuth callback failed");
        this.router.navigate("/login");
        return;
      }

      const data = await response.json();
      if (data.success && data.data?.tokens?.accessToken && data.data?.id) {
        localStorage.setItem("userId", data.data.id);
        localStorage.setItem("username", data.data.username);
        SecureTokenManager.getInstance().setAccessToken(data.data.tokens.accessToken);

        // Clear the URL parameters and navigate to home
        window.history.replaceState({}, document.title, window.location.pathname);
        this.router.navigate("/");
      } else {
        showErrorPopup("OAuth authentication failed");
        this.router.navigate("/login");
      }
    } catch (err) {
      console.error("OAuth callback error", err);
      showErrorPopup("Network error during OAuth callback");
      this.router.navigate("/login");
    }
  }

  initPage(): void {
    if (isUserAuthorized()) {
      this.router.navigate("/");
      return;
    }

    // Check if this is an OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("code") && urlParams.has("state")) {
      this.handleOAuthCallback();
      return;
    }

    const backBtn = document.getElementById("back-btn");
    const form = document.getElementById("login-form");
    const registerBtn = document.getElementById("register-btn");
    const githubOAuthBtn = document.getElementById("github-oauth-btn");

    backBtn?.addEventListener("click", () => this.router.navigate("/"));
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const result = await this.handleFormSubmit(e);
      if (result.success) {
        this.router.navigate("/");
      } else {
        showError(result.message || "An error occurred.");
      }
    });
    registerBtn?.addEventListener("click", () => this.router.navigate("/register"));
    githubOAuthBtn?.addEventListener("click", () => this.handleGitHubOAuth());
  }
}
