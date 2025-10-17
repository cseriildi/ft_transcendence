import { User, TokenPair } from "../../types/commonTypes.ts";

export interface JwtPayload {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

// Request bodies
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

// Response data shapes (used with ApiResponse<T>)
export interface AuthUserData extends User {
  tokens: TokenPair;
}
