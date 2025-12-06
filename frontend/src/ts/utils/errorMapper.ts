import { i18n } from "./i18n.js";

export function mapBackendError(
  errorCode: string | undefined,
  errorMessage: string | undefined,
  defaultKey: string
): string {
  if (!errorCode && !errorMessage) {
    return i18n.t(defaultKey);
  }

  if (errorMessage) {
    const messageLower = errorMessage.toLowerCase();

    if (messageLower.includes("invalid email")) {
      return i18n.t("auth.invalidEmail");
    }
    if (messageLower.includes("invalid password")) {
      return i18n.t("auth.invalidPassword");
    }
    if (messageLower.includes("invalid 2fa") || messageLower.includes("invalid token")) {
      return i18n.t("auth.invalid2FACode");
    }

    if (messageLower.includes("email already") || messageLower.includes("duplicate email")) {
      return i18n.t("register.emailExists");
    }
    if (messageLower.includes("username already") || messageLower.includes("duplicate username")) {
      return i18n.t("register.usernameExists");
    }
    if (
      messageLower.includes("passwords do not match") ||
      messageLower.includes("password mismatch")
    ) {
      return i18n.t("register.passwordsMismatch");
    }

    if (
      messageLower.includes("password") &&
      (messageLower.includes("weak") ||
        messageLower.includes("must contain") ||
        messageLower.includes("at least") ||
        messageLower.includes("too short"))
    ) {
      return i18n.t("register.weakPassword");
    }

    if (
      messageLower.includes("email") &&
      (messageLower.includes("invalid") ||
        messageLower.includes("format") ||
        messageLower.includes("not valid"))
    ) {
      return i18n.t("register.invalidEmailFormat");
    }

    if (
      messageLower.includes("username") &&
      (messageLower.includes("invalid") ||
        messageLower.includes("format") ||
        messageLower.includes("characters"))
    ) {
      return i18n.t("register.invalidUsername");
    }

    if (messageLower.includes("rate limit") || messageLower.includes("too many")) {
      return i18n.t("error.rateLimitExceeded");
    }

    if (messageLower.includes("session expired") || messageLower.includes("token expired")) {
      return i18n.t("error.sessionExpired");
    }
  }

  if (errorCode) {
    switch (errorCode) {
      case "UNAUTHORIZED":
        return i18n.t(defaultKey);
      case "VALIDATION_ERROR":
        return errorMessage ? i18n.t(defaultKey) : i18n.t("error.validationError");
      case "NOT_FOUND":
        return i18n.t("error.notFound");
      case "CONFLICT":
        return i18n.t(defaultKey);
      case "FORBIDDEN":
        return i18n.t("error.forbidden");
      case "INTERNAL_ERROR":
        return i18n.t("error.serverError");
      default:
        return i18n.t(defaultKey);
    }
  }
  return i18n.t(defaultKey);
}
