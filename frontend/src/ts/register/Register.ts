import { Router } from "../router/Router.js";
import { isUserAuthorized, showError } from "../utils/utils.js";
import { config } from "../config.js";
import { showErrorPopup } from "../main.js";
import { SecureTokenManager } from "../utils/secureTokenManager.js";
import { i18n } from "../utils/i18n.js";
import { mapBackendError } from "../utils/errorMapper.js";

export class Register {
  private router: Router;

  constructor(router: Router) {
    this.router = router;
  }

  async handleFormSubmit(e: Event): Promise<{ success: boolean; message?: string }> {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const email = formData.get("email") as string | null;
    const username = formData.get("username") as string | null;
    const password = formData.get("password") as string | null;
    const confirmPassword = formData.get("confirmPassword") as string | null;

    if (!email || !username || !password || !confirmPassword) {
      showErrorPopup(i18n.t("register.allFieldsRequired"));
      return { success: false, message: i18n.t("register.allFieldsRequired") };
    }

    // Validate email format
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      showErrorPopup(i18n.t("register.invalidEmailFormat"));
      return { success: false, message: i18n.t("register.invalidEmailFormat") };
    }

    // Validate username length
    if (username.length < 3) {
      showErrorPopup(i18n.t("register.usernameTooShort"));
      return { success: false, message: i18n.t("register.usernameTooShort") };
    }
    if (username.length > 15) {
      showErrorPopup(i18n.t("register.usernameTooLong"));
      return { success: false, message: i18n.t("register.usernameTooLong") };
    }

    // Validate username pattern: only letters, numbers, hyphens, and underscores
    const usernamePattern = /^[a-zA-Z0-9_-]+$/;
    if (!usernamePattern.test(username)) {
      showErrorPopup(i18n.t("register.invalidUsername"));
      return { success: false, message: i18n.t("register.invalidUsername") };
    }

    // Validate password length (production requirement: min 10 characters)
    if (password.length < 10) {
      showErrorPopup(i18n.t("register.passwordTooShort"));
      return { success: false, message: i18n.t("register.passwordTooShort") };
    }

    // Validate password contains at least one number
    if (!/\d/.test(password)) {
      showErrorPopup(i18n.t("register.passwordNoNumber"));
      return { success: false, message: i18n.t("register.passwordNoNumber") };
    }

    try {
      const response = await fetch(`${config.apiUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, username, password, confirmPassword }),
      });
      const data = await response.json();
      if (response.ok) {
        if (data.data?.tokens?.accessToken) {
          localStorage.setItem("userId", data.data.id);
          localStorage.setItem("username", data.data.username);

          SecureTokenManager.getInstance().setAccessToken(data.data.tokens.accessToken);
        }
        return { success: true };
      } else {
        const errorMsg = mapBackendError(data.error, data.message, "register.registrationFailed");
        showErrorPopup(errorMsg);
        return {
          success: false,
          message: errorMsg,
        };
      }
    } catch (err) {
      showErrorPopup(i18n.t("register.networkError"));
      return { success: false, message: i18n.t("register.networkError") };
    }
  }

  initPage(): void {
    if (isUserAuthorized()) {
      this.router.navigate("/");
      return;
    }

    const backBtn = document.getElementById("back-btn");
    const form = document.getElementById("register-form");
    const loginBtn = document.getElementById("login-btn");

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
    loginBtn?.addEventListener("click", () => this.router.navigate("/login"));
  }
}
