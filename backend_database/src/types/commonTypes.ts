export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ErrorResponse {
  success: false;
  error: string;
  message?: string;
  timestamp: string;
}

// Common entity types used across services
export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export interface TokenPair {
  accessToken: string;
}
