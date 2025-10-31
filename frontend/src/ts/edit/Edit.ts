import { Router } from "../router/Router.js";
import { showErrorPopup } from "../main.js";
import { getUserId, getAccessToken, isUserAuthorized } from "../utils/utils.js";
import { fetchWithRefresh } from "../utils/fetchUtils.js";

export class Edit {
  private router: Router;

  constructor(router: Router) {
    this.router = router;
  }

  async handleFormSubmit(e: Event): Promise<{ success: boolean; message?: string }> {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const email = formData.get("email") as string | null;
    const username = formData.get("username") as string | null;

    if (!email || !username) {
      showErrorPopup("Email and username are required.");
      return { success: false, message: "Email and username are required." };
    }

    const userId = getUserId();

    if (!userId) {
      showErrorPopup("User ID not found. Please log in again.");
      return { success: false, message: "User ID not found." };
    }

    const emailInput = document.getElementById("email") as HTMLInputElement;
    const usernameInput = document.getElementById("username") as HTMLInputElement;
    const avatarInput = document.getElementById("avatar") as HTMLInputElement;

    const requests = [];

    if (emailInput && email !== emailInput.defaultValue) {
      requests.push(
        fetchWithRefresh(`http://localhost:3000/api/users/${userId}/email`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify({ email }),
          credentials: "include",
        })
      );
    }

    if (usernameInput && username !== usernameInput.defaultValue) {
      requests.push(
        fetchWithRefresh(`http://localhost:3000/api/users/${userId}/username`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify({ username }),
          credentials: "include",
        })
      );
    }

    if (avatarInput?.files?.length) {
      const formData = new FormData();
      formData.append("avatar", avatarInput.files[0]);

      requests.push(
        fetchWithRefresh(`http://localhost:3000/api/users/avatar`, {
          method: "POST",
          body: formData,
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
          credentials: "include",
        })
      );
    }

    try {
      const responses = await Promise.all(requests);
      const errors = await Promise.all(
        responses.map(async (response) => {
          if (!response.ok) {
            const data = await response.json();
            return data.message || "Unknown error";
          }
          return null;
        })
      );

      const errorMessages = errors.filter((error) => error !== null);
      if (errorMessages.length > 0) {
        showErrorPopup(errorMessages.join("; "));
        return { success: false, message: errorMessages.join("; ") };
      }

      return { success: true };
    } catch (err) {
      console.error("Network error", err);
      showErrorPopup("Network error");
      return { success: false, message: "Network error" };
    }
  }

  async initPage(): Promise<void> {
    if (!isUserAuthorized()) {
      this.router.navigate("/");
      return;
    }

    const backBtn = document.getElementById("back-btn");
    const form = document.getElementById("edit-form");
    const fileInput = document.getElementById("avatar") as HTMLInputElement;
    const fileNameDisplay = document.getElementById("file-name");

    if (!fileInput || !fileNameDisplay) {
      console.error("File input or file name display element not found");
      return;
    }
    fileInput.addEventListener("change", () => {
      if (fileInput.files && fileInput.files.length > 0) {
          const file = fileInput.files[0];
          const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
          
          if (!allowedTypes.includes(file.type)) {
              showErrorPopup("Only JPEG and PNG files are allowed for avatars.");
              fileInput.value = ''; // Clear the input
              fileNameDisplay.textContent = "No file chosen";
              return;
          }
          
          fileNameDisplay.textContent = file.name;
      } else {
          fileNameDisplay.textContent = "No file chosen";
      }
    });

    backBtn?.addEventListener("click", () => this.router.navigate("/profile"));
    form?.addEventListener("submit", async (e) => {
      const result = await this.handleFormSubmit(e);
      if (result.success) {
        this.router.navigate("/profile");
      }
    });

    try {
      const response = await fetchWithRefresh(`http://localhost:3000/api/users/${getUserId()}`, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        const userData = await response.json();
        console.log(userData);
        const emailInput = document.getElementById("email") as HTMLInputElement;
        const usernameInput = document.getElementById("username") as HTMLInputElement;
        if (emailInput && usernameInput) {
          emailInput.value = userData.data.email;
          usernameInput.value = userData.data.username;
        }
      } else {
        console.error("Failed to fetch user data");
      }
    } catch (err) {
      console.error("Error fetching user data", err);
    }
  }
}

export default Edit;
