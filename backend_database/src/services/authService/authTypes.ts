import { User, TokenPair } from "../../types/commonTypes.ts";

export interface BaseJwtPayload {
  sub: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  type?: "access" | "refresh" | "temp_2fa"; // Token type for validation
}

export interface AccessTokenPayload extends BaseJwtPayload {
  type: "access";
}

export interface RefreshTokenPayload extends BaseJwtPayload {
  type: "refresh";
  jti: string;
}

export interface TempTokenPayload extends BaseJwtPayload {
  type: "temp_2fa";
}

// Legacy type alias for backward compatibility during migration
export type JwtPayload = AccessTokenPayload | RefreshTokenPayload | TempTokenPayload;

export interface CreateUserBody {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface UserLoginBody {
  email: string;
  password: string;
}

export interface Auth2FARequiredResponse {
  requires2fa: true;
  tempToken: string;
}

export interface AuthUserData extends User {
  tokens: TokenPair;
}
