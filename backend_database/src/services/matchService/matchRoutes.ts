import { FastifyInstance } from "fastify";
import "../../types/fastifyTypes.ts";
import {
	  CreateMatchBody,
	  GetMatchResponse,
	  GetMatchesResponse,
	  GetMatchesQuery
} from "./matchTypes.ts";
import { matchController } from "./matchController.ts";
import { MatchSchemas } from "./matchSchemas.ts";

async function matchRoutes(fastify: FastifyInstance) {
	// POST /matches - Create a new match
	fastify.post<{ Body: CreateMatchBody; Reply: GetMatchResponse }>(
		"/matches",
		{
			schema: {
				tags: ["matches"],
				description: "Create a new match between two players",
				...MatchSchemas.createMatch
			}
		},
		matchController.createMatch
	);
	
	// GET /matches/:username - Get user's matches
	fastify.get<{ Params: GetMatchesQuery; Reply: GetMatchesResponse }>(
		"/matches/:username",
		{
			schema: {
				tags: ["matches"],
				description: "Get all matches for a specific user",
				...MatchSchemas.getUserMatches
			}
		},
		matchController.getMatches
	);
}

export default matchRoutes;