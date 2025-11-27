import { FastifyInstance } from "fastify";
import { gameInviteController } from "./gameInviteController.ts";
import { requireAuth } from "../../utils/authUtils.ts";
import { GameInviteSchemas } from "./gameInviteSchemas.ts";
import {
  GameInviteParams,
  CreateGameInviteResponse,
  GameInviteResponse,
  GameInviteListResponse,
} from "./gameInviteTypes.ts";
import { ApiResponse } from "../../types/commonTypes.ts";

/**
 * Game Invite Routes
 *
 * All routes protected with requireAuth middleware.
 * Rate limiting applied via authenticatedRateLimit in router.ts (100 req/min per user).
 */
async function gameInviteRoutes(fastify: FastifyInstance) {
  // Create game invitation to a friend
  fastify.post<{ Params: GameInviteParams; Reply: ApiResponse<CreateGameInviteResponse> }>(
    "/game-invites/:id",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["game-invites"],
        description: "Create a game invitation to a friend (requires authentication)",
        summary: "Invite a friend to play a game",
        security: [{ bearerAuth: [] }],
        ...GameInviteSchemas.createInvite,
      },
    },
    gameInviteController.createInvite
  );

  // Get specific game invitation
  fastify.get<{ Params: GameInviteParams; Reply: ApiResponse<GameInviteResponse> }>(
    "/game-invites/:id",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["game-invites"],
        description: "Get game invitation details (requires authentication)",
        summary: "Retrieve a specific game invitation",
        security: [{ bearerAuth: [] }],
        ...GameInviteSchemas.getInvite,
      },
    },
    gameInviteController.getInvite
  );

  // Cancel/delete game invitation
  fastify.delete<{
    Params: GameInviteParams;
    Reply: ApiResponse<{ game_id: number; status: string }>;
  }>(
    "/game-invites/:id",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["game-invites"],
        description: "Cancel a game invitation (requires authentication)",
        summary: "Cancel/delete a game invitation",
        security: [{ bearerAuth: [] }],
        ...GameInviteSchemas.cancelInvite,
      },
    },
    gameInviteController.cancelInvite
  );

  // List all game invitations for current user
  fastify.get<{ Reply: ApiResponse<GameInviteListResponse> }>(
    "/game-invites",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["game-invites"],
        description: "List all game invitations (sent + received) (requires authentication)",
        summary: "Get user's game invitations",
        security: [{ bearerAuth: [] }],
        ...GameInviteSchemas.listInvites,
      },
    },
    gameInviteController.listInvites
  );
}

export default gameInviteRoutes;
