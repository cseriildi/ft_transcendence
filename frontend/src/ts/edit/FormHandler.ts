import { ProfileUpdater } from "./ProfileUpdater.js";
import { showErrorPopup } from "../main.js";
import { i18n } from "../utils/i18n.js";

interface FormSubmitResult {
  success: boolean;
  message?: string;
}

export class FormHandler {
  private profileUpdater: ProfileUpdater;

  constructor(profileUpdater: ProfileUpdater) {
    this.profileUpdater = profileUpdater;
  }

  async handleSubmit(form: HTMLFormElement): Promise<FormSubmitResult> {
    const formData = new FormData(form);
    const email = formData.get("email") as string | null;
    const username = formData.get("username") as string | null;

    if (!email || !username) {
      showErrorPopup(i18n.t("edit.emailUsernameRequired"));
      return { success: false, message: i18n.t("edit.emailUsernameRequired") };
    }

    const emailInput = document.getElementById("email") as HTMLInputElement;
    const usernameInput = document.getElementById("username") as HTMLInputElement;
    const avatarInput = document.getElementById("avatar") as HTMLInputElement;

    const requests: Promise<Response>[] = [];
    const requestTypes: string[] = [];
    let newUsername: string | null = null;

    // Email update
    if (emailInput && email !== emailInput.defaultValue) {
      requests.push(this.profileUpdater.updateEmail(email));
      requestTypes.push("email");
    }

    // Username update
    if (usernameInput && username !== usernameInput.defaultValue) {
      newUsername = username;
      requests.push(this.profileUpdater.updateUsername(username));
      requestTypes.push("username");
    }

    // Avatar update
    if (avatarInput?.files?.length) {
      requests.push(this.profileUpdater.updateAvatar(avatarInput.files[0]));
      requestTypes.push("avatar");
    }

    if (requests.length === 0) {
      return { success: true, message: "No changes to save" };
    }

    try {
      const responses = await Promise.all(requests);
      const hasErrors = await Promise.all(
        responses.map(async (response, index) => {
          if (!response.ok) {
            const data = await response.json();
            console.error("Update error:", data.message || "Unknown error");
            return true;
          } else {
            // If username update was successful, update localStorage
            if (requestTypes[index] === "username" && newUsername) {
              localStorage.setItem("username", newUsername);
              console.log("Username updated in localStorage:", newUsername);
            }
          }
          return false;
        })
      );

      if (hasErrors.some((error) => error === true)) {
        showErrorPopup(i18n.t("edit.updateFailed"));
        return { success: false, message: i18n.t("edit.updateFailed") };
      }

      return { success: true };
    } catch (err) {
      console.error("Network error", err);
      showErrorPopup(i18n.t("edit.networkError"));
      return { success: false, message: i18n.t("edit.networkError") };
    }
  }
}
