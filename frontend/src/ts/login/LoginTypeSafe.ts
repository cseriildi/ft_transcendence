/**
 * Login component using the type-safe API client
 * This version uses the auto-generated types from OpenAPI spec
 */

import { Router } from "../router/Router.js";
import { isUserAuthorized, showError } from "../utils/utils.js";
import { showErrorPopup } from "../main.js";
import { SecureTokenManager } from "../utils/secureTokenManager.js";
import {
  login,
  login2FA,
  requires2FA,
  type LoginSuccessData,
} from "../api/auth.js";

export class LoginTypeSafe {
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
      showErrorPopup("Email and password are required.");
      return { success: false, message: "Email and password are required." };
    }

    // Use the type-safe API
    const result = await login({ email, password });

    if (!result.success) {
      showErrorPopup(result.message || result.error);
      return { success: false, message: result.message || result.error };
    }

    // Check if 2FA is required
    if (requires2FA(result.data)) {
      this.tempToken = result.data.tempToken;
      this.show2FAForm();
      return { success: false, message: "2FA verification required" };
    }

    // Normal login success - store tokens and user data
    this.handleSuccessfulLogin(result.data);
    return { success: true };
  }

  private handleSuccessfulLogin(userData: LoginSuccessData): void {
    localStorage.setItem("userId", String(userData.id));
    localStorage.setItem("username", userData.username);
    SecureTokenManager.getInstance().setAccessToken(userData.tokens.accessToken);
  }

  private show2FAForm(): void {
    const loginForm = document.getElementById("login-form");
    const twofaForm = document.getElementById("twofa-form");

    loginForm?.classList.add("hidden");
    twofaForm?.classList.remove("hidden");

    const twofaInput = document.getElementById("twofa-code") as HTMLInputElement;
    twofaInput?.focus();
  }

  private showLoginForm(): void {
    const loginForm = document.getElementById("login-form");
    const twofaForm = document.getElementById("twofa-form");

    twofaForm?.classList.add("hidden");
    loginForm?.classList.remove("hidden");

    const twofaInput = document.getElementById("twofa-code") as HTMLInputElement;
    if (twofaInput) twofaInput.value = "";

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

    // Use the type-safe API
    const result = await login2FA({
      tempToken: this.tempToken,
      twofa_code: twofaCode,
    });

    // Always clear temp token after attempt
    this.clearTempToken();

    if (!result.success) {
      showErrorPopup(result.message || result.error);
      return { success: false, message: result.message || result.error };
    }

    // Success - store tokens and user data
    this.handleSuccessfulLogin(result.data);
    return { success: true };
  }

  initPage(): void {
    if (isUserAuthorized()) {
      this.router.navigate("/");
      return;
    }

    this.clearTempToken();

    const backBtn = document.getElementById("back-btn");
    const loginForm = document.getElementById("login-form");
    const twofaForm = document.getElementById("twofa-form");
    const registerBtn = document.getElementById("register-btn");
    const backToLoginBtn = document.getElementById("back-to-login");

    backBtn?.addEventListener("click", () => this.router.navigate("/"));

    loginForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const result = await this.handleFormSubmit(e);
      if (result.success) {
        this.router.navigate("/");
      } else if (result.message !== "2FA verification required") {
        showError(result.message || "An error occurred.");
      }
    });

    twofaForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const result = await this.handle2FASubmit(e);
      if (result.success) {
        this.router.navigate("/");
      } else {
        showError(result.message || "An error occurred.");
      }
    });

    backToLoginBtn?.addEventListener("click", () => this.showLoginForm());
    registerBtn?.addEventListener("click", () => this.router.navigate("/register"));

    const twofaInput = document.getElementById("twofa-code") as HTMLInputElement;
    twofaInput?.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      target.value = target.value.replace(/\D/g, "").slice(0, 6);
    });
  }
}
