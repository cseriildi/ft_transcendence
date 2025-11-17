import { Router } from "./router/Router.js";
import { Pong } from "./pong/Pong.js";
import { Login } from "./login/Login.js";
import { Register } from "./register/Register.js";
import { Home } from "./home/Home.js";
import { Profile } from "./profile/Profile.js";
import { Edit } from "./edit/Edit.js";
import { Chat } from "./chat/Chat.js";
import { config } from "./config.js";
import { Users } from "./users/Users.js";
import { SecureTokenManager } from "./utils/secureTokenManager.js";

let currentPong: Pong | null = null;

window.addEventListener("popstate", () => {
  // If we're leaving the /pong route, destroy the Pong instance
  if (window.location.pathname !== "/pong") {
    if (currentPong) {
      currentPong.destroy();
      currentPong = null;
      console.log("Pong destroyed due to navigation");
    }
  }
});

const initPongPage = () => {
  const backBtn = document.getElementById("back-btn");
  backBtn?.addEventListener("click", () => {
    currentPong?.destroy();
    currentPong = null;
    router.navigate("/");
  });

  // New Game button: destroy existing game instance for this tab and create a fresh one
  const newGameBtn = document.getElementById("new-game-btn");
  newGameBtn?.addEventListener("click", () => {
    // If a pong exists, destroy it so server will delete its game instance on disconnect
    if (currentPong) {
      currentPong.destroy();
      currentPong = null;
    }

    const canvas = document.getElementById("pong-canvas") as HTMLCanvasElement;
    if (canvas) {
      currentPong = new Pong("pong-canvas", `${config.wsUrl}/game`);
      // Tell server to start a fresh game tied to this connection
      currentPong.startGame();
    } else {
      console.error("❌ Pong canvas not found");
    }
  });

  // Do not auto-create a Pong instance on page load. The New Game button will create and start a game.
  const canvas = document.getElementById("pong-canvas") as HTMLCanvasElement;
  if (!canvas) {
    console.error("❌ Pong canvas not found");
  }
};

const initNotFoundPage = () => {
  const homeBtn = document.getElementById("home-btn");
  homeBtn?.addEventListener("click", () => router.navigate("/"));
};

const router = new Router();
const loginPage = new Login(router);
const registerPage = new Register(router);
const homePage = new Home(router);
const profilePage = new Profile(router);
const editPage = new Edit(router);
const usersPage = new Users(router);
const chatPage = new Chat(router);

router.addRoute("/", "home", () => homePage.initPage());
router.addRoute("/pong", "pong", initPongPage);
router.addRoute("/login", "login", () => loginPage.initPage());
router.addRoute("/register", "register", () => registerPage.initPage());
router.addRoute("/profile", "profile", () => profilePage.initPage());
router.addRoute("/edit", "edit", () => editPage.initPage());
router.addRoute("/users", "users", () => usersPage.initPage());
router.addRoute("/chat", "chat", () => chatPage.initPage());
router.addRoute("/404", "404", initNotFoundPage);

const createPopup = () => {
  const popup = document.getElementById("error-popup");
  if (!popup) {
    console.error("Popup element not found in the HTML.");
  }
};

export const showErrorPopup = (message: string) => {
  const popup = document.getElementById("error-popup");
  if (popup) {
    popup.textContent = message;
    popup.style.display = "block";
    setTimeout(() => {
      popup.style.display = "none";
    }, 5000);
  }
};

createPopup();

(async () => {
  const tokenManager = SecureTokenManager.getInstance();

  tokenManager.setTokenExpiryCallback(() => {
    showErrorPopup("Session expired. Please log in again.");
  });

  await tokenManager.initialize();

  router.init();
})();
