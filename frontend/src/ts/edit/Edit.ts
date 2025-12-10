import { Router } from "../router/Router.js";
import { isUserAuthorized } from "../utils/utils.js";
import { ProfileUpdater } from "./ProfileUpdater.js";
import { FormHandler } from "./FormHandler.js";
import { FileInputHandler } from "./FileInputHandler.js";
import { TwoFactorManager } from "./TwoFactorManager.js";
import { i18n } from "../utils/i18n.js";

export class Edit {
  private router: Router;
  private profileUpdater: ProfileUpdater;
  private formHandler: FormHandler;
  private fileInputHandler: FileInputHandler | null = null;
  private twoFactorManager: TwoFactorManager;
  private backBtnHandler: (() => void) | null = null;
  private formSubmitHandler: ((e: Event) => Promise<void>) | null = null;

  constructor(router: Router) {
    this.router = router;
    this.profileUpdater = new ProfileUpdater();
    this.formHandler = new FormHandler(this.profileUpdater);
    this.twoFactorManager = new TwoFactorManager();
  }

  public destroy(): void {
    // Clean up back button listener
    if (this.backBtnHandler) {
      const backBtn = document.getElementById("back-btn");
      backBtn?.removeEventListener("click", this.backBtnHandler);
      this.backBtnHandler = null;
    }

    // Clean up form submit listener
    if (this.formSubmitHandler) {
      const form = document.getElementById("edit-form");
      form?.removeEventListener("submit", this.formSubmitHandler);
      this.formSubmitHandler = null;
    }

    // Clean up file input handler
    if (this.fileInputHandler) {
      this.fileInputHandler.destroy();
      this.fileInputHandler = null;
    }
  }

  async initPage(): Promise<void> {
    if (!isUserAuthorized()) {
      this.router.navigate("/");
      return;
    }

    this.setupBasicEventListeners();
    this.setupFileInput();
    const userData = await this.loadUserData();
    this.setup2FA();
    await this.update2FAStatus(userData);
  }

  private setupBasicEventListeners(): void {
    const backBtn = document.getElementById("back-btn");
    const form = document.getElementById("edit-form");

    // Store handler references for cleanup
    this.backBtnHandler = () => this.router.navigate("/profile");
    this.formSubmitHandler = async (e: Event) => {
      e.preventDefault();
      const result = await this.formHandler.handleSubmit(e.target as HTMLFormElement);
      if (result.success) {
        this.router.navigate("/profile");
      }
    };

    backBtn?.addEventListener("click", this.backBtnHandler);
    form?.addEventListener("submit", this.formSubmitHandler);
  }

  private setupFileInput(): void {
    const fileInput = document.getElementById("avatar") as HTMLInputElement;
    const fileNameDisplay = document.getElementById("file-name");

    if (!fileInput || !fileNameDisplay) {
      console.error("File input or file name display element not found");
      return;
    }

    this.fileInputHandler = new FileInputHandler(fileInput, fileNameDisplay);
  }

  private async loadUserData(): Promise<any> {
    try {
      const userData = await this.profileUpdater.getUserData();
      const emailInput = document.getElementById("email") as HTMLInputElement;
      const usernameInput = document.getElementById("username") as HTMLInputElement;

      if (emailInput && usernameInput) {
        emailInput.value = userData.email;
        usernameInput.value = userData.username;
      }

      return userData;
    } catch (err) {
      console.error("Error fetching user data", err);
      return null;
    }
  }

  private setup2FA(): void {
    this.twoFactorManager.setupEventListeners(
      () => this.startSetup2FA(),
      () => this.enableWith2FACode(),
      () => this.disable2FA(),
      () => this.cancelSetup2FA(),
      () => this.copySecretToClipboard()
    );
  }

  private async startSetup2FA(): Promise<void> {
    await this.twoFactorManager.startSetup();
  }

  private async enableWith2FACode(): Promise<void> {
    const success = await this.twoFactorManager.enableWithCode();
    if (success) {
      this.cancelSetup2FA();
      await this.update2FAStatus();
    }
  }

  private async disable2FA(): Promise<void> {
    const success = await this.twoFactorManager.disable();
    if (success) {
      await this.update2FAStatus();
    }
  }

  private cancelSetup2FA(): void {
    this.twoFactorManager.cancelSetup();
  }

  private async copySecretToClipboard(): Promise<void> {
    await this.twoFactorManager.copySecretToClipboard();
  }

  private async update2FAStatus(userData?: any): Promise<void> {
    await this.twoFactorManager.updateStatus(userData);
  }
}

export default Edit;
