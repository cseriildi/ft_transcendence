import { User, TokenPair } from "../../types/commonTypes.ts";

export interface BaseJwtPayload {
  sub: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface AccessTokenPayload extends BaseJwtPayload {}

export interface RefreshTokenPayload extends BaseJwtPayload {
  jti: string;
}

// Legacy type alias for backward compatibility during migration
export type JwtPayload = AccessTokenPayload | RefreshTokenPayload;

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

export interface AuthUserData extends User {
  tokens: TokenPair;
}
