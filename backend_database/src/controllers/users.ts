// src/routes/users.ts
import { FastifyReply, FastifyRequest } from "fastify";
import {
  User,
  CreateUserBody,
  UserParams,
  CreateUserResponse,
  GetUserResponse,
  GetUsersResponse,
  UserErrorResponse,
} from "../types/users.ts";
import { ApiResponseHelper } from "../utils/responses.ts";
import { errors } from "../utils/errors.ts";
import "../types/fastify.ts";

export const userController = {
  // Handler to create a new user
  async getUserById(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<GetUserResponse | UserErrorResponse> {
    const { id } = request.params as UserParams;
    const { db } = request.server;
    // Direct database call
    const user = await new Promise<User | null>((resolve, reject) => {
      db.get(
        "SELECT id, username, email, created_at FROM users WHERE id = ?",
        [id],
        (err: Error | null, row: User | undefined) => {
          if (err) {
            reject(errors.internal("Database error"));
          } else {
            resolve(row || null);
          }
        }
      );
    });

    if (!user) {
      throw errors.notFound("User");
    }
    return ApiResponseHelper.success(user, "User found");
  },

  async getUsers(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<GetUsersResponse | UserErrorResponse> {
    const { db } = request.server;
    const users = await new Promise<User[]>((resolve, reject) => {
      db.all(
        "SELECT id, username, email, created_at FROM users ORDER BY created_at DESC",
        [],
        (err: Error | null, rows: User[]) => {
          if (err) {
            reject(errors.internal("Database error"));
          } else {
            resolve(rows || []);
          }
        }
      );
    });
    return ApiResponseHelper.success(users, "Users retrieved");
  },

  async createUser(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<CreateUserResponse | UserErrorResponse> {
    const { username, email } = (request.body as CreateUserBody) || {};
    const { db } = request.server;
    if (!username?.trim() || !email?.trim()) {
      throw errors.validation("Username and email are required");
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      throw errors.validation("Invalid email format");
    }

    // Direct database call
    const result = await new Promise<{ lastID: number; changes: number }>(
      (resolve, reject) => {
        db.run(
          "INSERT INTO users (username, email) VALUES (?, ?)",
          [username.trim(), email.trim()],
          function (err) {
            if (err) {
              if (err.message.includes("UNIQUE constraint")) {
                reject(errors.conflict("Username or email already exists"));
              } else {
                reject(errors.internal("Database error"));
              }
            } else {
              resolve({ lastID: this.lastID, changes: this.changes });
            }
          }
        );
      }
    );

    reply.status(201);
    return ApiResponseHelper.success(
      {
        id: result.lastID,
        username: username.trim(),
        email: email.trim(),
        created_at: new Date().toISOString(),
      },
      "User created"
    );
  },
};
