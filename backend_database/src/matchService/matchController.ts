import { ApiResponseHelper } from "../utils/responseUtils.ts";
import { errors } from "../utils/errorUtils.ts";
import "../types/fastifyTypes.ts";
import { createHandler } from "../utils/handlerUtils.ts";
import {
	  Match,
	  CreateMatchBody,
	  GetMatchResponse,
	  GetMatchesResponse,
	  CreateMatchResponse,
	  GetMatchesQuery,
} from "../types/matchTypes.ts";
import { MatchSchemaValidator } from "./matchSchemas.ts";

export const matchController = {
	  createMatch: createHandler<{ Body: CreateMatchBody }, CreateMatchResponse>(
		async (request, { db }) => {
		  const valid = MatchSchemaValidator.validateCreateMatch(request.body);
		  if (!valid) throw errors.validation("Invalid request body");
		  const { winner, loser, winner_score, loser_score } = request.body;
		  try {
			const playersExist = await db.get(
			  `SELECT COUNT(*) as count FROM users WHERE username IN (?, ?)`,
			  [winner, loser]
			);
			if (playersExist.count < 2) {
			  throw errors.notFound("One or both players do not exist");
			}
		  } catch (err: any) {
			throw err;
		  }	
		  try {
			const result = await db.run(
			  `INSERT INTO matches (winner, loser, winner_score, loser_score) VALUES (?, ?, ?, ?)`,
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
			return ApiResponseHelper.success<Match>(match, "Match created successfully");
		  } catch (err: any) {
			throw err;
		  }
		}
	  ),

	  getMatches: createHandler<{ Params: GetMatchesQuery }, GetMatchesResponse>(
		async (request, { db }) => {
			const valid = MatchSchemaValidator.validateMatchQuery(request.params);
			if (!valid) throw errors.validation("Invalid query parameters");
			const {username} = request.params;
			try {
				const matches = await db.all(
					`SELECT * FROM matches WHERE winner = ? OR loser = ? ORDER BY played_at DESC`,
					[username, username]
				);
				if (!matches) {
					throw errors.notFound("No matches found for the specified player");
				}
				return ApiResponseHelper.success<Match[]>(matches, "Match retrieved successfully");
			} catch (err: any) {
				throw err;
			}
		}),
};