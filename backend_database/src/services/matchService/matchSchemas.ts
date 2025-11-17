/**
 * Fastify JSON Schemas for Match routes
 * These provide both validation AND Swagger documentation
 */

import { createResponseSchema, commonDataSchemas } from "../../utils/schemaUtils.ts";

export const MatchSchemas = {
  // POST /matches - Create match
  createMatch: {
    body: {
      type: "object" as const,
      properties: {
        winner_Id: { type: "number", minimum: 1 },
        loser_Id: { type: "number", minimum: 1 },
        winner_score: { type: "number", minimum: 0 },
        loser_score: { type: "number", minimum: 0 },
      },
      required: ["winner_Id", "loser_Id", "winner_score", "loser_score"],
      additionalProperties: false,
    },
    response: createResponseSchema(201, commonDataSchemas.match, [400, 404]),
  },

  // GET /matches/:userId - Get user matches
  getUserMatches: {
    params: {
      type: "object" as const,
      properties: {
        userId: { type: "string", pattern: "^[0-9]+$" },
      },
      required: ["userId"],
      additionalProperties: false,
    },
    response: createResponseSchema(200, commonDataSchemas.matchArray, [404]),
  },
};
