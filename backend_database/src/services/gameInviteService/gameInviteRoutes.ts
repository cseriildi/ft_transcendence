import { FastifyInstance } from "fastify";
import { gameInviteController } from "./gameInviteController.ts";
import { requireAuth } from "../../utils/authUtils.ts";
import { requireServiceAuth } from "../../middleware/serviceAuthMiddleware.ts";
import { GameInviteSchemas } from "./gameInviteSchemas.ts";
import {
  GameInviteParams,
  CreateGameInviteResponse,
  GameInviteResponse,
  GameInviteListResponse,
} from "./gameInviteTypes.ts";
import { ApiResponse } from "../../types/commonTypes.ts";


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

  // Cancel/delete game invitation (internal service only - gamelogic)
  // Used by gamelogic to delete invitation after game completes
  fastify.delete<{
    Params: GameInviteParams;
    Reply: ApiResponse<{ game_id: number; status: string }>;
  }>(
    "/game-invites/:id",
    {
      preHandler: requireServiceAuth,
      schema: {
        tags: ["game-invites"],
        description: "Delete a game invitation (internal service only)",
        summary: "Delete a game invitation after game completion",
        hide: true,
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

  // Internal endpoint for game server to verify invitations (service auth required)
  // This endpoint is only accessible from internal services and returns minimal info
  fastify.get<{ Params: GameInviteParams; Reply: ApiResponse<GameInviteResponse> }>(
    "/internal/game-invites/:id",
    {
      preHandler: requireServiceAuth,
      schema: {
        tags: ["game-invites"],
        description: "Internal endpoint for game server to verify invitations",
        summary: "Verify a game invitation exists and is pending",
        hide: true,
      },
    },
    gameInviteController.getInviteInternal
  );
}

export default gameInviteRoutes;
