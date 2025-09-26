import { ApiResponse, ErrorResponse } from "../../types/commonTypes.ts";

// User database entity
export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
  password_hash?: string; // Optional, not returned in responses
}

// URL parameters for user routes
export interface UserParams {
  id: string;
}

export interface UserLoginBody {
  email: string;
  password: string;
}

// Response types
export type CreateUserResponse = ApiResponse<User>;
export type GetUserResponse = ApiResponse<User>;
export type GetUsersResponse = ApiResponse<User[]>;
export type UserLoginResponse = ApiResponse<User>;
export type UserErrorResponse = ErrorResponse;
