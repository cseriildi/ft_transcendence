import { FastifyInstance } from "fastify";
import { friendController } from "./friendController.ts";
import { requireAuth } from "../../utils/authUtils.ts";
import { UserSchemas } from "./friendSchemas.ts";
import { UserParams, ManageFriendsBody, FriendsStatusResponse } from "./friendTypes.ts";
import { ApiResponse } from "../../types/commonTypes.ts";

async function friendRoutes(fastify: FastifyInstance) {
  fastify.post<{ Params: UserParams; Reply: ApiResponse<ManageFriendsBody> }>(
    "/friends/:id",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["friend"],
        description: "Add a user as a friend (requires authentication)",
        security: [{ bearerAuth: [] }],
        ...UserSchemas.manageFriends,
      },
    },
    friendController.addFriend
  );

  fastify.patch<{ Params: UserParams; Reply: ApiResponse<ManageFriendsBody> }>(
    "/friends/:id/accept",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["friend"],
        description: "Accept a friend request (requires authentication)",
        security: [{ bearerAuth: [] }],
        ...UserSchemas.manageFriends,
      },
    },
    friendController.acceptFriend
  );

  fastify.patch<{ Params: UserParams; Reply: ApiResponse<ManageFriendsBody> }>(
    "/friends/:id/decline",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["friend"],
        description: "Decline a friend request (requires authentication)",
        security: [{ bearerAuth: [] }],
        ...UserSchemas.manageFriends,
      },
    },
    friendController.declineFriend
  );

  fastify.delete<{ Params: UserParams; Reply: ApiResponse<ManageFriendsBody> }>(
    "/friends/:id",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["friend"],
        description: "Delete a friend from friends (requires authentication)",
        security: [{ bearerAuth: [] }],
        ...UserSchemas.manageFriends,
      },
    },
    friendController.removeFriend
  );

  fastify.get<{ Reply: ApiResponse<FriendsStatusResponse> }>(
    "/friends/status",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["friend"],
        description: "Get online status of all friends (requires authentication)",
        security: [{ bearerAuth: [] }],
        ...UserSchemas.getFriendsStatus,
      },
    },
    friendController.getFriendsStatus
  );

  // Create a friend-game invitation (generates a new gameId)
  fastify.post<{ Params: UserParams }>(
    "/friends/:id/invite",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["friend"],
        description: "Create a friend-game invitation and return gameId",
        security: [{ bearerAuth: [] }],
        params: UserSchemas.manageFriends.params,
      },
    },
    friendController.inviteFriend
  );

  // Internal endpoints for friend-game invitations (fetch/delete by id)
  fastify.get<{ Params: { id: number } }>(
    "/friend-invitations/:id",
    {
      schema: {
        tags: ["friend"],
        description: "Retrieve friend game invitation by id (internal)",
        params: { type: "object", properties: { id: { type: "number" } }, required: ["id"] },
      },
    },
    friendController.getInvitationById
  );

  fastify.delete<{ Params: { id: number } }>(
    "/friend-invitations/:id",
    {
      schema: {
        tags: ["friend"],
        description: "Delete friend game invitation by id (internal)",
        params: { type: "object", properties: { id: { type: "number" } }, required: ["id"] },
      },
    },
    friendController.deleteInvitationById
  );
}

export default friendRoutes;
