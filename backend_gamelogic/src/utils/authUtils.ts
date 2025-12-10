import { config } from "../config.js";
//TODO: Silas please check if I need this whole file or if there is anything I could reuse
// I know skill issue, but please, thanks

/**
 * Verifies an access token by calling the backend database service
 * Returns userId if token is valid
 * @throws Error if token is invalid, expired, or verification fails
 */
export async function verifyAccessToken(token: string): Promise<number> {
  try {
    // Call backend_database to verify token using Bearer header
    const verifyUrl = `${config.backendDatabase.url}${config.backendDatabase.authPrefix}/verify`;
    console.log(`🔐 Verifying token at: ${verifyUrl}`);

    const response = await fetch(verifyUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Token verification failed");
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error("Token verification failed");
    }

    // We need to extract userId from the token ourselves since the endpoint doesn't return it
    // Parse the JWT payload (doesn't require signature verification since we just verified it)
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid token format");
    }

    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
    if (!payload.sub) {
      throw new Error("Token missing user ID claim");
    }
    const userId = parseInt(payload.sub);

    if (isNaN(userId)) {
      throw new Error("Invalid user ID in token");
    }

    return userId;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
    throw new Error("Token verification failed");
  }
}

/**
 * Fetches username from the database service using the access token for authentication
 */
export async function fetchUsername(userId: number, token: string): Promise<string> {
  try {
    const usersUrl = `${config.backendDatabase.url}${config.backendDatabase.apiPrefix}/users/${userId}`;
    console.log(`👤 Fetching username from: ${usersUrl}`);

    const response = await fetch(usersUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user data: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success || !data.data?.username) {
      throw new Error("Invalid response format from database service");
    }

    return data.data.username;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch username: ${error.message}`);
    }
    throw new Error("Failed to fetch username");
  }
}
