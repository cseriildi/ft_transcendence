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
				winner: { type: "string", minLength: 3 },
				loser: { type: "string", minLength: 3 },
				winner_score: { type: "number", minimum: 0 },
				loser_score: { type: "number", minimum: 0 }
			},
			required: ["winner", "loser", "winner_score", "loser_score"],
			additionalProperties: false
		},
		response: createResponseSchema(201, commonDataSchemas.match, [400, 404])
	},

	// GET /matches/:username - Get user matches
	getUserMatches: {
		params: {
			type: "object" as const,
			properties: {
				username: { type: "string", minLength: 3 }
			},
			required: ["username"],
			additionalProperties: false
		},
		response: createResponseSchema(200, commonDataSchemas.matchArray, [404])
	}
};