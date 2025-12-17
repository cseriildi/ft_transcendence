import { i18n } from "../utils/i18n.js";

interface Route {
  path: string;
  template: string;
  init?: () => void;
}

class Router {
  private routes: Route[] = [];
  private templates: Map<string, string> = new Map();
  private i18nReadyCallback?: () => Promise<void>;

  constructor() {
    window.addEventListener("popstate", () => this.handleRoute());
    document.addEventListener("DOMContentLoaded", () => this.init());
  }

  setI18nCallback(callback: () => Promise<void>) {
    this.i18nReadyCallback = callback;
  }

  async init() {
    if (this.i18nReadyCallback) {
      await this.i18nReadyCallback();
    }

    await this.loadTemplates();
    this.handleRoute();
  }

  private async loadTemplates() {
    // Only load templates if they haven't been loaded yet
    if (this.templates.size > 0) {
      return;
    }

    const templateFiles = [
      "home",
      "pong",
      "login",
      "register",
      "profile",
      "edit",
      "users",
      "chat",
      "privacy",
      "terms",
      "404",
    ];

    for (const template of templateFiles) {
      try {
        const response = await fetch(`./templates/${template}.html`);
        const html = await response.text();
        this.templates.set(template, html);
      } catch (error) {
        // Template loading failed
      }
    }
  }

  addRoute(path: string, template: string, init?: () => void) {
    this.routes.push({ path, template, init });
  }

  navigate(path: string, params?: Record<string, string>) {
    let fullPath = path;
    if (params) {
      const queryString = new URLSearchParams(params).toString();
      fullPath = `${path}?${queryString}`;
    }
    window.history.pushState({}, "", fullPath);
    this.handleRoute();
  }

  getQueryParams(): Record<string, string> {
    const params: Record<string, string> = {};
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }

  private async handleRoute() {
    const currentPath = window.location.pathname;
    const route =
      this.routes.find((r) => r.path === currentPath) || this.routes.find((r) => r.path === "/404");

    if (route) {
      const template = this.templates.get(route.template);
      if (template) {
        const appElement = document.getElementById("app");
        if (appElement) {
          appElement.innerHTML = template;
          i18n.updatePage();
          const languageSwitcherModule = await import("../components/LanguageSwitcher.js");
          languageSwitcherModule.languageSwitcher.init();
          if (route.init) {
            route.init();
          }
        }
      }
    }
  }
}

export { Router };
