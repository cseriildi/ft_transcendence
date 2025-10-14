// src/routes/users.ts
import {
  User,
  UserParams,
  GetUserResponse,
  GetUsersResponse,
  uploadAvatarResponse,
  uploadAvatar
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

  uploadAvatar: createHandler<{}, uploadAvatarResponse>(
    async (request, { db }) => {
      const userId = request.user!.id;
      
      // Check if request is multipart
      if (!request.isMultipart()) {
        throw errors.validation("Request must be multipart/form-data with an avatar file");
      }

      let avatarUrl: string | undefined;
      let filePath: string | undefined;
      let oldAvatarUrl: string | null = null;
      let fileMetadata: { filename: string; mimetype: string; fileSize: number } | undefined;

      try {
        // Get current avatar URL (for cleanup)
        const existingAvatar = await db.get<{ file_url: string } | undefined>(
          "SELECT file_url FROM avatars WHERE user_id = ?",
          [userId]
        );
        oldAvatarUrl = existingAvatar?.file_url || null;

        // Process multipart data
        const parts = request.parts();
        
        for await (const part of parts) {
          if (part.type === 'file' && part.fieldname === 'avatar') {
            const file = part as MultipartFile;
            avatarUrl = await saveUploadedFile(file);
            // Convert URL path to file system path
            filePath = avatarUrl.replace(/^\/uploads\/avatars\//, '');
            fileMetadata = {
              filename: file.filename,
              mimetype: file.mimetype,
              fileSize: (file as any).file?.bytesRead || 0
            };
            break; // Only process first avatar file
          }
        }

        if (!avatarUrl || !fileMetadata || !filePath) {
          throw errors.validation("No avatar file provided in request");
        }

        // Update or insert avatar record
        if (oldAvatarUrl) {
          await db.run(
            "UPDATE avatars SET file_path = ?, file_url = ?, file_name = ?, mime_type = ?, file_size = ? WHERE user_id = ?",
            [filePath, avatarUrl, fileMetadata.filename, fileMetadata.mimetype, fileMetadata.fileSize, userId]
          );
          await deleteUploadedFile(oldAvatarUrl);
        } else {
          await db.run(
            "INSERT INTO avatars (user_id, file_path, file_url, file_name, mime_type, file_size) VALUES (?, ?, ?, ?, ?, ?)",
            [userId, filePath, avatarUrl, fileMetadata.filename, fileMetadata.mimetype, fileMetadata.fileSize]
          );
        }

        const result = await db.get<uploadAvatar>(
          "SELECT u.username, a.file_url as avatar_url, a.created_at FROM users u JOIN avatars a ON u.id = a.user_id WHERE u.id = ?",
          [userId]
        );

        if (!result) {
          throw errors.internal("Failed to retrieve uploaded avatar information");
        }

        return ApiResponseHelper.success(result, "Avatar uploaded successfully");
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
