// src/routes/users.ts
import {
  User,
  UserParams,
  GetUserResponse,
  GetUsersResponse,
  uploadAvatarResponse,
  uploadAvatar,
  manageFriendsResponse
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

  changeEmail: createHandler<{ Params: UserParams }, GetUserResponse>(
    async (request, { db }) => {
      const { id } = request.params;
      const tokenUserId = request.user?.id;
      const { email } = request.body as { email: string };

      // Ensure the user can only update their own data
      if (tokenUserId !== parseInt(id)) {
        throw errors.forbidden("Token Subject-ID does not match user ID of requested Resource");
      }

      // Schema already validates email format and required field
      // Check if email is already in use by another user
      const existingEmail = await db.get<User>(
        "SELECT id FROM users WHERE email = ? AND id != ?",
        [email.trim(), id]
      );
      if (existingEmail) {
        throw errors.conflict("Email is already in use by another account");
      }

      // Update email
      await db.run(
        "UPDATE users SET email = ? WHERE id = ?",
        [email.trim(), id]
      );

      const updatedUser = await db.get<User>(
        "SELECT id, username, email, created_at FROM users WHERE id = ?",
        [id]
      );
      if (!updatedUser) {
        throw errors.notFound("User");
      }

      return ApiResponseHelper.success(updatedUser, "Email updated successfully");
    }
  ),

  changeUsername: createHandler<{ Params: UserParams }, GetUserResponse>(
    async (request, { db }) => {
      const { id } = request.params;
      const tokenUserId = request.user?.id;
      const { username } = request.body as { username: string };

      // Ensure the user can only update their own data
      if (tokenUserId !== parseInt(id)) {
        throw errors.forbidden("Token Subject-ID does not match user ID of requested Resource");
      }
      
      // Check if username is already in use by another user
      const existingUsername = await db.get<User>(
        "SELECT id FROM users WHERE username = ? AND id != ?",
        [username.trim(), id]
      );
      if (existingUsername) {
        throw errors.conflict("Username is already in use by another account");
      }

      // Update username
      await db.run(
        "UPDATE users SET username = ? WHERE id = ?",
        [username.trim(), id]
      );

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

  addFriend: createHandler<{ Params: UserParams }, manageFriendsResponse>(
    async (request, { db }) => {
      const { id } = request.params;
      const tokenUserId = request.user!.id;
      const user2_Id = parseInt(id);
      const user1_Id = tokenUserId;

      if (user1_Id === user2_Id) {
        throw errors.validation("Tokenuser ID and Param ID cannot be the same");
      }

      // Check if users exist
      const user1 = await db.get<User>("SELECT id FROM users WHERE id = ?", [user1_Id]);
      const user2 = await db.get<User>("SELECT id FROM users WHERE id = ?", [user2_Id]);
      if (!user1 || !user2) {
        throw errors.notFound("One or both users not found");
      }

      // Check if a friend request already exists
      const existingRequest = await db.get(
        "SELECT * FROM friends WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)",
        [user1_Id, user2_Id, user2_Id, user1_Id]
      );
      if (existingRequest) {
        throw errors.conflict("A friend request already exists between these users");
      }

      const created_at = new Date().toISOString();

      // Create friend request
      await db.run(
        "INSERT INTO friends (user1_id, user2_id, inviter_id, status, created_at) VALUES (?, ?, ?, 'pending', ?)",
        [user1_Id, user2_Id, user1_Id, created_at]
      );

      const responseBody = {
        user1_Id: user1_Id.toString(),
        user2_Id: user2_Id.toString(),
        action: "add" as const,
        created_at
      };
      return ApiResponseHelper.success(responseBody, "Friend request sent");
    }
  ),

  acceptFriend: createHandler<{ Params: UserParams }, manageFriendsResponse>(
    async (request, { db }) => {
      const { id } = request.params;
      const tokenUserId = request.user!.id;
      const user2_Id = parseInt(id);
      const user1_Id = tokenUserId;

      if (user1_Id === user2_Id) {
        throw errors.validation("Tokenuser ID and Param ID cannot be the same");
      }

      // Check if users exist
      const user1 = await db.get<User>("SELECT id FROM users WHERE id = ?", [user1_Id]);
      const user2 = await db.get<User>("SELECT id FROM users WHERE id = ?", [user2_Id]);
      if (!user1 || !user2) {
        throw errors.notFound("One or both users not found");
      }

      // Check if a friend request already exists
      const existingRequest = await db.get(
        "SELECT * FROM friends WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)",
        [user1_Id, user2_Id, user2_Id, user1_Id]
      );
      if (!existingRequest) {
        throw errors.conflict("No friend request exists between these users");
      }
      if (existingRequest.inviter_id === user1_Id) {
        throw errors.conflict("You cannot accept a friend request you sent yourself");
      }
      if (existingRequest.status === 'accepted') {
        throw errors.conflict("These users are already friends");
      }
      if (existingRequest.status === 'declined') {
        throw errors.conflict("This friend request has already been declined by one of the users");
      }

      const updated_at = new Date().toISOString();

      // Create friend request
       await db.run(
      "UPDATE friends SET status = 'accepted', updated_at = ? WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)",
      [updated_at, user1_Id, user2_Id, user2_Id, user1_Id]
      );

      const responseBody = {
        user1_Id: user1_Id.toString(),
        user2_Id: user2_Id.toString(),
        action: "accept" as const,
        updated_at
      };
      return ApiResponseHelper.success(responseBody, "Friend request accepted");
    }
  ),

  declineFriend: createHandler<{ Params: UserParams }, manageFriendsResponse>(
    async (request, { db }) => {
      const { id } = request.params;
      const tokenUserId = request.user!.id;
      const user2_Id = parseInt(id);
      const user1_Id = tokenUserId;

      if (user1_Id === user2_Id) {
        throw errors.validation("Tokenuser ID and Param ID cannot be the same");
      }

      // Check if users exist
      const user1 = await db.get<User>("SELECT id FROM users WHERE id = ?", [user1_Id]);
      const user2 = await db.get<User>("SELECT id FROM users WHERE id = ?", [user2_Id]);
      if (!user1 || !user2) {
        throw errors.notFound("One or both users not found");
      }

      // Check if a friend request already exists
      const existingRequest = await db.get(
        "SELECT * FROM friends WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)",
        [user1_Id, user2_Id, user2_Id, user1_Id]
      );
      if (!existingRequest) {
        throw errors.conflict("No friend request exists between these users");
      }
      if (existingRequest.inviter_id === user1_Id) {
        throw errors.conflict("You cannot decline a friend request you sent yourself, you can delete the friend-request instead");
      }
      if (existingRequest.status === 'accepted') {
        throw errors.conflict("These users are already friends, you can delete the friendship instead");
      }
      if (existingRequest.status === 'declined') {
        throw errors.conflict("This friend request has already been declined");
      }

      const updated_at = new Date().toISOString();

      // Create friend request
      await db.run(
      "UPDATE friends SET status = 'declined', updated_at = ? WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)",
      [updated_at, user1_Id, user2_Id, user2_Id, user1_Id]
      );

      const responseBody = {
        user1_Id: user1_Id.toString(),
        user2_Id: user2_Id.toString(),
        action: "decline" as const,
        updated_at
      };
      return ApiResponseHelper.success(responseBody, "Friend request accepted");
    }
  ),

  removeFriend: createHandler<{ Params: UserParams }, manageFriendsResponse>(
    async (request, { db }) => {
      const { id } = request.params;
      const tokenUserId = request.user!.id;
      const user2_Id = parseInt(id);
      const user1_Id = tokenUserId;

      if (user1_Id === user2_Id) {
        throw errors.validation("Tokenuser ID and Param ID cannot be the same");
      }

      // Check if users exist
      const user1 = await db.get<User>("SELECT id FROM users WHERE id = ?", [user1_Id]);
      const user2 = await db.get<User>("SELECT id FROM users WHERE id = ?", [user2_Id]);
      if (!user1 || !user2) {
        throw errors.notFound("One or both users not found");
      }

      // Check if a friend request already exists
      const existingRequest = await db.get(
        "SELECT * FROM friends WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)",
        [user1_Id, user2_Id, user2_Id, user1_Id]
      );
      if (!existingRequest) {
        throw errors.conflict("No friend request exists between these users");
      }
      if (existingRequest.status == 'declined' && existingRequest.inviter_id === user1_Id) {
        throw errors.conflict("You cannot delete a friend request you sent yourself that has been declined");
      }

      const updated_at = new Date().toISOString();
      await db.run(
        "DELETE FROM friends WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)",
        [user1_Id, user2_Id, user2_Id, user1_Id]
      );
      

      const responseBody = {
        user1_Id: user1_Id.toString(),
        user2_Id: user2_Id.toString(),
        action: "remove" as const,
        updated_at
      };
      return ApiResponseHelper.success(responseBody, "Friend removed successfully");
    }
  ),

};
