import { config } from "../config.js";
import { getAccessToken, getUserId } from "../utils/utils.js";
import { fetchWithRefresh } from "../utils/fetchUtils.js";
import { showErrorPopup } from "../main.js";
import { i18n } from "./i18n.js";

export interface TwoFASetupData {
  secret: string;
  qr_code: string;
}

/**
 * Handles Two-Factor Authentication (2FA) functionality
 */
export class TwoFactorAuth {
  private currentQRCode: string | null = null;
  private currentSecret: string | null = null;

  /**
   * Setup 2FA - generates secret and QR code
   */
  public async setup(): Promise<TwoFASetupData | null> {
    const userId = getUserId();
    if (!userId) {
      showErrorPopup(i18n.t("error.sessionExpired"));
      return null;
    }

    try {
      const response = await fetchWithRefresh(`${config.apiUrl}/api/users/${userId}/2fa/setup`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          this.currentSecret = data.data.secret;
          this.currentQRCode = data.data.qrCodeUrl;
          return {
            secret: data.data.secret,
            qr_code: data.data.qrCodeUrl,
          };
        }
        throw new Error(i18n.t("error.failed2FAEnable"));
      } else {
        throw new Error(i18n.t("error.failed2FAEnable"));
      }
    } catch (error) {
      showErrorPopup(i18n.t("error.failed2FAEnable"));
      return null;
    }
  }

  /**
   * Verify 2FA token without enabling
   */
  public async verify(token: string): Promise<boolean> {
    if (!token || token.length !== 6) {
      showErrorPopup(i18n.t("edit.enter6Digit"));
      return false;
    }

    try {
      const response = await fetchWithRefresh(
        `${config.apiUrl}/api/users/${getUserId()}/2fa/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAccessToken()}`,
          },
          credentials: "include",
          body: JSON.stringify({ twofa_code: token }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.success === true;
      } else {
        throw new Error(i18n.t("error.invalidVerificationCode"));
      }
    } catch (error) {
      showErrorPopup(i18n.t("error.invalidVerificationCode"));
      return false;
    }
  }

  /**
   * Enable 2FA for user account
   */
  public async enable(token: string): Promise<boolean> {
    if (!token || token.length !== 6) {
      showErrorPopup(i18n.t("edit.enter6Digit"));
      return false;
    }

    try {
      const response = await fetchWithRefresh(
        `${config.apiUrl}/api/users/${getUserId()}/2fa/enable`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAccessToken()}`,
          },
          credentials: "include",
          body: JSON.stringify({ twofa_code: token }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          return true;
        }
        throw new Error(i18n.t("error.failed2FAEnable"));
      } else {
        throw new Error(i18n.t("error.failed2FAEnable"));
      }
    } catch (error) {
      showErrorPopup(i18n.t("error.failed2FAEnable"));
      return false;
    }
  }

  /**
   * Disable 2FA for user account
   */
  public async disable(token: string): Promise<boolean> {
    if (!token) {
      showErrorPopup(i18n.t("edit.enter2faCode"));
      return false;
    }

    try {
      const response = await fetchWithRefresh(
        `${config.apiUrl}/api/users/${getUserId()}/2fa/disable`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAccessToken()}`,
          },
          credentials: "include",
          body: JSON.stringify({ twofa_code: token }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          this.currentSecret = null;
          this.currentQRCode = null;
          return true;
        }
        throw new Error(i18n.t("error.failed2FADisable"));
      } else {
        throw new Error(i18n.t("error.failed2FADisable"));
      }
    } catch (error) {
      showErrorPopup(i18n.t("error.failed2FADisable"));
      return false;
    }
  }

  /**
   * Check if user has 2FA enabled
   */
  public async getStatus(): Promise<{ enabled: boolean } | null> {
    try {
      const response = await fetchWithRefresh(`${config.apiUrl}/api/users/${getUserId()}`, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        return {
          enabled: data.data?.twofa_enabled === 1,
        };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear current setup data
   */
  public clearSetup(): void {
    this.currentSecret = null;
    this.currentQRCode = null;
  }
}
