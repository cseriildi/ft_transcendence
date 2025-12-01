import { i18n } from "../utils/i18n.js";

export class LanguageSwitcher {
  private isListenerAttached = false;

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
      const currentValue = select.value || i18n.getCurrentLanguage();

      // Remove old listener if exists by cloning the element
      const newSelect = select.cloneNode(true) as HTMLSelectElement;
      select.parentNode?.replaceChild(newSelect, select);
      newSelect.value = currentValue;

      newSelect.addEventListener("change", async (e) => {
        const target = e.target as HTMLSelectElement;
        const newLang = target.value;
        await i18n.loadLanguage(newLang);
      });
    }
  }
}

export const languageSwitcher = new LanguageSwitcher();
