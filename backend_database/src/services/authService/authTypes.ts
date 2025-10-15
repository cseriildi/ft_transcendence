import { ApiResponse, ErrorResponse } from "../../types/commonTypes.ts";
import { User } from "../userService/userTypes.ts";

export interface JwtPayload {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface LoginTokens {
  accessToken: string;
}

export interface RefreshResponse {
  id: number;
  username: string;
  email: string;
  created_at: string;
  tokens: LoginTokens;
}

// Request body for creating a user
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

export interface UserLogin{
  id: number;
  username: string;
  email: string;
  created_at: string;
  tokens: LoginTokens;
}

// Response types
export type CreateUserResponse = ApiResponse<User>;
export type UserLoginResponse = ApiResponse<UserLogin>;
export type UserErrorResponse = ErrorResponse;
