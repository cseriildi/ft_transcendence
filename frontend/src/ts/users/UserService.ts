import { config } from "../config.js";

export interface User {
  id: number;
  username: string;
  avatar_url: string;
}

export interface UsersResponse {
  data: User[];
}

export class UserService {
  async getUsers(): Promise<User[]> {
    try {
      const response = await fetch(`${config.apiUrl}/api/users`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (response.ok) {
        const data: UsersResponse = await response.json();
        return data.data;
      } else {
        return [];
      }
    } catch (error) {
      return [];
    }
  }
}
