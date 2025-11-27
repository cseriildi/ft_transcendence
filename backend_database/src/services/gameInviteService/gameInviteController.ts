import { FastifyRequest, FastifyReply } from "fastify";
import { DatabaseHelper } from "../../utils/databaseUtils.ts";
import { requestErrors } from "../../utils/errorUtils.ts";
import { ApiResponseHelper } from "../../utils/responseUtils.ts";
import { ApiResponse } from "../../types/commonTypes.ts";
import {
  GameInviteParams,
  CreateGameInviteResponse,
  GameInviteResponse,
  GameInviteListResponse,
  GameInviteListItem,
} from "./gameInviteTypes.ts";
import { ensureDifferentUsers, ensureUsersExist } from "../friendService/friendUtils.ts";
import {
  validatePositiveId,
  getGameInviteById,
  ensureGameInviteAccess,
  ensureUsersFriends,
  findPendingGameInvite,
} from "./gameInviteUtils.ts";
import "../../types/fastifyTypes.ts";

export const gameInviteController = {
  /**
   * Create a game invitation to a friend
   * POST /api/game-invites/:id
   */
  createInvite: async (
    request: FastifyRequest<{ Params: GameInviteParams }>,
    _reply: FastifyReply
  ): Promise<ApiResponse<CreateGameInviteResponse>> => {
    const db = new DatabaseHelper(request.server.db);
    const { id } = request.params;
    const inviterId = request.user!.id;
    const inviteeId = validatePositiveId(id, "user ID");

    // Validate users exist and are different
    ensureDifferentUsers(inviterId, inviteeId);
    await ensureUsersExist(db, inviterId, inviteeId);

    // Verify friendship exists and is accepted
    await ensureUsersFriends(db, inviterId, inviteeId);

    // Check for existing pending invitation in either direction
    const existingInvite = await findPendingGameInvite(db, inviterId, inviteeId);

    if (existingInvite) {
      // Return existing pending invite (use the actual inviter/invitee from DB)
      const responseBody: CreateGameInviteResponse = {
        game_id: existingInvite.id,
        inviter_id: String(existingInvite.inviter_id),
        invitee_id: String(existingInvite.invitee_id),
        status: existingInvite.status,
        created_at: existingInvite.created_at,
      };
      return ApiResponseHelper.success(responseBody, "Game invitation already exists");
    }

    // Create new invitation
    const created_at = new Date().toISOString();
    const result = await db.run(
      "INSERT INTO friend_game_invitations (inviter_id, invitee_id, status, created_at, updated_at) VALUES (?, ?, 'pending', ?, ?)",
      [inviterId, inviteeId, created_at, created_at]
    );

    const responseBody: CreateGameInviteResponse = {
      game_id: result.lastID!,
      inviter_id: String(inviterId),
      invitee_id: String(inviteeId),
      status: "pending",
      created_at,
    };

    return ApiResponseHelper.success(responseBody, "Game invitation created successfully");
  },

  /**
   * Get a specific game invitation by ID
   * GET /api/game-invites/:id
   */
  getInvite: async (
    request: FastifyRequest<{ Params: GameInviteParams }>,
    _reply: FastifyReply
  ): Promise<ApiResponse<GameInviteResponse>> => {
    const db = new DatabaseHelper(request.server.db);
    const errors = requestErrors(request);
    const { id } = request.params;
    const currentUserId = request.user!.id;
    const gameId = validatePositiveId(id, "game ID");

    // Fetch invitation with usernames
    const invite = await db.get<{
      id: number;
      inviter_id: number;
      invitee_id: number;
      inviter_username: string;
      invitee_username: string;
      status: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT
         fgi.id,
         fgi.inviter_id,
         fgi.invitee_id,
         fgi.status,
         fgi.created_at,
         fgi.updated_at,
         u1.username as inviter_username,
         u2.username as invitee_username
       FROM friend_game_invitations fgi
       JOIN users u1 ON u1.id = fgi.inviter_id
       JOIN users u2 ON u2.id = fgi.invitee_id
       WHERE fgi.id = ?`,
      [gameId]
    );

    if (!invite) {
      throw errors.notFound("Game invitation not found");
    }

    // Authorization: Only inviter or invitee can view
    if (invite.inviter_id !== currentUserId && invite.invitee_id !== currentUserId) {
      throw errors.forbidden("You are not authorized to view this game invitation");
    }

    const responseBody: GameInviteResponse = {
      game_id: invite.id,
      inviter_id: String(invite.inviter_id),
      invitee_id: String(invite.invitee_id),
      inviter_username: invite.inviter_username,
      invitee_username: invite.invitee_username,
      status: invite.status,
      created_at: invite.created_at,
      updated_at: invite.updated_at,
    };

    return ApiResponseHelper.success(responseBody, "Game invitation retrieved");
  },

  /**
   * Cancel a game invitation
   * DELETE /api/game-invites/:id
   */
  cancelInvite: async (
    request: FastifyRequest<{ Params: GameInviteParams }>,
    _reply: FastifyReply
  ): Promise<ApiResponse<{ game_id: number; status: string }>> => {
    const db = new DatabaseHelper(request.server.db);
    const errors = requestErrors(request);
    const { id } = request.params;
    const currentUserId = request.user!.id;
    const gameId = validatePositiveId(id, "game ID");

    // Fetch invitation
    const invite = await getGameInviteById(db, gameId);

    if (!invite) {
      throw errors.notFound("Game invitation not found");
    }

    // Authorization: Only inviter or invitee can cancel
    ensureGameInviteAccess(invite, currentUserId, "cancel");

    // Delete the invitation
    await db.run("DELETE FROM friend_game_invitations WHERE id = ?", [gameId]);

    return ApiResponseHelper.success(
      { game_id: gameId, status: "cancelled" },
      "Game invitation cancelled"
    );
  },

  /**
   * List all game invitations for current user (sent + received)
   * GET /api/game-invites
   */
  listInvites: async (
    request: FastifyRequest,
    _reply: FastifyReply
  ): Promise<ApiResponse<GameInviteListResponse>> => {
    const db = new DatabaseHelper(request.server.db);
    const currentUserId = request.user!.id;

    // Get all invitations where user is inviter or invitee
    const invites = await db.all<{
      id: number;
      inviter_id: number;
      invitee_id: number;
      inviter_username: string;
      invitee_username: string;
      status: string;
      is_sender: number; // SQLite returns 0/1
      created_at: string;
      updated_at: string;
    }>(
      `SELECT
         fgi.id,
         fgi.inviter_id,
         fgi.invitee_id,
         fgi.status,
         fgi.created_at,
         fgi.updated_at,
         u1.username as inviter_username,
         u2.username as invitee_username,
         CASE WHEN fgi.inviter_id = ? THEN 1 ELSE 0 END as is_sender
       FROM friend_game_invitations fgi
       JOIN users u1 ON u1.id = fgi.inviter_id
       JOIN users u2 ON u2.id = fgi.invitee_id
       WHERE fgi.inviter_id = ? OR fgi.invitee_id = ?
       ORDER BY
         CASE fgi.status
           WHEN 'pending' THEN 1
           WHEN 'accepted' THEN 2
           WHEN 'cancelled' THEN 3
         END,
         fgi.created_at DESC`,
      [currentUserId, currentUserId, currentUserId]
    );

    // Convert to proper response format
    const inviteList: GameInviteListItem[] = invites.map((inv) => ({
      game_id: inv.id,
      inviter_id: String(inv.inviter_id),
      invitee_id: String(inv.invitee_id),
      inviter_username: inv.inviter_username,
      invitee_username: inv.invitee_username,
      status: inv.status,
      is_sender: Boolean(inv.is_sender),
      created_at: inv.created_at,
      updated_at: inv.updated_at,
    }));

    const pendingCount = inviteList.filter((inv) => inv.status === "pending").length;

    const responseBody: GameInviteListResponse = {
      invites: inviteList,
      pending_count: pendingCount,
    };

    return ApiResponseHelper.success(responseBody, "Game invitations retrieved");
  },
};
