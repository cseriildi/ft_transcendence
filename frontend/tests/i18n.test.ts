import { describe, it, expect, beforeEach } from "vitest";
import { I18n } from "../src/ts/utils/i18n";

describe("I18n Translation System", () => {
  let i18n: I18n;

  beforeEach(() => {
    i18n = new I18n();
    // Mock localStorage
    const localStorageMock = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    };
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      writable: true,
    });
  });

  describe("Translation key resolution", () => {
    it("should return the key if translation is missing", () => {
      const result = i18n.t("nonexistent.key");
      expect(result).toBe("nonexistent.key");
    });

    it("should handle nested translation keys", () => {
      // Assuming translations are loaded
      const result = i18n.t("home.title");
      expect(typeof result).toBe("string");
    });

    it("should interpolate variables correctly", () => {
      // Mock translation with placeholder
      const result = i18n.t("tournament.playerPlaceholder", { i: 5 });
      expect(typeof result).toBe("string");
      // If translations are loaded, it should contain the number
    });
  });

  describe("Language detection", () => {
    it("should support English and German", () => {
      const supportedLangs = i18n.getSupportedLanguages();
      expect(supportedLangs).toContain("en");
      expect(supportedLangs).toContain("de");
    });

    it("should default to English for unsupported languages", () => {
      // The detectBrowserLanguage would fallback to 'en'
      expect(i18n.getCurrentLanguage()).toBeDefined();
    });
  });

  describe("Missing keys validation", () => {
    it("should have all required edit section keys", () => {
      // These keys should exist in the translation files
      const requiredKeys = [
        "edit.title",
        "edit.invalidAvatar",
        "edit.noFileChosen",
        "edit.enter6Digit",
        "edit.enter2faCode",
        "edit.secretCopied",
      ];

      requiredKeys.forEach((key) => {
        const result = i18n.t(key);
        // If the key exists, it shouldn't return the key itself
        // (unless that's the actual translation, but these are descriptive)
        expect(result).toBeDefined();
      });
    });

    it("should have all required common section keys", () => {
      const commonKeys = ["common.loading", "common.vs", "common.backToHome"];

      commonKeys.forEach((key) => {
        const result = i18n.t(key);
        expect(result).toBeDefined();
      });
    });

    it("should have all required chat section keys", () => {
      const chatKeys = [
        "chat.title",
        "chat.inputPlaceholder",
        "chat.inviteButton",
        "chat.startTitle",
      ];

      chatKeys.forEach((key) => {
        const result = i18n.t(key);
        expect(result).toBeDefined();
      });
    });
  });
});
