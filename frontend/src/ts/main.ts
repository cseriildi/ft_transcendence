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
let tournamentLanguageListener: (() => void) | null = null;

const listenersRegistry = new WeakMap<EventTarget, Map<string, EventListener>>();
const attachedSet = new Set<EventTarget>();

const registerHandler = (el: EventTarget | null, event: string, handler: EventListener) => {
  if (!el) return;
  let map = listenersRegistry.get(el);
  if (!map) {
    map = new Map();
    listenersRegistry.set(el, map);
  }
  map.set(event, handler);
  if (el instanceof HTMLElement && !el.classList.contains("hidden")) {
    attachHandlers(el);
  }
};

const attachHandlers = (el: EventTarget | null) => {
  if (!el) return;
  if (attachedSet.has(el)) return;
  const map = listenersRegistry.get(el);
  if (!map) return;
  map.forEach((handler, event) => el.addEventListener(event, handler));
  attachedSet.add(el);
};

const detachHandlers = (el: EventTarget | null) => {
  if (!el) return;
  if (!attachedSet.has(el)) return;
  const map = listenersRegistry.get(el);
  if (!map) return;
  map.forEach((handler, event) => el.removeEventListener(event, handler));
  attachedSet.delete(el);
};

const showElement = (el: HTMLElement | null) => {
  if (!el) return;
  el.classList.remove("hidden");
  attachHandlers(el);
};

const hideElement = (el: HTMLElement | null) => {
  if (!el) return;
  el.classList.add("hidden");
  detachHandlers(el);
};

const clearHandlers = () => {
  attachedSet.forEach((el) => {
    detachHandlers(el);
  });
};

const clearPong = () => {
  if (currentPong) {
    currentPong.destroy();
    currentPong = null;
  }
};

window.addEventListener("popstate", () => {
  if (window.location.pathname !== "/pong") {
    clearPong();
    clearHandlers();
  }
});

