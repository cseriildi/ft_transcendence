import { ApiResponseHelper } from "../../utils/responseUtils.ts";
import { requestErrors } from "../../utils/errorUtils.ts";
import "../../types/fastifyTypes.ts";
import { createHandler } from "../../utils/handlerUtils.ts";
import { Match, CreateMatchBody, GetMatchesQuery } from "./matchTypes.ts";
import { User, ApiResponse } from "../../types/commonTypes.ts";

export const matchController = {
  createMatch: createHandler<{ Body: CreateMatchBody }, ApiResponse<Match>>(
    async (request, { db, reply }) => {
      const errors = requestErrors(request);
      const { winner, loser, winner_score, loser_score } = request.body;

      const playersExist = await db.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM users WHERE username IN (?, ?)`,
        [winner, loser]
      );
      if (!playersExist || playersExist.count < 2) {
        throw errors.notFound("One or both players do not exist", {
          winner,
          loser,
          foundCount: playersExist?.count || 0,
        });
      }

      const result = await db.run(
        `INSERT INTO matches (winner_name, loser_name, winner_score, loser_score) VALUES (?, ?, ?, ?)`,
        [winner, loser, winner_score, loser_score]
      );

      const match: Match = {
        id: result.lastID!,
        winner,
        loser,
        winner_score,
        loser_score,
        played_at: new Date().toISOString(),
      };

      reply.status(201);
      return ApiResponseHelper.success(match, "Match created successfully");
    }
  ),

  getMatches: createHandler<{ Params: GetMatchesQuery }, ApiResponse<Match[]>>(
    async (request, { db }) => {
      const errors = requestErrors(request);
      const { username } = request.params;

      // First check if the user exists
      const user = await db.get<User>(`SELECT * FROM users WHERE username = ?`, [username]);
      if (!user) {
        throw errors.notFound("User", { username });
      }

      // Then get their matches
      const matches = await db.all<Match>(
        `SELECT id, winner_name as winner, loser_name as loser, winner_score, loser_score, played_at 
				 FROM matches WHERE winner_name = ? OR loser_name = ? ORDER BY played_at DESC`,
        [username, username]
      );
      return ApiResponseHelper.success(matches, "Match retrieved successfully");
    }
  ),
};
