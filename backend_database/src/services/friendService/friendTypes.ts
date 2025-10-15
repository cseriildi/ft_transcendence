// URL parameters for user routes
export interface UserParams {
  id: string;
}

export interface ManageFriendsBody {
  user1_id: string;
  user2_id: string;
  action: "add" | "accept" | "decline" | "remove";
  created_at?: string;
  updated_at?: string;
}

