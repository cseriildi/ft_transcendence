import { showErrorPopup } from "../main.js";
import { i18n } from "../utils/i18n.js";

export class FileInputHandler {
  private fileInput: HTMLInputElement;
  private fileNameDisplay: HTMLElement;
  private allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
  private fileChangeHandler: () => void;

  constructor(fileInput: HTMLInputElement, fileNameDisplay: HTMLElement) {
    this.fileInput = fileInput;
    this.fileNameDisplay = fileNameDisplay;
    this.fileChangeHandler = this.handleFileChange.bind(this);
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.fileInput.addEventListener("change", this.fileChangeHandler);
  }

  private handleFileChange(): void {
    if (this.fileInput.files && this.fileInput.files.length > 0) {
      const file = this.fileInput.files[0];

      if (!this.allowedTypes.includes(file.type)) {
        showErrorPopup(i18n.t("edit.invalidAvatar"));
        this.fileInput.value = "";
        this.fileNameDisplay.textContent = i18n.t("edit.noFileChosen");
        return;
      }

      this.fileNameDisplay.textContent = file.name;
    } else {
      this.fileNameDisplay.textContent = i18n.t("edit.noFileChosen");
    }
  }

  getSelectedFile(): File | null {
    return this.fileInput.files && this.fileInput.files.length > 0 ? this.fileInput.files[0] : null;
  }

  destroy(): void {
    this.fileInput.removeEventListener("change", this.fileChangeHandler);
  }
}
