import { Router } from "./router/Router.js";
import { Pong } from "./pong/Pong.js";
import { handleLoginFormSubmit } from "./login/login.js";
import { handleRegisterFormSubmit } from "./register/register.js";
import { config } from "./config.js";

const initHomePage = () => {
  const pongBtn = document.getElementById("pong-btn");
  const authBtn = document.getElementById("login-btn");

  pongBtn?.addEventListener("click", () => router.navigate("/pong"));
  authBtn?.addEventListener("click", () => router.navigate("/login"));
};

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

const initLoginPage = () => {
  const backBtn = document.getElementById("back-btn");
  const form = document.getElementById("login-form");
  const registerBtn = document.getElementById("register-btn"); // Add this line

  backBtn?.addEventListener("click", () => router.navigate("/"));
  form?.addEventListener("submit", handleLoginFormSubmit);
  registerBtn?.addEventListener("click", () => router.navigate("/register")); // Add this line
};

const initRegisterPage = () => {
  const backBtn = document.getElementById("back-btn");
  const form = document.getElementById("register-form");
  const loginBtn = document.getElementById("login-btn");

  backBtn?.addEventListener("click", () => router.navigate("/"));
  form?.addEventListener("submit", handleRegisterFormSubmit);
  loginBtn?.addEventListener("click", () => router.navigate("/login"));
};

const initNotFoundPage = () => {
  const homeBtn = document.getElementById("home-btn");
  homeBtn?.addEventListener("click", () => router.navigate("/"));
};

const router = new Router();

router.addRoute("/", "home", initHomePage);
router.addRoute("/pong", "pong", initPongPage);
router.addRoute("/login", "login", initLoginPage);
router.addRoute("/register", "register", initRegisterPage);
router.addRoute("/404", "404", initNotFoundPage);
