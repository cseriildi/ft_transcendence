// User database entity
export interface User {
  id: number
  username: string
  email: string
  created_at: string
}

// Request body for creating a user
export interface CreateUserBody {
  username: string
  email: string
}

// Request body for updating a user (all optional)
export interface UpdateUserBody {
  username?: string
  email?: string
}

// URL parameters for user routes
export interface UserParams {
  id: string
}

// Response types
export interface CreateUserResponse {
  message: string
  user: {
    id: number
    username: string
    email: string
  }
}

export interface GetUserResponse {
  user: User
}

export interface GetUsersResponse {
  users: User[]
}

export interface ErrorResponse {
  error: string
}

