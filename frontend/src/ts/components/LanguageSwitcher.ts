import { i18n } from "../utils/i18n.js";

export class LanguageSwitcher {
  private container: HTMLElement | null = null;

  init(): void {
    this.createContainer();
    this.render();
    this.attachEvents();

    window.addEventListener("languageChanged", () => {
      this.render();
      this.attachEvents();
    });
  }

  private createContainer(): void {
    this.container = document.createElement("div");
    this.container.id = "language-switcher";
    this.container.className = "fixed top-4 left-4 z-50";
    document.body.appendChild(this.container);
  }

  private render(): void {
    if (!this.container) return;

    const currentLang = i18n.getCurrentLanguage();

    this.container.innerHTML = `
      <select 
        id="lang-select" 
        class="bg-black/80 text-neon-green border-2 border-neon-pink rounded px-3 py-2 cursor-pointer hover:bg-neon-pink/20 transition"
      >
        <option value="en" ${
          currentLang === "en" ? "selected" : ""
        }>🇬🇧 English</option>
        <option value="de" ${
          currentLang === "de" ? "selected" : ""
        }>🇩🇪 Deutsch</option>
      </select>
    `;
  }

  private attachEvents(): void {
    if (!this.container) return;

    const select =
      this.container.querySelector<HTMLSelectElement>("#lang-select");
    if (select) {
      select.addEventListener("change", async (e) => {
        const target = e.target as HTMLSelectElement;
        const newLang = target.value;
        console.log("🔄 Changing language to:", newLang);
        await i18n.loadLanguage(newLang);
        console.log("✅ Language changed to:", newLang);
      });
    }
  }
}

export const languageSwitcher = new LanguageSwitcher();
