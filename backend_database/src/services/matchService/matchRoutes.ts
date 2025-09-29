import { FastifyInstance } from "fastify";
import "../../types/fastifyTypes.ts";
import {
	  CreateMatchBody,
	  GetMatchResponse,
	  GetMatchesResponse,
	  MatchErrorResponse,
	  GetMatchesQuery
} from "./matchTypes.ts";
import { matchController } from "./matchController.ts";

async function matchRoutes(fastify: FastifyInstance) {
	// Create a new match
	fastify.post<{ Body: CreateMatchBody; Reply: GetMatchResponse | MatchErrorResponse }>(
		"/matches", matchController.createMatch);
	
	fastify.get<{ Params: GetMatchesQuery; Reply: GetMatchesResponse | MatchErrorResponse }>(
		"/matches/:username", matchController.getMatches);
}

export default matchRoutes;