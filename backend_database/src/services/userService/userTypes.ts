import { ApiResponse, ErrorResponse } from "../../types/commonTypes.ts";

// User database entity
export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
  password_hash?: string; // Optional, not returned in responses
}
export interface uploadAvatar {
  username: string;
  avatar_url: string;
  created_at: string;
}

// URL parameters for user routes
export interface UserParams {
  id: string;
}

// Response types
export type uploadAvatarResponse = ApiResponse<uploadAvatar>;
export type GetUserResponse = ApiResponse<User>;
export type GetUsersResponse = ApiResponse<User[]>;
export type UserErrorResponse = ErrorResponse;
