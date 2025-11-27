type TranslationObject = { [key: string]: string | TranslationObject };

export class I18n {
  private translations: Record<string, TranslationObject> = {};
  private currentLang: string = "en";
  private supportedLangs: string[] = ["en", "de"];

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
      console.log(`🌍 Detected browser language: ${langCode}`);
      return langCode;
    }
    
    console.log(`🌍 Browser language ${browserLang} not supported, using English`);
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
        console.log(`✅ Loaded ${lang} translations`);
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

  t(key: string): string {
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

    return typeof value === "string" ? value : key;
  }

  updatePage(): void {
    console.log("🔄 updatePage called, current language:", this.currentLang);
    document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key) {
        const translation = this.t(key);
        console.log(`  Translating ${key} to: ${translation}`);
        el.textContent = translation;
      }
    });

    document
      .querySelectorAll<HTMLInputElement>("[data-i18n-placeholder]")
      .forEach((el) => {
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
