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
import { saveUploadedFile, deleteUploadedFile } from "../../utils/uploadUtils.ts";
import { MultipartFile } from "@fastify/multipart";

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

  uploadAvatar: createHandler<{}, GetUserResponse>(
    async (request, { db }) => {
      const userId = request.user!.id;
      
      // Check if request is multipart
      if (!request.isMultipart()) {
        throw errors.validation("Request must be multipart/form-data with an avatar file");
      }

      let avatarUrl: string | undefined;
      let oldAvatarUrl: string | undefined;

      try {
        // Get current avatar URL (for cleanup)
        const currentUser = await db.get<User>(
          "SELECT avatar_url FROM users WHERE id = ?",
          [userId]
        );
        
        if (currentUser?.avatar_url && currentUser.avatar_url.startsWith('/uploads/')) {
          oldAvatarUrl = currentUser.avatar_url;
        }

        // Process multipart data
        const parts = request.parts();
        
        for await (const part of parts) {
          if (part.type === 'file' && part.fieldname === 'avatar') {
            avatarUrl = await saveUploadedFile(part as MultipartFile);
            break; // Only process first avatar file
          }
        }

        if (!avatarUrl) {
          throw errors.validation("No avatar file provided in request");
        }

        // Update user's avatar_url
        await db.run(
          "UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [avatarUrl, userId]
        );

        // Delete old avatar file if it exists
        if (oldAvatarUrl) {
          await deleteUploadedFile(oldAvatarUrl);
        }

        // Fetch updated user
        const updatedUser = await db.get<User>(
          "SELECT id, username, email, avatar_url, created_at FROM users WHERE id = ?",
          [userId]
        );

        if (!updatedUser) {
          throw errors.notFound("User");
        }

        return ApiResponseHelper.success(updatedUser, "Avatar uploaded successfully");
      } catch (err: any) {
        // Clean up newly uploaded file if update fails
        if (avatarUrl) {
          await deleteUploadedFile(avatarUrl);
        }
        throw err;
      }
    }
  ),

};
