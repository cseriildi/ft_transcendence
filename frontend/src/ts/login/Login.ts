import { Router } from "../router/Router.js";
import { isUserAuthorized, showError } from "../utils/utils.js";
import { config } from "../config.js";
import { showErrorPopup } from "../main.js";

export class Login {
  private router: Router;

  constructor(router: Router) {
    this.router = router;
  }

  async handleFormSubmit(e: Event): Promise<{ success: boolean; message?: string }> {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const email = formData.get('email') as string | null;
    const password = formData.get('password') as string | null;

    if (!email || !password) {
      showErrorPopup("Email and password are required."); // Show popup for empty inputs
      return { success: false, message: "Email and password are required." };
    }

    try {
      const response = await fetch(`${config.apiUrl}/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        if (data.data?.tokens?.accessToken && data.data?.id) {
          sessionStorage.setItem('userId', data.data.id);
          sessionStorage.setItem('accessToken', data.data.tokens.accessToken);
          sessionStorage.setItem('username', data.data.username);
        }
        return { success: true };
      } else {
        showErrorPopup(data.message || 'Login failed');
        return { success: false, message: data.message || 'Login failed' };
      }
    } catch (err) {
      console.error('Network error', err);
      showErrorPopup('Network error');
      return { success: false, message: 'Network error' };
    }
  }

  initPage(): void {
    if (isUserAuthorized()) {
      this.router.navigate("/");
      return;
    }

    const backBtn = document.getElementById("back-btn");
    const form = document.getElementById("login-form");
    const registerBtn = document.getElementById("register-btn");

    backBtn?.addEventListener("click", () => this.router.navigate("/"));
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const result = await this.handleFormSubmit(e);
      if (result.success) {
        this.router.navigate("/");
      } else {
        showError(result.message || 'An error occurred.');
      }
    });
    registerBtn?.addEventListener("click", () => this.router.navigate("/register"));
  }
}
