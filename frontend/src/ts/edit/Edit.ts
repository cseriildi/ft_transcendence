import { Router } from "../router/Router.js";
import { showErrorPopup, showSuccessPopup } from "../main.js";
import { config } from "../config.js";
import { getUserId, getAccessToken, isUserAuthorized } from "../utils/utils.js";
import { fetchWithRefresh } from "../utils/fetchUtils.js";
import { TwoFactorAuth } from "../utils/TwoFactorAuth.js";

export class Edit {
  private router: Router;
  private twoFactorAuth: TwoFactorAuth;

  constructor(router: Router) {
    this.router = router;
    this.twoFactorAuth = new TwoFactorAuth();
  }

  async handleFormSubmit(e: Event): Promise<{ success: boolean; message?: string }> {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const email = formData.get("email") as string | null;
    const username = formData.get("username") as string | null;

    if (!email || !username) {
      showErrorPopup("Email and username are required.");
      return { success: false, message: "Email and username are required." };
    }

    const userId = getUserId();

    if (!userId) {
      showErrorPopup("User ID not found. Please log in again.");
      return { success: false, message: "User ID not found." };
    }

    const emailInput = document.getElementById("email") as HTMLInputElement;
    const usernameInput = document.getElementById("username") as HTMLInputElement;
    const avatarInput = document.getElementById("avatar") as HTMLInputElement;

    const requests = [];
    const requestTypes: string[] = [];
    let newUsername: string | null = null;

    if (emailInput && email !== emailInput.defaultValue) {
      requests.push(
        fetchWithRefresh(`${config.apiUrl}/api/users/${userId}/email`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify({ email }),
          credentials: "include",
        })
      );
      requestTypes.push("email");
    }

