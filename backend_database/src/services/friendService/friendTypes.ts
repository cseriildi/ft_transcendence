import { ApiResponse } from "../../types/commonTypes.ts";

// User database entity
export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

// URL parameters for user routes
export interface UserParams {
  id: string;
}

export interface manageFriendsBody {
  user1_id: string;
  user2_id: string;
  action: "add" | "accept" | "decline" | "remove";
  created_at?: string;
  updated_at?: string;
}

// Response types
export type manageFriendsResponse = ApiResponse<manageFriendsBody>;

