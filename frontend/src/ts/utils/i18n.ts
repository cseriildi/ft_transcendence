type TranslationObject = { [key: string]: string | TranslationObject };

export class I18n {
  private translations: Record<string, TranslationObject> = {};
  private currentLang: string = "en";
  private supportedLangs: string[] = ["en", "de", "hu"];

  async init(): Promise<void> {
    const savedLang = localStorage.getItem("language");

    if (!savedLang) {
      const browserLang = this.detectBrowserLanguage();
      await this.loadLanguage(browserLang);
    } else {
      await this.loadLanguage(savedLang);
    }
  }

  private detectBrowserLanguage(): string {
    const browserLang = navigator.language || (navigator as any).userLanguage;

    const langCode = browserLang.split("-")[0].toLowerCase();

    if (this.supportedLangs.includes(langCode)) {
      return langCode;
    }

    return "en";
  }

  async loadLanguage(lang: string): Promise<void> {
    if (!this.supportedLangs.includes(lang)) {
      console.warn(`Language ${lang} not supported, using English`);
      lang = "en";
    }

    if (!this.translations[lang]) {
      try {
        const response = await fetch(`/locales/${lang}.json`);
        if (!response.ok) throw new Error(`Failed to load ${lang}.json`);

        this.translations[lang] = await response.json();
      } catch (error) {
        console.error(`❌ Error loading ${lang}:`, error);
        if (lang !== "en") {
          await this.loadLanguage("en");
        }
        return;
      }
    }

    this.currentLang = lang;
    localStorage.setItem("language", lang);
    this.updatePage();
  }

  t(key: string, vars?: Record<string, string | number>): string {
    const parts = key.split(".");
    let value: any = this.translations[this.currentLang];

    for (const part of parts) {
      if (value && typeof value === "object") {
        value = value[part];
      } else {
        value = undefined;
        break;
      }
    }

    if (!value && this.currentLang !== "en") {
      let fallback: any = this.translations["en"];
      for (const part of parts) {
        fallback = fallback?.[part];
      }
      value = fallback;
    }

    if (typeof value === "string") {
      let result = value;
      if (vars) {
        for (const k of Object.keys(vars)) {
          const re = new RegExp(`{{\\s*${k}\\s*}}`, "g");
          result = result.replace(re, String(vars[k]));
        }
      }
      return result;
    }

    console.warn(
      `i18n: missing translation for key=\"${key}\" in lang=\"${this.currentLang}\". Falling back to key.`
    );
    return key;
  }

  updatePage(): void {
    document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key) {
        el.textContent = this.t(key);
      }
    });

    document.querySelectorAll<HTMLInputElement>("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (key) {
        el.placeholder = this.t(key);
      }
    });

    const langSelect = document.querySelector<HTMLSelectElement>("#lang-select");
    if (langSelect) {
      langSelect.value = this.currentLang;
    }

    window.dispatchEvent(new CustomEvent("languageChanged"));
  }

  getCurrentLanguage(): string {
    return this.currentLang;
  }

  getSupportedLanguages(): string[] {
    return [...this.supportedLangs];
  }
}

export const i18n = new I18n();