    if (usernameInput && username !== usernameInput.defaultValue) {
      newUsername = username;
      requests.push(
        fetchWithRefresh(`${config.apiUrl}/api/users/${userId}/username`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify({ username }),
          credentials: "include",
        })
      );
      requestTypes.push("username");
    }

    if (avatarInput?.files?.length) {
      const formData = new FormData();
      formData.append("avatar", avatarInput.files[0]);

      requests.push(
        fetchWithRefresh(`${config.apiUrl}/api/users/avatar`, {
          method: "POST",
          body: formData,
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
          credentials: "include",
        })
      );
    }

    try {
      const responses = await Promise.all(requests);
      const errors = await Promise.all(
        responses.map(async (response, index) => {
          if (!response.ok) {
            const data = await response.json();
            return data.message || "Unknown error";
          } else {
            // If username update was successful, update localStorage
            if (requestTypes[index] === "username" && newUsername) {
              localStorage.setItem("username", newUsername);
              console.log("Username updated in localStorage:", newUsername);
            }
          }
          return null;
        })
      );

      const errorMessages = errors.filter((error) => error !== null);
      if (errorMessages.length > 0) {
        showErrorPopup(errorMessages.join("; "));
        return { success: false, message: errorMessages.join("; ") };
      }

      return { success: true };
    } catch (err) {
      console.error("Network error", err);
      showErrorPopup("Network error");
      return { success: false, message: "Network error" };
    }
  }

  async initPage(): Promise<void> {
    if (!isUserAuthorized()) {
      this.router.navigate("/");
      return;
    }

    const backBtn = document.getElementById("back-btn");
    const form = document.getElementById("edit-form");
    const fileInput = document.getElementById("avatar") as HTMLInputElement;
    const fileNameDisplay = document.getElementById("file-name");

    if (!fileInput || !fileNameDisplay) {
      console.error("File input or file name display element not found");
      return;
    }
    fileInput.addEventListener("change", () => {
      if (fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];

        if (!allowedTypes.includes(file.type)) {
          showErrorPopup("Only JPEG and PNG files are allowed for avatars.");
          fileInput.value = ""; // Clear the input
          fileNameDisplay.textContent = "No file chosen";
          return;
        }

        fileNameDisplay.textContent = file.name;
      } else {
        fileNameDisplay.textContent = "No file chosen";
      }
    });

    backBtn?.addEventListener("click", () => this.router.navigate("/profile"));
    form?.addEventListener("submit", async (e) => {
      const result = await this.handleFormSubmit(e);
      if (result.success) {
        this.router.navigate("/profile");
      }
    });

    try {
      const response = await fetchWithRefresh(`${config.apiUrl}/api/users/${getUserId()}`, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        const userData = await response.json();
        const emailInput = document.getElementById("email") as HTMLInputElement;
        const usernameInput = document.getElementById("username") as HTMLInputElement;
        if (emailInput && usernameInput) {
          emailInput.value = userData.data.email;
          usernameInput.value = userData.data.username;
        }

        // Initialize 2FA functionality with user data to avoid extra API call
        await this.init2FA(userData.data);
      } else {
        console.error("Failed to fetch user data");
        // Initialize 2FA functionality without user data (will make its own API call)
        await this.init2FA();
      }
    } catch (err) {
      console.error("Error fetching user data", err);
      // Initialize 2FA functionality without user data (will make its own API call)
      await this.init2FA();
    }
  }

  private async init2FA(userData?: any): Promise<void> {
    await this.update2FAStatus(userData);
    this.setup2FAEventListeners();
  }

  private async update2FAStatus(userData?: any): Promise<void> {
    const statusText = document.getElementById("twofa-status-text");
    const enableBtn = document.getElementById("enable-2fa-btn");
    const disableSection = document.getElementById("disable-2fa-section");

    if (!statusText || !enableBtn || !disableSection) return;

    let status;
    if (userData && userData.twofa_enabled !== undefined) {
      // Use already fetched user data to avoid extra API call
      status = {
        enabled: userData.twofa_enabled === 1,
        configured: userData.twofa_enabled === 1,
      };
    } else {
      // Fallback to API call if user data not available
      status = await this.twoFactorAuth.getStatus();
    }

    if (status === null) {
      statusText.textContent = "Error loading status";
      statusText.className = "font-semibold text-red-400";
      return;
    }

    if (status.enabled) {
      statusText.textContent = "Enabled";
      statusText.className = "font-semibold text-neon-green";
      enableBtn.classList.add("hidden");
      disableSection.classList.remove("hidden");
    } else {
      statusText.textContent = "Disabled";
      statusText.className = "font-semibold text-neon-pink";
      enableBtn.classList.remove("hidden");
      disableSection.classList.add("hidden");
    }
  }

  private setup2FAEventListeners(): void {
    const enableBtn = document.getElementById("enable-2fa-btn");
    const disableBtn = document.getElementById("disable-2fa-btn");
    const cancelBtn = document.getElementById("cancel-setup-btn");
    const enableModalBtn = document.getElementById("enable-2fa-modal-btn");

    enableBtn?.addEventListener("click", () => this.startSetup2FA());
    disableBtn?.addEventListener("click", () => this.disable2FA());
    cancelBtn?.addEventListener("click", () => this.cancelSetup2FA());
    enableModalBtn?.addEventListener("click", () => this.enableWith2FACode());

    // Allow Enter key to submit verification code and enable 2FA
    const codeInput = document.getElementById("verification-code") as HTMLInputElement;
    codeInput?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.enableWith2FACode();
      }
    });

    // Auto-format verification code input
    codeInput?.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      target.value = target.value.replace(/\D/g, "").slice(0, 6);
    });

    // Allow Enter key to submit disable 2FA
    const disablePasswordInput = document.getElementById("disable-password") as HTMLInputElement;
    disablePasswordInput?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.disable2FA();
      }
    });

    // Copy secret button functionality
    const copySecretBtn = document.getElementById("copy-secret-btn");
    copySecretBtn?.addEventListener("click", () => this.copySecretToClipboard());
  }

  private async startSetup2FA(): Promise<void> {
    const setupData = await this.twoFactorAuth.setup();
    if (!setupData) return;

    const modal = document.getElementById("twofa-setup-modal");
    const qrImg = document.getElementById("qr-code-img") as HTMLImageElement;
    const secretSpan = document.getElementById("manual-secret");
    const codeInput = document.getElementById("verification-code") as HTMLInputElement;

    if (!modal || !qrImg || !secretSpan) return;

    // Show the setup modal
    modal.classList.remove("hidden");

    // Debug: log QR URL so we can inspect it in the browser console
    console.debug("2FA QR code URL:", setupData.qr_code);

    // Set QR code and secret, handle load/error to help debugging invisible images
    // Hide the image until it loads to avoid flashing a broken icon
    qrImg.classList.add("opacity-0");
    qrImg.onload = () => {
      qrImg.classList.remove("opacity-0");
      console.debug("QR image loaded, natural size:", qrImg.naturalWidth, qrImg.naturalHeight);
    };
    qrImg.onerror = (e) => {
      console.error("QR image failed to load", e, setupData.qr_code);
      qrImg.alt = "Failed to load QR code";
    };

    qrImg.src = setupData.qr_code;
    secretSpan.textContent = setupData.secret;

    // Reset form state
    if (codeInput) codeInput.value = "";

    // Scroll to modal
    modal.scrollIntoView({ behavior: "smooth" });
  }

  private async enableWith2FACode(): Promise<void> {
    const codeInput = document.getElementById("verification-code") as HTMLInputElement;
    if (!codeInput) return;

    const code = codeInput.value.trim();
    if (code.length !== 6) {
      showErrorPopup("Please enter a 6-digit code");
      return;
    }

    const success = await this.twoFactorAuth.enable(code);
    if (success) {
      showSuccessPopup("Two-Factor Authentication enabled successfully!");
      this.cancelSetup2FA();
      await this.update2FAStatus();
    }
  }

  private async disable2FA(): Promise<void> {
    const passwordInput = document.getElementById("disable-password") as HTMLInputElement;
    if (!passwordInput) return;

    const password = passwordInput.value.trim();
    if (!password) {
      showErrorPopup("Please enter your 2FA code");
      return;
    }

    const success = await this.twoFactorAuth.disable(password);
    if (success) {
      showSuccessPopup("Two-Factor Authentication disabled successfully!");
      passwordInput.value = "";
      await this.update2FAStatus();
    }
  }

  private cancelSetup2FA(): void {
    const modal = document.getElementById("twofa-setup-modal");
    const codeInput = document.getElementById("verification-code") as HTMLInputElement;

    modal?.classList.add("hidden");
    if (codeInput) codeInput.value = "";

    this.twoFactorAuth.clearSetup();
  }

  private async copySecretToClipboard(): Promise<void> {
    const secretElement = document.getElementById("manual-secret");
    if (!secretElement || !secretElement.textContent) return;

    try {
      await navigator.clipboard.writeText(secretElement.textContent);
      showSuccessPopup("Secret copied to clipboard!");
    } catch (error) {
      showErrorPopup("Failed to copy secret to clipboard");
    }
  }
}

export default Edit;
