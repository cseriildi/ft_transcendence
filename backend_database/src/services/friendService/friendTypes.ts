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

export interface FriendStatus {
  user_id: number;
  username: string;
  is_online: boolean;
  last_seen: string | null;
  status: 'pending' | 'accepted' | 'declined';
  inviter_id: number;
  inviter_username: string;
  is_inviter: boolean; // true if current user is the inviter
  created_at: string;
  updated_at: string;
}

export interface FriendsStatusResponse {
  friends: FriendStatus[];
  online_threshold_minutes: number;
}
