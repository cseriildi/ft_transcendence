import { TwoFactorAuth } from "../utils/TwoFactorAuth.js";
import { showErrorPopup, showSuccessPopup } from "../main.js";
import { i18n } from "../utils/i18n.js";

export class TwoFactorManager {
  private twoFactorAuth: TwoFactorAuth;
  private listenersInitialized: boolean = false;

  constructor() {
    this.twoFactorAuth = new TwoFactorAuth();
  }

  async updateStatus(userData?: any): Promise<void> {
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
      statusText.textContent = i18n.t("edit.statusError");
      statusText.className = "font-semibold text-red-400";
      return;
    }

    if (status.enabled) {
      statusText.textContent = i18n.t("edit.enabled");
      statusText.className = "font-semibold text-neon-green";
      enableBtn.classList.add("hidden");
      disableSection.classList.remove("hidden");
    } else {
      statusText.textContent = i18n.t("edit.disabled");
      statusText.className = "font-semibold text-neon-pink";
      enableBtn.classList.remove("hidden");
      disableSection.classList.add("hidden");
    }
  }

  setupEventListeners(
    onStartSetup: () => void,
    onEnable: () => void,
    onDisable: () => void,
    onCancel: () => void,
    onCopySecret: () => void
  ): void {
    // Prevent duplicate listener registration
    if (this.listenersInitialized) return;

    const enableBtn = document.getElementById("enable-2fa-btn");
    const disableBtn = document.getElementById("disable-2fa-btn");
    const cancelBtn = document.getElementById("cancel-setup-btn");
    const enableModalBtn = document.getElementById("enable-2fa-modal-btn");
    const copySecretBtn = document.getElementById("copy-secret-btn");
    const codeInput = document.getElementById("verification-code") as HTMLInputElement;
    const disableTokenInput = document.getElementById("disable-password") as HTMLInputElement;

    enableBtn?.addEventListener("click", onStartSetup);
    disableBtn?.addEventListener("click", onDisable);
    cancelBtn?.addEventListener("click", onCancel);
    enableModalBtn?.addEventListener("click", onEnable);
    copySecretBtn?.addEventListener("click", onCopySecret);

    // Allow Enter key to submit verification code and enable 2FA
    codeInput?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        onEnable();
      }
    });

    // Auto-format verification code input
    codeInput?.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      target.value = target.value.replace(/\D/g, "").slice(0, 6);
    });

    // Allow Enter key to submit disable 2FA
    disableTokenInput?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        onDisable();
      }
    });

    this.listenersInitialized = true;
  }

  async startSetup(): Promise<void> {
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

  async enableWithCode(): Promise<boolean> {
    const codeInput = document.getElementById("verification-code") as HTMLInputElement;
    if (!codeInput) return false;

    const code = codeInput.value.trim();
    if (code.length !== 6) {
      showErrorPopup(i18n.t("edit.enter6Digit"));
      return false;
    }

    const success = await this.twoFactorAuth.enable(code);
    if (success) {
      showSuccessPopup(i18n.t("edit_success.2fa_enabled"));
      return true;
    }
    return false;
  }

  async disable(): Promise<boolean> {
    const tokenInput = document.getElementById("disable-password") as HTMLInputElement;
    if (!tokenInput) return false;

    const token = tokenInput.value.trim();
    if (!token) {
      showErrorPopup(i18n.t("edit.enter2faCode"));
      return false;
    }

    const success = await this.twoFactorAuth.disable(token);
    if (success) {
      showSuccessPopup(i18n.t("edit_success.2fa_disabled"));
      tokenInput.value = "";
      return true;
    }
    return false;
  }

  cancelSetup(): void {
    const modal = document.getElementById("twofa-setup-modal");
    const codeInput = document.getElementById("verification-code") as HTMLInputElement;

    modal?.classList.add("hidden");
    if (codeInput) codeInput.value = "";

    this.twoFactorAuth.clearSetup();
  }

  async copySecretToClipboard(): Promise<void> {
    const secretElement = document.getElementById("manual-secret");
    if (!secretElement || !secretElement.textContent) return;

    try {
      await navigator.clipboard.writeText(secretElement.textContent);
      showSuccessPopup(i18n.t("edit.secretCopied"));
    } catch (error) {
      showErrorPopup(i18n.t("error.failedCopySecret"));
    }
  }
}
