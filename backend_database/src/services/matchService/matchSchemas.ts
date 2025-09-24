import Ajv from 'ajv';
import addFormats from "ajv-formats";

const ajv = new Ajv({coerceTypes: true, allErrors: true});
addFormats(ajv);

const CreateMatchSchema = {
	type: "object",
	properties: {
		winner: {type: "string", minLength: 3},
		loser: {type: "string", minLength: 3},
		winner_score: {type: "number", maximum: 12},
		loser_score: {type: "number", minimum: 0}
	},
	required: ["winner", "loser", "winner_score", "loser_score"],
	additionalProperties: false
};

const MatchQuerySchema = {
	type: "object",
	properties: {
		username: {type: "string", minLength: 3},
	},
	required: ["username"],
	additionalProperties: false
};

export const MatchSchemaValidator = {
	validateCreateMatch:
		ajv.compile(CreateMatchSchema),
	validateMatchQuery:
		ajv.compile(MatchQuerySchema)
};