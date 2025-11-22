import { ApiResponseHelper } from "../../utils/responseUtils.ts";
import { requestErrors } from "../../utils/errorUtils.ts";
import "../../types/fastifyTypes.ts";
import { DatabaseHelper } from "../../utils/databaseUtils.ts";
import { FastifyRequest, FastifyReply } from "fastify";
import { Match, CreateMatchBody, GetMatchesQuery } from "./matchTypes.ts";
import { User, ApiResponse } from "../../types/commonTypes.ts";

export const matchController = {
  createMatch: async (
    request: FastifyRequest<{ Body: CreateMatchBody }>,
    reply: FastifyReply
  ): Promise<ApiResponse<Match>> => {
    const db = new DatabaseHelper(request.server.db);
    const errors = requestErrors(request);
    const { winner_id, loser_id, winner_score, loser_score } = request.body;

    const playersExist = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM users WHERE id IN (?, ?)`,
      [winner_id, loser_id]
    );
    if (!playersExist || playersExist.count < 2) {
      throw errors.notFound("One or both players do not exist", {
        winner_id,
        loser_id,
        foundCount: playersExist?.count || 0,
      });
    }

    const winner_name = await db.get<User>(`SELECT username FROM users WHERE id = ?`, [winner_id]);
    const loser_name = await db.get<User>(`SELECT username FROM users WHERE id = ?`, [loser_id]);

    const result = await db.run(
      `INSERT INTO matches (winner_id, loser_id, winner_name, loser_name, winner_score, loser_score) VALUES (?, ?, ?, ?, ?, ?)`,
      [winner_id, loser_id, winner_name?.username, loser_name?.username, winner_score, loser_score]
    );

    const match: Match = {
      id: result.lastID!,
      winner_id,
      loser_id,
      winner_name,
      loser_name,
      winner_score,
      loser_score,
      played_at: new Date().toISOString(),
    };

    reply.status(201);
    return ApiResponseHelper.success(match, "Match created successfully");
  },

  getMatches: async (
    request: FastifyRequest<{ Params: GetMatchesQuery }>,
    _reply: FastifyReply
  ): Promise<ApiResponse<Match[]>> => {
    const db = new DatabaseHelper(request.server.db);
    const errors = requestErrors(request);
    const userId = parseInt(request.params.userId, 10);

    if (isNaN(userId) || userId <= 0) {
      throw errors.validation("Invalid user ID - must be a positive integer");
    }

    // First check if the user exists
    const user = await db.get<User>(`SELECT * FROM users WHERE id = ?`, [userId]);
    if (!user) {
      throw errors.notFound("User", { userId });
    }

    // Then get their matches
    const matches = await db.all<Match>(
      `SELECT id, winner_id, loser_id, winner_score, loser_score, played_at 
				 FROM matches WHERE winner_id = ? OR loser_id = ? ORDER BY played_at DESC`,
      [userId, userId]
    );
    return ApiResponseHelper.success(matches, "Matches retrieved successfully");
  },
};
