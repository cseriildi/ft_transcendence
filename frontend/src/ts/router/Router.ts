interface Route {
  path: string;
  template: string;
  init?: () => void;
}

class Router {
  private routes: Route[] = [];
  private templates: Map<string, string> = new Map();

  constructor() {
    window.addEventListener('popstate', () => this.handleRoute());
    document.addEventListener('DOMContentLoaded', () => this.init());
  }

  async init() {
    await this.loadTemplates();
    this.handleRoute();
  }

  private async loadTemplates() {
    const templateFiles = ['home', 'pong', 'login', 'register', 'profile', 'edit', '404'];
    
    for (const template of templateFiles) {
      try {
        const response = await fetch(`./templates/${template}.html`);
        const html = await response.text();
        this.templates.set(template, html);
      } catch (error) {
        console.error(`Failed to load template: ${template}`, error);
      }
    }
  }

  addRoute(path: string, template: string, init?: () => void) {
    this.routes.push({ path, template, init });
  }

  navigate(path: string) {
    window.history.pushState({}, '', path);
    this.handleRoute();
  }

  private handleRoute() {
    const currentPath = window.location.pathname;
    const route = this.routes.find(r => r.path === currentPath) || this.routes.find(r => r.path === '/404');
    
    if (route) {
      const template = this.templates.get(route.template);
      if (template) {
        const appElement = document.getElementById('app');
        if (appElement) {
          appElement.innerHTML = template;
          if (route.init) {
            route.init();
          }
        }
      }
    }
  }
}

export { Router };
