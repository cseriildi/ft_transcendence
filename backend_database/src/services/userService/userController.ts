// src/routes/users.ts
import { UserParams, UploadAvatarData } from "./userTypes.ts";
import { User, ApiResponse } from "../../types/commonTypes.ts";
import { ApiResponseHelper } from "../../utils/responseUtils.ts";
import { errors } from "../../utils/errorUtils.ts";
import "../../types/fastifyTypes.ts";
import { createHandler } from "../../utils/handlerUtils.ts";
import { saveUploadedFile, deleteUploadedFile } from "../../utils/uploadUtils.ts";
import { MultipartFile } from "@fastify/multipart";
import { ensureUserOwnership } from "../../utils/authUtils.ts";

export const userController = {
  //structure for createHAndler:
  // createHandler<{ whatever is provoded as neccesary for the query }, response type>(
  //   async (request, { db , reply(optional)}) => {
  //     // handler logic
  //   }
  // ),
  getUserById: createHandler<{ Params: UserParams }, ApiResponse<User>>(async (request, { db }) => {
    const { id } = request.params;
    ensureUserOwnership(request.user!.id, id);

    const user = await db.get<User>("SELECT id,username,email,created_at FROM users WHERE id = ?", [
      id,
    ]);
    if (!user) {
      throw errors.notFound("User");
    }
    // Retrieve avatar URL using helper (throws error if not found)
    user.avatar_url = await db.getAvatarUrl(user.id);

    return ApiResponseHelper.success(user, "User found");
  }),

  getUsers: createHandler<{}, ApiResponse<User[]>>(async (request, { db }) => {
    const users = await db.all<User>(
      `SELECT 
          u.id, 
          u.username, 
          u.email, 
          u.created_at,
          a.file_url as avatar_url
        FROM users u
        LEFT JOIN avatars a ON u.id = a.user_id
        ORDER BY u.created_at DESC`
    );
    return ApiResponseHelper.success(users, "Users retrieved");
  }),

  uploadAvatar: createHandler<{}, ApiResponse<UploadAvatarData>>(async (request, { db }) => {
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
        if (part.type === "file" && part.fieldname === "avatar") {
          const file = part as MultipartFile;
          avatarUrl = await saveUploadedFile(file);
          filePath = avatarUrl.replace(/^\/uploads\/avatars\//, "");
          fileMetadata = {
            filename: file.filename,
            mimetype: file.mimetype,
            fileSize: (file as { file?: { bytesRead?: number } }).file?.bytesRead || 0,
          };
          break;
        }
      }

      if (!avatarUrl || !fileMetadata || !filePath) {
        throw errors.validation("No avatar file provided in request");
      }

      await db.transaction(async (tx) => {
        if (oldAvatarUrl) {
          await tx.run(
            "UPDATE avatars SET file_path = ?, file_url = ?, file_name = ?, mime_type = ?, file_size = ? WHERE user_id = ?",
            [
              filePath,
              avatarUrl,
              fileMetadata!.filename,
              fileMetadata!.mimetype,
              fileMetadata!.fileSize,
              userId,
            ]
          );
        } else {
          await tx.run(
            "INSERT INTO avatars (user_id, file_path, file_url, file_name, mime_type, file_size) VALUES (?, ?, ?, ?, ?, ?)",
            [
              userId,
              filePath,
              avatarUrl,
              fileMetadata!.filename,
              fileMetadata!.mimetype,
              fileMetadata!.fileSize,
            ]
          );
        }
      });

      if (oldAvatarUrl) {
        await deleteUploadedFile(oldAvatarUrl);
      }

      const result = await db.get<UploadAvatarData>(
        "SELECT u.username, a.file_url as avatar_url, a.created_at FROM users u JOIN avatars a ON u.id = a.user_id WHERE u.id = ?",
        [userId]
      );

      if (!result) {
        throw errors.internal("Failed to retrieve uploaded avatar information");
      }

      return ApiResponseHelper.success(result, "Avatar uploaded successfully");
    } catch (err: unknown) {
      if (avatarUrl) {
        await deleteUploadedFile(avatarUrl);
      }
      throw err;
    }
  }),

  changeEmail: createHandler<{ Params: UserParams }, ApiResponse<User>>(async (request, { db }) => {
    const { id } = request.params;
    ensureUserOwnership(request.user!.id, id);
    const { email } = request.body as { email: string };

    // Schema already validates email format and required field
    // Check if email is already in use by another user
    const existingEmail = await db.get<User>("SELECT id FROM users WHERE email = ? AND id != ?", [
      email.trim(),
      id,
    ]);
    if (existingEmail) {
      throw errors.conflict("Email is already in use by another account");
    }

    // Update email
    await db.run("UPDATE users SET email = ? WHERE id = ?", [email.trim(), id]);

    const updatedUser = await db.get<User>(
      "SELECT id, username, email, created_at FROM users WHERE id = ?",
      [id]
    );
    if (!updatedUser) {
      throw errors.notFound("User");
    }

    return ApiResponseHelper.success(updatedUser, "Email updated successfully");
  }),

  changeUsername: createHandler<{ Params: UserParams }, ApiResponse<User>>(
    async (request, { db }) => {
      const { id } = request.params;
      ensureUserOwnership(request.user!.id, id);
      const { username } = request.body as { username: string };

      // Check if username is already in use by another user
      const existingUsername = await db.get<User>(
        "SELECT id FROM users WHERE username = ? AND id != ?",
        [username.trim(), id]
      );
      if (existingUsername) {
        throw errors.conflict("Username is already in use by another account");
      }

      // Update username
      await db.run("UPDATE users SET username = ? WHERE id = ?", [username.trim(), id]);

      const updatedUser = await db.get<User>(
        "SELECT id, username, email, created_at FROM users WHERE id = ?",
        [id]
      );
      if (!updatedUser) {
        throw errors.notFound("User");
      }

      return ApiResponseHelper.success(updatedUser, "Username updated successfully");
    }
  ),

  updateHeartbeat: createHandler<{ Params: UserParams }, ApiResponse<{ last_seen: string }>>(
    async (request, { db }) => {
      const { id } = request.params;
      ensureUserOwnership(request.user!.id, id);

      const last_seen = new Date().toISOString();

      await db.run("UPDATE users SET last_seen = ? WHERE id = ?", [last_seen, id]);

      return ApiResponseHelper.success({ last_seen }, "Heartbeat updated");
    }
  ),
};
