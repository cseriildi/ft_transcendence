import { ApiResponseHelper } from "../../utils/responseUtils.ts";
import { errors } from "../../utils/errorUtils.ts";
import "../../types/fastifyTypes.ts";
import { createHandler } from "../../utils/handlerUtils.ts";
import {
	  Match,
	  CreateMatchBody,
	  GetMatchResponse,
	  GetMatchesResponse,
	  CreateMatchResponse,
	  GetMatchesQuery,
} from "./matchTypes.ts";

export const matchController = {
	  createMatch: createHandler<{ Body: CreateMatchBody }, CreateMatchResponse>(
		async (request, { db, reply }) => {
		  // ✅ Validation now handled by Fastify schema
		  const { winner, loser, winner_score, loser_score } = request.body;
		  try {
			const playersExist = await db.get<{ count: number }>(
			  `SELECT COUNT(*) as count FROM users WHERE username IN (?, ?)`,
			  [winner, loser]
			);
			if (!playersExist || playersExist.count < 2)  {
			  throw errors.notFound("One or both players do not exist");
			}
		  } catch (err: any) {
			throw err;
		  }	
		  try {
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
			  played_at: new Date().toISOString()
			};
			reply.status(201);
			return ApiResponseHelper.success<Match>(match, "Match created successfully");
		  } catch (err: any) {
			throw err;
		  }
		}
	  ),

	  getMatches: createHandler<{ Params: GetMatchesQuery }, GetMatchesResponse>(
		async (request, { db }) => {
			// ✅ Validation now handled by Fastify schema
			const {username} = request.params;
			try {
				// First check if the user exists
				const userExists = await db.get<{ count: number }>(
					`SELECT COUNT(*) as count FROM users WHERE username = ?`,
					[username]
				);
				if (!userExists || userExists.count === 0) {
					throw errors.notFound("User not found");
				}

				// Then get their matches
				const matches = await db.all<Match>(
					`SELECT id, winner_name as winner, loser_name as loser, winner_score, loser_score, played_at 
					 FROM matches WHERE winner_name = ? OR loser_name = ? ORDER BY played_at DESC`,
					[username, username]
				);
				return ApiResponseHelper.success<Match[]>(matches, "Match retrieved successfully");
			} catch (err: any) {
				throw err;
			}
		}),
};