const initPongPage = async () => {
  const queryParams = router.getQueryParams();
  const mode = queryParams.mode;
  const gameId = queryParams.gameId;

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

  const getRequiredById = <T extends HTMLElement>(id: string): T => {
    const el = document.getElementById(id);
    if (!el) {
      throw new Error(`Required element with id=\"${id}\" not found`);
    }
    return el as T;
  };

  const loginBtn = getRequiredById<HTMLButtonElement>("login-btn");
  const logoutBtn = getRequiredById<HTMLButtonElement>("logout-btn");
  const profileBtn = getRequiredById<HTMLButtonElement>("profile-btn");
  const userAvatar = getRequiredById<HTMLImageElement>("user-avatar");
  const userName = getRequiredById<HTMLElement>("user-name");
  const userInfoCard = getRequiredById<HTMLElement>("user-info-card");

  const canvasContainer = getRequiredById<HTMLElement>("canvas-container");
  const canvas = getRequiredById<HTMLCanvasElement>("pong-canvas");

  const newGameBtn = getRequiredById<HTMLButtonElement>("new-game-btn");
  if (mode === "tournament") newGameBtn.textContent = "Start Game";
  const backBtn = getRequiredById<HTMLButtonElement>("back-btn");
  const findFriendsBtn = getRequiredById<HTMLButtonElement>("find-friends-btn");

  const aiMenu = getRequiredById<HTMLElement>("difficulty-menu");
  const easyBtn = getRequiredById<HTMLButtonElement>("difficulty-easy");
  const mediumBtn = getRequiredById<HTMLButtonElement>("difficulty-medium");
  const hardBtn = getRequiredById<HTMLButtonElement>("difficulty-hard");

  const friendsSection = getRequiredById<HTMLElement>("friends-card");
  const friendList = getRequiredById<HTMLElement>("friends-list");

  const tournamentSetup = getRequiredById<HTMLElement>("tournament-setup");
  const tournament4Btn = getRequiredById<HTMLButtonElement>("tournament-4-btn");
  const tournament8Btn = getRequiredById<HTMLButtonElement>("tournament-8-btn");
  const tournamentForm = getRequiredById<HTMLFormElement>("player-names-form");
  const tournamentNames = getRequiredById<HTMLElement>("player-inputs-container");
  const startTournamentBtn = getRequiredById<HTMLButtonElement>("start-tournament-btn");

  let userId = getUserId();
  let username = getUsername();

  registerHandler(loginBtn, "click", () => {
    clearPong();
    clearHandlers();
    router.navigate("/login");
  });

  registerHandler(profileBtn, "click", () => {
    clearPong();
    clearHandlers();
    router.navigate("/profile");
  });

  registerHandler(logoutBtn, "click", async () => {
    try {
      clearPong();
      clearHandlers();

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
        hideElement(logoutBtn);
        hideElement(profileBtn);
        showElement(loginBtn);
        hideElement(userInfoCard);
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

  registerHandler(backBtn, "click", () => {
    clearPong();
    clearHandlers();
    router.navigate("/");
  });

  registerHandler(newGameBtn, "click", () => {
    switch (mode) {
      case "ai":
        clearPong();
        hideElement(newGameBtn);
        hideElement(canvasContainer);
        showElement(aiMenu);
        showElement(easyBtn);
        showElement(mediumBtn);
        showElement(hardBtn);
        break;
      case "tournament":
        currentPong?.startGame(mode);
        break;
      default:
        clearPong();
        username = getUsername();
        userId = getUserId();
        currentPong = new Pong("pong-canvas", `${config.wsUrl}/game`, mode);
        currentPong.startGame(mode, { userId: parseInt(userId!), username: username! });
        break;
    }
  });

  registerHandler(findFriendsBtn, "click", () => router.navigate("/users"));

  const showPlayerNamesForm = (playerCount: number) => {
    if (!tournamentForm || !tournamentNames) return;

    // Remove old language listener if it exists
    if (tournamentLanguageListener) {
      window.removeEventListener("languageChanged", tournamentLanguageListener);
      tournamentLanguageListener = null;
    }

    tournamentNames.innerHTML = "";
    for (let i = 1; i <= playerCount; i++) {
      const inputWrapper = document.createElement("div");
      inputWrapper.className = "";
      const input = document.createElement("input");
      input.type = "text";
      input.id = `player-${i}`;
      input.className = "form-input";
      input.maxLength = 20;
      // set translated placeholder now
      try {
        input.placeholder = i18n.t("tournament.playerPlaceholder", { i });
      } catch (e) {
        input.placeholder = `Player ${i} name`;
      }
      // store index to update on language change
      input.setAttribute("data-player-index", String(i));
      inputWrapper.appendChild(input);
      tournamentNames.appendChild(inputWrapper);
    }

    // update placeholders when language changes
    tournamentLanguageListener = () => {
      const inputs = tournamentNames.querySelectorAll<HTMLInputElement>("input[data-player-index]");
      inputs.forEach((inp) => {
        const idx = Number(inp.getAttribute("data-player-index") || "0");
        if (idx > 0) {
          inp.placeholder = i18n.t("tournament.playerPlaceholder", { i: idx });
        }
      });
    };
    window.addEventListener("languageChanged", tournamentLanguageListener);
    showElement(tournamentForm);
    showElement(startTournamentBtn);
  };
  registerHandler(tournament4Btn, "click", () => showPlayerNamesForm(4));
  registerHandler(tournament8Btn, "click", () => showPlayerNamesForm(8));

  registerHandler(startTournamentBtn, "click", () => {
    const inputs = document.querySelectorAll(
      "#player-inputs-container input"
    ) as NodeListOf<HTMLInputElement>;
    const playerNames = Array.from(inputs).map((input) => input.value.trim());
    if (playerNames.filter((name) => name.length === 0).length > 0) {
      alert("All player names must be non-empty");
      return;
    }
    if (new Set(playerNames).size !== playerNames.length) {
      alert("All player names must be unique");
      return;
    }
    clearPong();
    currentPong = new Pong("pong-canvas", `${config.wsUrl}/game`, mode);
    currentPong.newTournament(playerNames);
    showElement(newGameBtn);
    showElement(canvasContainer);
    hideElement(tournamentSetup);
    hideElement(tournament4Btn);
    hideElement(tournament8Btn);
    hideElement(tournamentForm);
    hideElement(startTournamentBtn);
  });

  const handleDifficultySelection = (difficulty: "easy" | "medium" | "hard") => {
    hideElement(aiMenu);
    hideElement(easyBtn);
    hideElement(mediumBtn);
    hideElement(hardBtn);
    showElement(newGameBtn);
    showElement(canvasContainer);
    currentPong = new Pong("pong-canvas", `${config.wsUrl}/game`, mode);
    currentPong.startGame(mode, undefined, difficulty);
  };

  registerHandler(easyBtn, "click", () => handleDifficultySelection("easy"));
  registerHandler(mediumBtn, "click", () => handleDifficultySelection("medium"));
  registerHandler(hardBtn, "click", () => handleDifficultySelection("hard"));

  if (isUserAuthorized()) {
    showElement(logoutBtn);
    showElement(profileBtn);
    hideElement(loginBtn);
    showElement(userInfoCard);

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
          userName.textContent = userData.data.username;
        }
      } else {
        console.error("Failed to fetch user data", await response.json());
      }
    } catch (error) {
      console.error("Error fetching user data", error);
    }
  } else {
    hideElement(logoutBtn);
    hideElement(profileBtn);
    showElement(loginBtn);
    hideElement(userInfoCard);
  }

  switch (mode) {
    case "ai": {
      hideElement(newGameBtn);
      hideElement(canvasContainer);
      showElement(aiMenu);
      showElement(easyBtn);
      showElement(mediumBtn);
      showElement(hardBtn);
      break;
    }
    case "friend": {
      if (gameId) {
        showElement(canvasContainer);
        currentPong = new Pong("pong-canvas", `${config.wsUrl}/game`, mode);
        currentPong.startGame(
          mode,
          {
            userId: parseInt(userId!),
            username: username!,
          },
          undefined,
          gameId
        );
      } else {
        showElement(friendsSection);
        const FriendsListModule = await import("./profile/FriendsList.js");
        const friendsList = new FriendsListModule.FriendsList(router);
        friendsList.loadFriendsList(friendList);
        showElement(findFriendsBtn);
      }
      break;
    }
    case "tournament": {
      hideElement(newGameBtn);
      hideElement(canvasContainer);
      showElement(tournamentSetup);
      showElement(tournament4Btn);
      showElement(tournament8Btn);
      break;
    }
    default: {
      showElement(newGameBtn);
      showElement(canvasContainer);
    }
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
    popup.className =
      "fixed bottom-5 left-1/2 transform -translate-x-1/2 p-3 bg-red-500 text-white rounded shadow-md z-50";
    popup.style.display = "block";
    setTimeout(() => {
      popup.style.display = "none";
    }, 5000);
  }
};

export const showSuccessPopup = (message: string) => {
  const popup = document.getElementById("error-popup");
  if (popup) {
    popup.textContent = message;
    popup.className =
      "fixed bottom-5 left-1/2 transform -translate-x-1/2 p-3 bg-green-500 text-white rounded shadow-md z-50";
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
    showErrorPopup(i18n.t("error.sessionExpired"));
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
