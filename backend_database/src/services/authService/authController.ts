// src/routes/users.ts
import {
  User,
  CreateUserBody,
  CreateUserResponse,
  UserLoginResponse,
  UserLoginBody,
} from "./authTypes.ts";
import { ApiResponseHelper } from "../../utils/responseUtils.ts";
import { errors } from "../../utils/errorUtils.ts";
import "../../types/fastifyTypes.ts";
import { createHandler } from "../../utils/handlerUtils.ts";
import { AuthSchemaValidator } from "./authSchemas.ts";
import bcrypt from "bcrypt";


export const authController = {

  //structure for createHAndler:
  // createHandler<{ whatever is provoded as neccesary for the query }, response type>(
  //   async (request, { db , reply(optional)}) => {
  //     // handler logic
  //   }
  // ),

  createUser: createHandler<{ Body: CreateUserBody }, CreateUserResponse>(
    async (request, context) => {
      const { db, reply } = context;
      const valid = AuthSchemaValidator.validateCreateUser(request.body);
      if (!valid) throw errors.validation("Invalid request body");
      if (request.body.password !== request.body.confirmPassword) {
        throw errors.validation("Passwords do not match");
      }

      const { username, email } = request.body || {};
      
      // No longer needed because validator now takes care of it \(*_*)/ \(o_o)/
      //                                                             \       /
      // if (!username?.trim() || !email?.trim()) {                 /\     /\
      //   throw errors.validation("Username and email are required");
      // }
      // if (!/\S+@\S+\.\S+/.test(email)) {
      //   throw errors.validation("Invalid email format");
      // }

      try {
        const hash = await bcrypt.hash(request.body.password, 10);
        const result = await db.run(
          "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
          [username.trim(), email.trim(), hash]
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
      } catch (err: any) {
        if (err.message?.includes("UNIQUE constraint")) {
          throw errors.conflict("Username or email already exists");
        }
        throw err; // Re-throw other database errors
      }
    }
  ),

  loginUser: createHandler<{ Body: UserLoginBody }, UserLoginResponse>(
    async (request, context) => {
      const { db, reply } = context;
      const valid = AuthSchemaValidator.validateUserLogin(request.body);
      if (!valid) throw errors.validation("Invalid request body");
      const { email, password } = request.body || {};
      try {
        const result = await db.get<User & { password_hash: string }>(
          "SELECT id, username, email, created_at, password_hash FROM users WHERE email = ?",
          [email.trim()]
        );
        if (!result) {
          throw errors.unauthorized("Invalid email");
        }
        const passwordMatch = await bcrypt.compare(password, result.password_hash);
        if (!passwordMatch) {
          throw errors.unauthorized("Invalid password");
        }
        // Successful login
        // In a real application, you would generate and return a JWT or session token here
        reply.status(200);
        return ApiResponseHelper.success(
          {
            id: result.id,
            username: result.username,
            email: email.trim(),
            created_at: result.created_at,
          },
          "User logged in successfully"
        );
    } catch (err: any) {
        throw err; // Re-throw other database errors
      }
    }
  ),
};
