import { Router } from "../router/Router.js";
import { isUserAuthorized } from "../utils/utils.js";
import { ProfileUpdater } from "./ProfileUpdater.js";
import { FormHandler } from "./FormHandler.js";
import { FileInputHandler } from "./FileInputHandler.js";
import { TwoFactorManager } from "./TwoFactorManager.js";

export class Edit {
  private router: Router;
  private profileUpdater: ProfileUpdater;
  private formHandler: FormHandler;
  private fileInputHandler: FileInputHandler | null = null;
  private twoFactorManager: TwoFactorManager;

  constructor(router: Router) {
    this.router = router;
    this.profileUpdater = new ProfileUpdater();
    this.formHandler = new FormHandler(this.profileUpdater);
    this.twoFactorManager = new TwoFactorManager();
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

    backBtn?.addEventListener("click", () => this.router.navigate("/profile"));
    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const result = await this.formHandler.handleSubmit(e.target as HTMLFormElement);
      if (result.success) {
        this.router.navigate("/profile");
      }
    });
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
