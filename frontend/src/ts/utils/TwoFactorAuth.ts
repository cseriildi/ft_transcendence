import { config } from "../config.js";
import { getAccessToken, getUserId } from "../utils/utils.js";
import { fetchWithRefresh } from "../utils/fetchUtils.js";
import { showErrorPopup } from "../main.js";

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
      showErrorPopup("User ID not found. Please log in again.");
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
        throw new Error(data.message || "Failed to setup 2FA");
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to setup 2FA");
      }
    } catch (error) {
      console.error("2FA setup error:", error);
      showErrorPopup(error instanceof Error ? error.message : "Failed to setup 2FA");
      return null;
    }
  }

  /**
   * Verify 2FA token without enabling
   */
  public async verify(token: string): Promise<boolean> {
    if (!token || token.length !== 6) {
      showErrorPopup("Please enter a 6-digit verification code");
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
        const errorData = await response.json();
        throw new Error(errorData.message || "Invalid verification code");
      }
    } catch (error) {
      console.error("2FA verify error:", error);
      showErrorPopup(error instanceof Error ? error.message : "Failed to verify 2FA code");
      return false;
    }
  }

  /**
   * Enable 2FA for user account
   */
  public async enable(token: string): Promise<boolean> {
    if (!token || token.length !== 6) {
      showErrorPopup("Please enter a 6-digit verification code");
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
        throw new Error(data.message || "Failed to enable 2FA");
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to enable 2FA");
      }
    } catch (error) {
      console.error("2FA enable error:", error);
      showErrorPopup(error instanceof Error ? error.message : "Failed to enable 2FA");
      return false;
    }
  }

  /**
   * Disable 2FA for user account
   */
  public async disable(token: string): Promise<boolean> {
    if (!token) {
      showErrorPopup("Please enter your 2FA code to disable 2FA");
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
        throw new Error(data.message || "Failed to disable 2FA");
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to disable 2FA");
      }
    } catch (error) {
      console.error("2FA disable error:", error);
      showErrorPopup(error instanceof Error ? error.message : "Failed to disable 2FA");
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
      console.error("2FA status error:", error);
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
