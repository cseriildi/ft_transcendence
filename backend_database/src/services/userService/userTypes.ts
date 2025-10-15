export interface UploadAvatarData {
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
