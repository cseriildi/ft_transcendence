import { i18n } from "../utils/i18n.js";

export class LanguageSwitcher {
  private isListenerAttached = false;
  private selectChangeHandler: ((e: Event) => Promise<void>) | null = null;

  init(): void {
    this.attachEvents();
    this.updateSelect();

    if (!this.isListenerAttached) {
      window.addEventListener("languageChanged", () => {
        this.updateSelect();
      });
      this.isListenerAttached = true;
    }
  }

  private updateSelect(): void {
    const select = document.querySelector<HTMLSelectElement>("#lang-select");
    if (select) {
      const currentLang = i18n.getCurrentLanguage();
      select.value = currentLang;
    }
  }

  private attachEvents(): void {
    const select = document.querySelector<HTMLSelectElement>("#lang-select");
    if (select) {
      // Remove old listener if exists
      if (this.selectChangeHandler) {
        select.removeEventListener("change", this.selectChangeHandler);
      }

      // Create and store the handler
      this.selectChangeHandler = async (e: Event) => {
        const target = e.target as HTMLSelectElement;
        const newLang = target.value;
        await i18n.loadLanguage(newLang);
      };

      select.addEventListener("change", this.selectChangeHandler);
      select.value = i18n.getCurrentLanguage();
    }
  }
}

export const languageSwitcher = new LanguageSwitcher();
