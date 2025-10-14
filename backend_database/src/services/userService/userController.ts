// src/routes/users.ts
import {
  User,
  UserParams,
  GetUserResponse,
  GetUsersResponse,
} from "./userTypes.ts";
import { ApiResponseHelper } from "../../utils/responseUtils.ts";
import { errors } from "../../utils/errorUtils.ts";
import "../../types/fastifyTypes.ts";
import { createHandler } from "../../utils/handlerUtils.ts";

export const userController = {

  //structure for createHAndler:
  // createHandler<{ whatever is provoded as neccesary for the query }, response type>(
  //   async (request, { db , reply(optional)}) => {
  //     // handler logic
  //   }
  // ),
  getUserById: createHandler<{ Params: UserParams }, GetUserResponse>(
    async (request, { db }) => {
      const { id } = request.params;
      const tokenUserId = request.user?.id;

      // Ensure the user can only access their own data
      if (tokenUserId !== parseInt(id)) {
        throw errors.forbidden("Token Subject-ID does not match user ID of requested Resource");
      }
      
      const user = await db.get<User>(
        "SELECT id,username,email,created_at FROM users WHERE id = ?",
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

};
