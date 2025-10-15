/**
 * Fastify JSON Schemas for Match routes
 * These provide both validation AND Swagger documentation
 */

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
		response: {
			201: {
				type: "object",
				properties: {
					success: { type: "boolean" },
					data: {
						type: "object",
						properties: {
							id: { type: "number" },
							winner: { type: "string" },
							loser: { type: "string" },
							winner_score: { type: "number" },
							loser_score: { type: "number" },
							played_at: { type: "string" }
						}
					},
					message: { type: "string" },
					timestamp: { type: "string" }
				}
			},
			400: {
				type: "object",
				properties: {
					success: { type: "boolean" },
					message: { type: "string" },
					timestamp: { type: "string" }
				}
			},
			404: {
				type: "object",
				properties: {
					success: { type: "boolean" },
					message: { type: "string" },
					timestamp: { type: "string" }
				}
			}
		}
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
		response: {
			200: {
				type: "object",
				properties: {
					success: { type: "boolean" },
					data: {
						type: "array",
						items: {
							type: "object",
							properties: {
								id: { type: "number" },
								winner: { type: "string" },
								loser: { type: "string" },
								winner_score: { type: "number" },
								loser_score: { type: "number" },
								played_at: { type: "string" }
							}
						}
					},
					message: { type: "string" },
					timestamp: { type: "string" }
				}
			},
			404: {
				type: "object",
				properties: {
					success: { type: "boolean" },
					message: { type: "string" },
					timestamp: { type: "string" }
				}
			}
		}
	}
};