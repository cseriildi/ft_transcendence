// src/services/friendService/friendController.ts
import {
  UserParams,
  ManageFriendsBody
} from "./friendTypes.ts";
import { User, ApiResponse } from "../../types/commonTypes.ts";
import { ApiResponseHelper } from "../../utils/responseUtils.ts";
import { errors } from "../../utils/errorUtils.ts";
import "../../types/fastifyTypes.ts";
import { createHandler } from "../../utils/handlerUtils.ts";

export const friendController = {
  addFriend: createHandler<{ Params: UserParams }, ApiResponse<ManageFriendsBody>>(
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
        user1_id: user1_Id.toString(),
        user2_id: user2_Id.toString(),
        action: "add" as const,
        created_at
      };
      return ApiResponseHelper.success(responseBody, "Friend request sent");
    }
  ),

  acceptFriend: createHandler<{ Params: UserParams }, ApiResponse<ManageFriendsBody>>(
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
        user1_id: user1_Id.toString(),
        user2_id: user2_Id.toString(),
        action: "accept" as const,
        updated_at
      };
      return ApiResponseHelper.success(responseBody, "Friend request accepted");
    }
  ),

  declineFriend: createHandler<{ Params: UserParams }, ApiResponse<ManageFriendsBody>>(
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
        user1_id: user1_Id.toString(),
        user2_id: user2_Id.toString(),
        action: "decline" as const,
        updated_at
      };
      return ApiResponseHelper.success(responseBody, "Friend request declined");
    }
  ),

  removeFriend: createHandler<{ Params: UserParams }, ApiResponse<ManageFriendsBody>>(
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
      if (existingRequest.status === 'declined' && existingRequest.inviter_id === user1_Id) {
        throw errors.conflict("You cannot delete a friend request you sent yourself that has been declined");
      }

      const updated_at = new Date().toISOString();
      await db.run(
        "DELETE FROM friends WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)",
        [user1_Id, user2_Id, user2_Id, user1_Id]
      );
      

      const responseBody = {
        user1_id: user1_Id.toString(),
        user2_id: user2_Id.toString(),
        action: "remove" as const,
        updated_at
      };
      return ApiResponseHelper.success(responseBody, "Friend removed successfully");
    }
  ),

};
