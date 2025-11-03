import { FastifyInstance } from "fastify";
import "../../types/fastifyTypes.ts";
import { CreateMatchBody, Match, GetMatchesQuery } from "./matchTypes.ts";
import { ApiResponse } from "../../types/commonTypes.ts";
import { matchController } from "./matchController.ts";
import { MatchSchemas } from "./matchSchemas.ts";

async function matchRoutes(fastify: FastifyInstance) {
  // POST /matches - Create a new match
  fastify.post<{ Body: CreateMatchBody; Reply: ApiResponse<Match> }>(
    "/matches",
    {
      schema: {
        tags: ["matches"],
        description: "Create a new match between two players",
        ...MatchSchemas.createMatch,
      },
    },
    matchController.createMatch
  );

  // GET /matches/:username - Get user's matches
  fastify.get<{ Params: GetMatchesQuery; Reply: ApiResponse<Match[]> }>(
    "/matches/:username",
    {
      schema: {
        tags: ["matches"],
        description: "Get all matches for a specific user",
        ...MatchSchemas.getUserMatches,
      },
    },
    matchController.getMatches
  );
}

export default matchRoutes;
