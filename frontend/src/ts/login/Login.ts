import { Router } from "../router/Router.js";
import { isUserAuthorized, showError } from "../utils/utils.js";
import { config } from "../config.js";
import { showErrorPopup } from "../main.js";
import { SecureTokenManager } from "../utils/secureTokenManager.js";

export class Login {
  private router: Router;
  private tempToken: string | null = null;

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
        // Check if 2FA is required
        if (data.data?.requires2fa && data.data?.tempToken) {
          this.tempToken = data.data.tempToken;
          this.show2FAForm();
          return { success: false, message: "2FA verification required" };
        }

        // Normal login success
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

  private show2FAForm(): void {
    const loginForm = document.getElementById("login-form");
    const twofaForm = document.getElementById("twofa-form");

    loginForm?.classList.add("hidden");
    twofaForm?.classList.remove("hidden");

    // Focus on the 2FA code input
    const twofaInput = document.getElementById("twofa-code") as HTMLInputElement;
    twofaInput?.focus();
  }

  private showLoginForm(): void {
    const loginForm = document.getElementById("login-form");
    const twofaForm = document.getElementById("twofa-form");

    twofaForm?.classList.add("hidden");
    loginForm?.classList.remove("hidden");

    // Clear the 2FA input
    const twofaInput = document.getElementById("twofa-code") as HTMLInputElement;
    if (twofaInput) twofaInput.value = "";

    // Security: Clear temp token immediately
    this.clearTempToken();
  }

  private clearTempToken(): void {
    this.tempToken = null;
  }

  private async handle2FASubmit(e: Event): Promise<{ success: boolean; message?: string }> {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const twofaCode = formData.get("twofa-code") as string | null;

    if (!twofaCode || twofaCode.length !== 6) {
      showErrorPopup("Please enter a 6-digit code");
      return { success: false, message: "Please enter a 6-digit code" };
    }

    if (!this.tempToken) {
      showErrorPopup("Session expired. Please log in again.");
      this.showLoginForm();
      return { success: false, message: "Session expired" };
    }

    try {
      const response = await fetch(`${config.apiUrl}/auth/login/2fa`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          tempToken: this.tempToken,
          twofa_code: twofaCode,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        // Security: Clear temp token immediately on successful authentication
        this.clearTempToken();

        if (data.data?.tokens?.accessToken && data.data?.id) {
          localStorage.setItem("userId", data.data.id);
          localStorage.setItem("username", data.data.username);

          SecureTokenManager.getInstance().setAccessToken(data.data.tokens.accessToken);
        }
        return { success: true };
      } else {
        // Security: Clear temp token on authentication failure
        this.clearTempToken();
        showErrorPopup(data.message || "2FA verification failed");
        return { success: false, message: data.message || "2FA verification failed" };
      }
    } catch (err) {
      // Security: Clear temp token on network error
      this.clearTempToken();
      console.error("Network error", err);
      showErrorPopup("Network error");
      return { success: false, message: "Network error" };
    }
  }

  initPage(): void {
    if (isUserAuthorized()) {
      this.router.navigate("/");
      return;
    }

    // Security: Clear any existing temp token when initializing login page
    this.clearTempToken();

    const backBtn = document.getElementById("back-btn");
    const loginForm = document.getElementById("login-form");
    const twofaForm = document.getElementById("twofa-form");
    const registerBtn = document.getElementById("register-btn");
    const backToLoginBtn = document.getElementById("back-to-login");

    // Back button navigation
    backBtn?.addEventListener("click", () => this.router.navigate("/"));

    // Regular login form submission
    loginForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const result = await this.handleFormSubmit(e);
      if (result.success) {
        this.router.navigate("/");
      } else if (result.message !== "2FA verification required") {
        showError(result.message || "An error occurred.");
      }
    });

    // 2FA form submission
    twofaForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const result = await this.handle2FASubmit(e);
      if (result.success) {
        this.router.navigate("/");
      } else {
        showError(result.message || "An error occurred.");
      }
    });

    // Back to login button
    backToLoginBtn?.addEventListener("click", () => this.showLoginForm());

    // Register button
    registerBtn?.addEventListener("click", () => this.router.navigate("/register"));

    // Auto-format 2FA code input
    const twofaInput = document.getElementById("twofa-code") as HTMLInputElement;
    twofaInput?.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      target.value = target.value.replace(/\D/g, "").slice(0, 6);
    });
  }
}
