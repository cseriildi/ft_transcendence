// src/routes/users.ts
import {
  User,
  CreateUserBody,
  UserParams,
  CreateUserResponse,
  GetUserResponse,
  GetUsersResponse,
} from "../types/userTypes.ts";
import { ApiResponseHelper } from "../utils/responseUtils.ts";
import { errors } from "../utils/errorUtils.ts";
import "../types/fastifyTypes.ts";
import { createHandler } from "../utils/handlerUtils.ts";
import { UserSchemaValidator } from "../schemas/userSchemas.ts";

// alternatively maybe:
// FastifyReply methods (see https://www.fastify.io/docs/latest/Reply/)
// reply.status(201)           // Set HTTP status
// reply.header('key', 'val')  // Set response header  
// reply.send(data)           // Send response (rarely used with your pattern)
// reply.code(404)            // Alternative to status()
// reply.type('text/html')    // Set content type


export const userController = {

  //structure for createHAndler:
  // createHandler<{ whatever is provoded as neccesary for the query }, response type>(
  //   async (request, { db , reply(optional)}) => {
  //     // handler logic
  //   }
  // ),
  getUserById: createHandler<{ Params: UserParams }, GetUserResponse>(
    async (request, { db }) => {
      const valid = UserSchemaValidator.validateUserParams(request.params);
      if (!valid) throw errors.validation("Invalid parameter");
      const { id } = request.params;
      const user = await db.get<User>(
        "SELECT id, username, email, created_at FROM users WHERE id = ?",
        [id]
      );
      if (!user) {
        throw errors.notFound("User");
      }
      return ApiResponseHelper.success(user, "User found");
    }
  ),

   getUsers: createHandler<{}, GetUsersResponse>(
    async (request, { db }) => {
      const users = await db.all<User>(
        "SELECT id, username, email, created_at FROM users ORDER BY created_at DESC"
      );
      return ApiResponseHelper.success(users, "Users retrieved");
    }
  ),

  createUser: createHandler<{ Body: CreateUserBody }, CreateUserResponse>(
    async (request, { db, reply }) => {
      const valid = UserSchemaValidator.validateCreateUser(request.body);
      if (!valid) throw errors.validation("Invalid data provided");
      
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
        const result = await db.run(
          "INSERT INTO users (username, email) VALUES (?, ?)",
          [username.trim(), email.trim()]
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
};
