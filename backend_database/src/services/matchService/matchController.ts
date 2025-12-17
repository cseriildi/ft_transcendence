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

    const result = await db.run(
      `INSERT INTO matches (winner_id, loser_id, winner_score, loser_score) VALUES (?, ?, ?, ?)`,
      [winner_id, loser_id, winner_score, loser_score]
    );

    const match = await db.get<Match>(
      `SELECT 
        m.id, 
        m.winner_id, 
        m.loser_id, 
        m.winner_score, 
        m.loser_score, 
        m.played_at,
        u1.username as winner_name,
        u2.username as loser_name
      FROM matches m
      JOIN users u1 ON m.winner_id = u1.id
      JOIN users u2 ON m.loser_id = u2.id
      WHERE m.id = ?`,
      [result.lastID!]
    );

    if (!match) {
      throw errors.internal("Failed to retrieve created match");
    }

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

    const user = await db.get<User>(`SELECT * FROM users WHERE id = ?`, [userId]);
    if (!user) {
      throw errors.notFound("User", { userId });
    }

    const matches = await db.all<Match>(
      `SELECT 
        m.id, 
        m.winner_id, 
        m.loser_id, 
        m.winner_score, 
        m.loser_score, 
        m.played_at,
        u1.username as winner_name,
        u2.username as loser_name
      FROM matches m
      JOIN users u1 ON m.winner_id = u1.id
      JOIN users u2 ON m.loser_id = u2.id
      WHERE m.winner_id = ? OR m.loser_id = ? 
      ORDER BY m.played_at DESC`,
      [userId, userId]
    );
    return ApiResponseHelper.success(matches, "Matches retrieved successfully");
  },
};
