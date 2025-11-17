import { Router } from "../router/Router.js";
import { getUserId, getAccessToken, isUserAuthorized } from "../utils/utils.js";
import { config } from "../config.js";
import { fetchWithRefresh } from "../utils/fetchUtils.js";
import { SecureTokenManager } from "../utils/secureTokenManager.js";

export class Home {
  private router: Router;

  constructor(router: Router) {
    this.router = router;
  }

  async initPage(): Promise<void> {
    const localBtn = document.getElementById("local-btn");
    const aiBtn = document.getElementById("ai-btn");
    const remoteBtn = document.getElementById("remote-btn");
    const friendBtn = document.getElementById("friend-btn");
    const tournamentBtn = document.getElementById("tournament-btn");
    const loginBtn = document.getElementById("login-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const userAvatar = document.getElementById("user-avatar") as HTMLImageElement;
    const userName = document.getElementById("user-name");
    const profileBtn = document.getElementById("profile-btn");

    localBtn?.addEventListener("click", () => this.router.navigate("/pong", { mode: "local" }));
    aiBtn?.addEventListener("click", () => this.router.navigate("/pong", { mode: "ai" }));
    remoteBtn?.addEventListener("click", () => {
      if (!isUserAuthorized()) {
        this.router.navigate("/login");
        return;
      }
      this.router.navigate("/pong", { mode: "remote" });
    });
    friendBtn?.addEventListener("click", () => {
      if (!isUserAuthorized()) {
        this.router.navigate("/login");
        return;
      }
      this.router.navigate("/pong", { mode: "friend" });
    });
    tournamentBtn?.addEventListener("click", () =>
      this.router.navigate("/pong", { mode: "tournament" })
    );
    profileBtn?.addEventListener("click", () => this.router.navigate("/profile"));
    loginBtn?.addEventListener("click", () => {
      this.router.navigate("/login");
    });
    logoutBtn?.addEventListener("click", async () => {
      try {
        const response = await fetch(`${config.apiUrl}/auth/logout`, {
          method: "POST",
          credentials: "include",
        });

        if (response.ok) {
          SecureTokenManager.getInstance().clearTokens();
          localStorage.removeItem("userId");
          localStorage.removeItem("username");

          this.router.navigate("/");
        } else {
          console.error("Failed to log out", await response.json());
        }
      } catch (error) {
        console.error("Error during logout", error);
      }
    });

    if (isUserAuthorized()) {
      logoutBtn?.classList.remove("hidden");
      profileBtn?.classList.remove("hidden");
      loginBtn?.classList.add("hidden");

      // Always try to fetch user data if authorized
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
  }
}

export default Home;
