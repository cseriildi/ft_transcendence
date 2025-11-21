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
import { i18n } from "./utils/i18n.js";
import { languageSwitcher } from "./components/LanguageSwitcher.js";
import { SecureTokenManager } from "./utils/secureTokenManager.js";
import {
  getUserId,
  getAccessToken,
  isUserAuthorized,
  getUsername,
  startHeartbeat,
  stopHeartbeat,
} from "./utils/utils.js";
import { fetchWithRefresh } from "./utils/fetchUtils.js";

const VALID_MODES = ["local", "remote", "friend", "ai", "tournament"];

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

// Helper functions for tournament
const showPlayerNamesForm = (playerCount: number) => {
  const form = document.getElementById("player-names-form");
  const container = document.getElementById("player-inputs-container");

  if (!form || !container) return;

  container.innerHTML = "";

  for (let i = 1; i <= playerCount; i++) {
    const inputWrapper = document.createElement("div");
    inputWrapper.className = "";
    inputWrapper.innerHTML = `
      <input
        type="text"
        id="player-${i}"
        class="form-input"
        placeholder="Player ${i} name"
        maxlength="20"
      />
    `;
    container.appendChild(inputWrapper);
  }

  form.classList.remove("hidden");
};

const savePlayerNames = (): string[] | undefined => {
  const inputs = document.querySelectorAll(
    "#player-inputs-container input"
  ) as NodeListOf<HTMLInputElement>;
  const playerCount = inputs.length;

  if (playerCount === 0) return;

  const playerNames: string[] = [];

  inputs.forEach((input) => {
    playerNames.push(input.value);
  });

  // Validate names
  const trimmedNames = playerNames.map((name) => name.trim());

  // Check for empty names
  const emptyNames = trimmedNames.filter((name) => name.length === 0);
  if (emptyNames.length > 0) {
    alert(i18n.t("tournament.emptyNames"));
    return;
  }

  // Check for duplicates
  const uniqueNames = new Set(trimmedNames);
  if (uniqueNames.size !== trimmedNames.length) {
    alert(i18n.t("tournament.duplicateNames"));
    return;
  }

  // Try to create tournament with validation
  try {
    // Hide the form and show game elements (but NOT start-game-btn yet)
    const form = document.getElementById("player-names-form");
    const setup = document.getElementById("tournament-setup");
    const canvas = document.getElementById("pong-canvas");
    const scoreDiv = document.querySelector(".flex.justify-center.gap-16") as HTMLElement | null;
    const gameDescDiv = document.querySelector(
      ".flex.flex-col.text-center.justify-center"
    ) as HTMLElement | null;

    if (form) form.classList.add("hidden");
    if (setup) setup.classList.add("hidden");
    if (canvas) canvas.style.display = "";
    if (scoreDiv) scoreDiv.style.display = "";
    if (gameDescDiv) gameDescDiv.style.display = "";

    // Game has been set up, ready to start
    console.log("Tournament ready to start");
  } catch (error) {
    alert(`${i18n.t("tournament.setupFailed")}: ${(error as Error).message}`);
    return;
  }
  return trimmedNames;
};

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
  const userInfoCard = document.getElementById("user-info-card");

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
        stopHeartbeat();
        SecureTokenManager.getInstance().clearTokens();
        localStorage.removeItem("userId");
        localStorage.removeItem("username");

        // Update UI state immediately before navigation
        logoutBtn?.classList.add("hidden");
        profileBtn?.classList.add("hidden");
        loginBtn?.classList.remove("hidden");
        userInfoCard?.classList.add("hidden");
        if (userName) {
          userName.innerHTML = "";
        }

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
    userInfoCard?.classList.remove("hidden");

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
    userInfoCard?.classList.add("hidden");
  }

  if (mode === "friend") {
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
      <p class="text-lg text-neon-pink mb-8">${mode.toUpperCase()} mode is coming soon!</p>
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

  // Handle tournament mode
  if (mode === "tournament") {
    // Hide game elements
    const canvas = document.getElementById("pong-canvas");
    const scoreDiv = document.querySelector(".flex.justify-center.gap-16") as HTMLElement | null;
    const gameDescDiv = document.querySelector(
      ".flex.flex-col.text-center.justify-center"
    ) as HTMLElement | null;
    const startGameBtn = document.getElementById("start-game-btn");

    const newGameBtn = document.getElementById("new-game-btn");
    if (newGameBtn) newGameBtn.style.display = "none";
    if (startGameBtn) startGameBtn.style.display = "none";

    if (canvas) canvas.style.display = "none";
    if (scoreDiv) scoreDiv.style.display = "none";
    if (gameDescDiv) gameDescDiv.style.display = "none";

    // Show tournament setup
    const tournamentSetup = document.getElementById("tournament-setup");
    if (tournamentSetup) {
      tournamentSetup.classList.remove("hidden");
    }

    // Handle 4 players button
    const tournament4Btn = document.getElementById("tournament-4-btn");
    tournament4Btn?.addEventListener("click", () => {
      showPlayerNamesForm(4);
    });

    // Handle 8 players button
    const tournament8Btn = document.getElementById("tournament-8-btn");
    tournament8Btn?.addEventListener("click", () => {
      showPlayerNamesForm(8);
    });

    const backToSetupBtn = document.getElementById("back-to-setup-btn");
    backToSetupBtn?.addEventListener("click", () => {
      const form = document.getElementById("player-names-form");
      if (form) form.classList.add("hidden");
    });

    const startTournamentBtn = document.getElementById("start-tournament-btn");
    startTournamentBtn?.addEventListener("click", () => {
      const playerNames = savePlayerNames();
      if (!playerNames) return;
      if (currentPong) {
        currentPong.destroy();
        currentPong = null;
      }

      const canvas = document.getElementById("pong-canvas") as HTMLCanvasElement;
      if (canvas) {
        currentPong = new Pong("pong-canvas", `${config.wsUrl}/game`, mode);
        currentPong.newTournament(playerNames);
        // Show Start Game button after tournament is created
        if (startGameBtn) startGameBtn.style.display = "";
      } else {
        console.error("❌ Pong canvas not found");
      }
    });

    startGameBtn?.addEventListener("click", () => {
      if (!currentPong) {
        alert(i18n.t("pong.instanceNotCreated"));
        return;
      }
      currentPong.startTournamentGame();
    });

    return;
  }
  const startGameBtn = document.getElementById("start-game-btn");
  if (startGameBtn) startGameBtn.style.display = "none";
  // New Game button: destroy existing game instance for this tab and create a fresh one
  const newGameBtn = document.getElementById("new-game-btn");
  newGameBtn?.addEventListener("click", () => {
    // If a pong exists, destroy it so server will delete its game instance on disconnect
    if (currentPong) {
      currentPong.destroy();
      currentPong = null;
    }

    const canvas = document.getElementById("pong-canvas") as HTMLCanvasElement;
    if (!canvas) {
      console.error("❌ Pong canvas not found");
      return;
    }

    // For AI mode, show difficulty selection modal
    if (mode === "ai") {
      const modal = document.getElementById("difficulty-modal");
      if (!modal) {
        console.error("❌ Difficulty modal not found");
        return;
      }

      // Show modal
      modal.classList.remove("hidden");

      // Handle difficulty selection
      const handleDifficultySelection = (difficulty: "easy" | "medium" | "hard") => {
        modal.classList.add("hidden");
        currentPong = new Pong("pong-canvas", `${config.wsUrl}/game`, mode);
        currentPong.startGame(mode, undefined, difficulty);

        // Remove event listeners
        cleanup();
      };

      // Handle modal close
      const handleCloseModal = () => {
        modal.classList.add("hidden");
        cleanup();
      };

      const cleanup = () => {
        easyBtn?.removeEventListener("click", easyHandler);
        mediumBtn?.removeEventListener("click", mediumHandler);
        hardBtn?.removeEventListener("click", hardHandler);
        closeBtn?.removeEventListener("click", handleCloseModal);
        modal?.removeEventListener("click", backdropHandler);
        document.removeEventListener("keydown", escHandler);
      };

      const easyHandler = () => handleDifficultySelection("easy");
      const mediumHandler = () => handleDifficultySelection("medium");
      const hardHandler = () => handleDifficultySelection("hard");

      // ESC key handler
      const escHandler = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          handleCloseModal();
        }
      };

      // Backdrop click handler (close when clicking outside modal content)
      const backdropHandler = (event: MouseEvent) => {
        if (event.target === modal) {
          handleCloseModal();
        }
      };

      const easyBtn = document.getElementById("difficulty-easy");
      const mediumBtn = document.getElementById("difficulty-medium");
      const hardBtn = document.getElementById("difficulty-hard");
      const closeBtn = document.getElementById("difficulty-close");

      easyBtn?.addEventListener("click", easyHandler);
      mediumBtn?.addEventListener("click", mediumHandler);
      hardBtn?.addEventListener("click", hardHandler);
      closeBtn?.addEventListener("click", handleCloseModal);
      modal?.addEventListener("click", backdropHandler);
      document.addEventListener("keydown", escHandler);
    } else if (["remote", "friend"].includes(mode)) {
      currentPong = new Pong("pong-canvas", `${config.wsUrl}/game`, mode);

      const userId = getUserId();
      const username = getUsername();

      if (userId && username) {
        currentPong.startGame(mode, {
          userId: parseInt(userId),
          username: username,
        });
      } else {
        console.error("❌ User not authenticated for ONLINE mode");
      }
    } else {
      currentPong = new Pong("pong-canvas", `${config.wsUrl}/game`, mode);
      currentPong.startGame(mode);
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

router.setI18nCallback(async () => {
  await i18n.init();
  languageSwitcher.init();
  console.log("✅ i18n initialized with language:", i18n.getCurrentLanguage());
});

const loginPage = new Login(router);
const registerPage = new Register(router);
const homePage = new Home(router);
const profilePage = new Profile(router);
const editPage = new Edit(router);
const usersPage = new Users(router);
const chatPage = new Chat(router);

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
  const tokenManager = SecureTokenManager.getInstance(router);

  tokenManager.setTokenExpiryCallback(() => {
    showErrorPopup(i18n.t("error.sessionExpired") || "Session expired. Please log in again.");
  });

  await tokenManager.initialize();

  // Start heartbeat if user is authorized
  if (isUserAuthorized()) {
    startHeartbeat();
  }

  router.addRoute("/", "home", () => homePage.initPage());
  router.addRoute("/pong", "pong", initPongPage);
  router.addRoute("/login", "login", () => loginPage.initPage());
  router.addRoute("/register", "register", () => registerPage.initPage());
  router.addRoute("/profile", "profile", () => profilePage.initPage());
  router.addRoute("/edit", "edit", () => editPage.initPage());
  router.addRoute("/users", "users", () => usersPage.initPage());
  router.addRoute("/chat", "chat", () => chatPage.initPage());
  router.addRoute("/404", "404", initNotFoundPage);

  router.init();
})();
