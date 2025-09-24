import {Ajv} from 'ajv';
// plugin that speaks for itself
import addFormats from "ajv-formats";


const ajv = new Ajv({coerceTypes: true, allErrors: true}); // options can be passed, e.g. to allow coercion of types
addFormats(ajv);
// Just need to specify what is expected from a schema,
// then compile a validator for that schema into a function
// which takes the schema you want to compare as a parameter

const UserParamSchema = {
	type: "object",
	properties: {
		id: {type: "number", minimum: 1},
	},
	required: ["id"],
	additionalProperties: false
}

// each schema needs to be compiled once
export const UserSchemaValidator = {
	validateUserParams:
		ajv.compile(UserParamSchema),
}
