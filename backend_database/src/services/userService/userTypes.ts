import { ApiResponse, ErrorResponse } from "../../types/commonTypes.ts";

// User database entity
export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
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

export interface ChangeEmailBody {
  email: string;
}

export interface ChangeUsernameBody {
  username: string;
}

export interface manageFriendsBody {
  user1_Id: string;
  user2_Id: string;
  action: "add" | "accept" | "decline" | "remove";
  created_at?: string;
  updated_at?: string;
}

// Response types
export type manageFriendsResponse = ApiResponse<manageFriendsBody>;
export type uploadAvatarResponse = ApiResponse<uploadAvatar>;
export type GetUserResponse = ApiResponse<User>;
export type GetUsersResponse = ApiResponse<User[]>;
export type UserErrorResponse = ErrorResponse;
