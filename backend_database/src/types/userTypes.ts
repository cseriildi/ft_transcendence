import { ApiResponse, ErrorResponse } from "./commonTypes.ts";

// User database entity
export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

// Request body for creating a user
export interface CreateUserBody {
  username: string;
  email: string;
}

export interface UpdateUserBody {
  username?: string;
  email?: string;
}

// URL parameters for user routes
export interface UserParams {
  id: string;
}

// Response types
export type CreateUserResponse = ApiResponse<User>;
export type GetUserResponse = ApiResponse<User>;
export type GetUsersResponse = ApiResponse<User[]>;
export type UserErrorResponse = ErrorResponse;
