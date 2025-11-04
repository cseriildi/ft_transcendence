import { Router } from "../router/Router.js";
import { getUserId, getAccessToken, isUserAuthorized } from "../utils/utils.js";
import { fetchWithRefresh } from "../utils/fetchUtils.js";
import { config } from "../config.js";

export class Home {
  private router: Router;

  constructor(router: Router) {
    this.router = router;
  }

  async initPage(): Promise<void> {
    const pongBtn = document.getElementById("pong-btn");
    const loginBtn = document.getElementById("login-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const userAvatar = document.getElementById(
      "user-avatar"
    ) as HTMLImageElement;
    const userName = document.getElementById("user-name");
    const profileBtn = document.getElementById("profile-btn");

    pongBtn?.addEventListener("click", () => this.router.navigate("/pong"));
    profileBtn?.addEventListener("click", () =>
      this.router.navigate("/profile")
    );
    loginBtn?.addEventListener("click", () => {
      this.router.navigate("/login");
    });
    logoutBtn?.addEventListener("click", async () => {
      try {
        const response = await fetch(`${config.apiUrl}/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
          credentials: "include",
        });

        if (response.ok) {
          sessionStorage.removeItem("accessToken");
          sessionStorage.removeItem("userId");
          sessionStorage.removeItem("username");
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
      if (userName || userAvatar) {
        try {
          const response = await fetchWithRefresh(
            `${config.apiUrl}/api/users/${getUserId()}`,
            {
              headers: {
                Authorization: `Bearer ${getAccessToken()}`,
              },
            }
          );

          if (response.ok) {
            const userData = await response.json();
            if (userAvatar && userData.data.avatar_url) {
              userAvatar.src = `${config.apiUrl}${userData.data.avatar_url}`;
            }
            console.log("avatar url:", userData.data.avatar_url);
            userAvatar.classList.remove("hidden");
            if (userName) userName.innerHTML = userData.data.username;
          } else {
            console.error("Failed to fetch user data");
          }
        } catch (error) {
          console.error("Error fetching user data", error);
        }
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
