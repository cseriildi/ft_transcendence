import { Router } from "./router/Router.js";
import { Pong, GameMode } from "./pong/Pong.js";
import { Login } from "./login/Login.js";
import { Register } from "./register/Register.js";
import { Home } from "./home/Home.js";
import { Profile } from "./profile/Profile.js";
import { Edit } from "./edit/Edit.js";
import { Chat } from "./chat/Chat.js";
import { config } from "./config.js";
import { Users } from "./users/Users.js";
import { SecureTokenManager } from "./utils/secureTokenManager.js";
import { getUserId, getAccessToken, isUserAuthorized, getUsername } from "./utils/utils.js";
import { fetchWithRefresh } from "./utils/fetchUtils.js";

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

const VALID_MODES = ["local", "ai", "remote", "friend", "tournament", "local-tournament"];

const initPongPage = async () => {
  const queryParams = router.getQueryParams();
  const mode = queryParams.mode;

  // Redirect to home if no mode is specified or if mode is invalid
  if (!mode || !VALID_MODES.includes(mode)) {
    console.warn(`Invalid or missing pong mode: ${mode}, redirecting to home`);
    router.navigate("/");
    return;
  }

  // Redirect to login if user is not authorized for remote or friend modes
  if ((mode === "remote" || mode === "friend") && !isUserAuthorized()) {
    console.warn(`You need to be logged in to play in ${mode} mode.`);
    router.navigate("/login");
    return;
  }

  // Initialize login/logout/profile buttons
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const profileBtn = document.getElementById("profile-btn");
  const userAvatar = document.getElementById("user-avatar") as HTMLImageElement;
  const userName = document.getElementById("user-name");

  loginBtn?.addEventListener("click", () => {
    // Cleanup Pong before navigating
    if (currentPong) {
      currentPong.destroy();
      currentPong = null;
    }
    router.navigate("/login");
  });

  profileBtn?.addEventListener("click", () => {
    // Cleanup Pong before navigating
    if (currentPong) {
      currentPong.destroy();
      currentPong = null;
    }
    router.navigate("/profile");
  });

  logoutBtn?.addEventListener("click", async () => {
    try {
      // Cleanup Pong before logging out
      if (currentPong) {
        currentPong.destroy();
        currentPong = null;
      }

      const response = await fetch(`${config.apiUrl}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        sessionStorage.removeItem("accessToken");
        sessionStorage.removeItem("userId");
        sessionStorage.removeItem("username");
        router.navigate("/");
      } else {
        console.error("Failed to log out", await response.json());
      }
    } catch (error) {
      console.error("Error during logout", error);
    }
  });

  // Handle button visibility based on authentication status
  if (isUserAuthorized()) {
    logoutBtn?.classList.remove("hidden");
    profileBtn?.classList.remove("hidden");
    loginBtn?.classList.add("hidden");

    // Fetch user data if authorized
    try {
      const response = await fetchWithRefresh(`${config.apiUrl}/api/users/${getUserId()}`, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();

        if (userAvatar && userData.data.avatar_url) {
          userAvatar.src = `${config.apiUrl}${userData.data.avatar_url}`;
          userAvatar.classList.remove("hidden");
        }

        if (userName && userData.data.username) {
          userName.innerHTML = userData.data.username;
        }
      } else {
        console.error("Failed to fetch user data", await response.json());
      }
    } catch (error) {
      console.error("Error fetching user data", error);
    }
  } else {
    logoutBtn?.classList.add("hidden");
    profileBtn?.classList.add("hidden");
    loginBtn?.classList.remove("hidden");
    userAvatar?.classList.add("hidden");
  }

  if (mode !== "local" && mode !== "remote" && mode !== "ai") {
    // Hide canvas and New Game button for unsupported modes
    const canvas = document.getElementById("pong-canvas");
    const newGameBtn = document.getElementById("new-game-btn");
    if (canvas) canvas.style.display = "none";
    if (newGameBtn) newGameBtn.style.display = "none";

    // Hide score display and game description
    const scoreDiv = document.querySelector(".flex.justify-center.gap-16") as HTMLElement | null;
    const gameDescDiv = document.querySelector(
      ".flex.flex-col.text-center.justify-center"
    ) as HTMLElement | null;
    if (scoreDiv) scoreDiv.style.display = "none";
    if (gameDescDiv) gameDescDiv.style.display = "none";

    // Show WIP message
    const maxWidthContainer = document.querySelector(".max-w-4xl");
    if (maxWidthContainer) {
      const wipMessage = document.createElement("div");
      wipMessage.className = "text-center py-16";
      wipMessage.innerHTML = `
      <p class="text-3xl font-bold text-neon-yellow drop-shadow-neon mb-8">🚧 Work In Progress 🚧</p>
      <p class="text-lg text-neon-cyan mb-8">${mode.toUpperCase()} mode is coming soon!</p>
      `;
      maxWidthContainer.appendChild(wipMessage);
    }
  }

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
      let gameMode: GameMode;
      switch (mode) {
        case "local":
          gameMode = GameMode.LOCAL;
          break;
        case "ai":
          gameMode = GameMode.VS_AI;
          break;
        case "remote":
          gameMode = GameMode.ONLINE;
          break;
        default:
          console.error(`❌ Invalid game mode: ${mode}`);
          return;
      }

      // For ONLINE mode, pass actual user data
      if (gameMode === GameMode.ONLINE) {
        const userId = getUserId();
        const username = getUsername();

        if (userId && username) {
          currentPong.startGame(gameMode, {
            userId: parseInt(userId),
            username: username,
          });
        } else {
          console.error("❌ User not authenticated for ONLINE mode");
        }
      } else {
        // LOCAL mode doesn't need playerInfo
        currentPong.startGame(gameMode);
      }
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
  homeBtn?.addEventListener("click", () => {
    if (currentPong) {
      currentPong.destroy();
      currentPong = null;
    }
    router.navigate("/");
  });
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
