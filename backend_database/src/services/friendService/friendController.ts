// src/services/friendService/friendController.ts
import {
  UserParams,
  ManageFriendsBody,
  FriendStatus,
  FriendsStatusResponse,
} from "./friendTypes.ts";
import { ApiResponse } from "../../types/commonTypes.ts";
import { ApiResponseHelper } from "../../utils/responseUtils.ts";
import { errors } from "../../utils/errorUtils.ts";
import "../../types/fastifyTypes.ts";
import { createHandler } from "../../utils/handlerUtils.ts";
import { ensureDifferentUsers, ensureUsersExist, getFriendshipRecord } from "./friendUtils.ts";

export const friendController = {
  addFriend: createHandler<{ Params: UserParams }, ApiResponse<ManageFriendsBody>>(
    async (request, { db }) => {
      const { id } = request.params;
      const user1_Id = request.user!.id;
      const user2_Id = parseInt(id);

      ensureDifferentUsers(user1_Id, user2_Id);
      await ensureUsersExist(db, user1_Id, user2_Id);

      const existingRequest = await getFriendshipRecord(db, user1_Id, user2_Id);
      if (existingRequest) {
        throw errors.conflict("A friend request already exists between these users", {
          user1_Id,
          user2_Id,
          existingStatus: existingRequest.status,
          endpoint: "addFriend",
        });
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
        created_at,
      };
      return ApiResponseHelper.success(responseBody, "Friend request sent");
    }
  ),

  acceptFriend: createHandler<{ Params: UserParams }, ApiResponse<ManageFriendsBody>>(
    async (request, { db }) => {
      const { id } = request.params;
      const user1_Id = request.user!.id;
      const user2_Id = parseInt(id);

      ensureDifferentUsers(user1_Id, user2_Id);
      await ensureUsersExist(db, user1_Id, user2_Id);

      const existingRequest = await getFriendshipRecord(db, user1_Id, user2_Id);
      if (!existingRequest) {
        throw errors.conflict("No friend request exists between these users", {
          user1_Id,
          user2_Id,
          endpoint: "acceptFriend",
        });
      }
      if (existingRequest.inviter_id === user1_Id) {
        throw errors.conflict("You cannot accept a friend request you sent yourself", {
          user1_Id,
          user2_Id,
          inviterId: existingRequest.inviter_id,
          endpoint: "acceptFriend",
        });
      }
      if (existingRequest.status === "accepted") {
        throw errors.conflict("These users are already friends", {
          user1_Id,
          user2_Id,
          status: existingRequest.status,
          endpoint: "acceptFriend",
        });
      }
      if (existingRequest.status === "declined") {
        throw errors.conflict("This friend request has already been declined by one of the users", {
          user1_Id,
          user2_Id,
          status: existingRequest.status,
          endpoint: "acceptFriend",
        });
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
        updated_at,
      };
      return ApiResponseHelper.success(responseBody, "Friend request accepted");
    }
  ),

  declineFriend: createHandler<{ Params: UserParams }, ApiResponse<ManageFriendsBody>>(
    async (request, { db }) => {
      const { id } = request.params;
      const user1_Id = request.user!.id;
      const user2_Id = parseInt(id);

      ensureDifferentUsers(user1_Id, user2_Id);
      await ensureUsersExist(db, user1_Id, user2_Id);

      const existingRequest = await getFriendshipRecord(db, user1_Id, user2_Id);
      if (!existingRequest) {
        throw errors.conflict("No friend request exists between these users", {
          user1_Id,
          user2_Id,
          endpoint: "declineFriend",
        });
      }
      if (existingRequest.inviter_id === user1_Id) {
        throw errors.conflict(
          "You cannot decline a friend request you sent yourself, you can delete the friend-request instead",
          {
            user1_Id,
            user2_Id,
            inviterId: existingRequest.inviter_id,
            endpoint: "declineFriend",
          }
        );
      }
      if (existingRequest.status === "accepted") {
        throw errors.conflict(
          "These users are already friends, you can delete the friendship instead",
          {
            user1_Id,
            user2_Id,
            status: existingRequest.status,
            endpoint: "declineFriend",
          }
        );
      }
      if (existingRequest.status === "declined") {
        throw errors.conflict("This friend request has already been declined", {
          user1_Id,
          user2_Id,
          status: existingRequest.status,
          endpoint: "declineFriend",
        });
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
        updated_at,
      };
      return ApiResponseHelper.success(responseBody, "Friend request declined");
    }
  ),

  removeFriend: createHandler<{ Params: UserParams }, ApiResponse<ManageFriendsBody>>(
    async (request, { db }) => {
      const { id } = request.params;
      const user1_Id = request.user!.id;
      const user2_Id = parseInt(id);

      ensureDifferentUsers(user1_Id, user2_Id);
      await ensureUsersExist(db, user1_Id, user2_Id);

      const existingRequest = await getFriendshipRecord(db, user1_Id, user2_Id);
      if (!existingRequest) {
        throw errors.conflict("No friend request exists between these users", {
          user1_Id,
          user2_Id,
          endpoint: "removeFriend",
        });
      }
      if (existingRequest.status === "declined" && existingRequest.inviter_id === user1_Id) {
        throw errors.conflict(
          "You cannot delete a friend request you sent yourself that has been declined",
          {
            user1_Id,
            user2_Id,
            status: existingRequest.status,
            inviterId: existingRequest.inviter_id,
            endpoint: "removeFriend",
          }
        );
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
        updated_at,
      };
      return ApiResponseHelper.success(responseBody, "Friend removed successfully");
    }
  ),

  getFriendsStatus: createHandler<{}, ApiResponse<FriendsStatusResponse>>(
    async (request, { db }) => {
      const userId = request.user!.id;

      // Online threshold: 2 minutes (configurable)
      const ONLINE_THRESHOLD_MINUTES = 2;

      // Get all friend requests for the current user (accepted, pending, declined)
      const friends = await db.all<FriendStatus>(
        `SELECT 
          CASE 
            WHEN f.user1_id = ? THEN f.user2_id 
            ELSE f.user1_id 
          END as user_id,
          u.username,
          u.last_seen,
          CASE 
            WHEN u.last_seen IS NULL THEN 0
            WHEN (julianday('now') - julianday(u.last_seen)) * 24 * 60 <= ? THEN 1
            ELSE 0
          END as is_online,
          f.status,
          f.inviter_id,
          inviter.username as inviter_username,
          CASE 
            WHEN f.inviter_id = ? THEN 1
            ELSE 0
          END as is_inviter,
          f.created_at,
          f.updated_at
        FROM friends f
        JOIN users u ON (
          CASE 
            WHEN f.user1_id = ? THEN u.id = f.user2_id 
            ELSE u.id = f.user1_id 
          END
        )
        JOIN users inviter ON inviter.id = f.inviter_id
        WHERE (f.user1_id = ? OR f.user2_id = ?)
        ORDER BY 
          CASE f.status
            WHEN 'pending' THEN 1
            WHEN 'accepted' THEN 2
            WHEN 'declined' THEN 3
          END,
          is_online DESC, 
          u.username ASC`,
        [userId, ONLINE_THRESHOLD_MINUTES, userId, userId, userId, userId]
      );

      // Convert is_online and is_inviter from 0/1 to boolean
      const friendsWithStatus: FriendStatus[] = friends.map((f) => ({
        ...f,
        is_online: Boolean(f.is_online),
        is_inviter: Boolean(f.is_inviter),
      }));

      const response: FriendsStatusResponse = {
        friends: friendsWithStatus,
        online_threshold_minutes: ONLINE_THRESHOLD_MINUTES,
      };

      return ApiResponseHelper.success(response, "Friends status retrieved");
    }
  ),
};
