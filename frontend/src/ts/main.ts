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

let currentPong: Pong | null = null;

const initPongPage = () => {
  const backBtn = document.getElementById("back-btn");
  backBtn?.addEventListener("click", () => {
    currentPong?.destroy();
    currentPong = null;
    router.navigate("/");
  });

  const canvas = document.getElementById("pong-canvas") as HTMLCanvasElement;
  if (canvas) {
    currentPong = new Pong("pong-canvas", `${config.wsUrl}/game`);
  } else {
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
