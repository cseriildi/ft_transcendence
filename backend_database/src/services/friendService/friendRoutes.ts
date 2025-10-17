import { FastifyInstance } from "fastify";
import { friendController } from "./friendController.ts";
import { requireAuth } from "../../utils/authUtils.ts";
import { UserSchemas } from "./friendSchemas.ts";
import { UserParams, ManageFriendsBody } from "./friendTypes.ts";
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
        ...UserSchemas.manageFriends
      }
    },
    friendController.addFriend
  )

    fastify.patch<{ Params: UserParams; Reply: ApiResponse<ManageFriendsBody> }>(
    "/friends/:id/accept",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["friend"],
        description: "Accept a friend request (requires authentication)",
        security: [{ bearerAuth: [] }],
        ...UserSchemas.manageFriends
      }
    },
    friendController.acceptFriend
  )

      fastify.patch<{ Params: UserParams; Reply: ApiResponse<ManageFriendsBody> }>(
    "/friends/:id/decline",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["friend"],
        description: "Decline a friend request (requires authentication)",
        security: [{ bearerAuth: [] }],
        ...UserSchemas.manageFriends
      }
    },
    friendController.declineFriend
  )

  fastify.delete<{ Params: UserParams; Reply: ApiResponse<ManageFriendsBody> }>(
    "/friends/:id",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["friend"],
        description: "Delete a friend from friends (requires authentication)",
        security: [{ bearerAuth: [] }],
        ...UserSchemas.manageFriends
      }
    },
    friendController.removeFriend
  )
}

export default friendRoutes;