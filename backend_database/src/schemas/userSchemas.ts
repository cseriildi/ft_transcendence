import {Ajv} from 'ajv';
// plugin that speaks for itself
import addFormats from "ajv-formats";

const ajv = new Ajv();
addFormats(ajv);
// Just need to specify what is expected from a schema,
// then compile a validator for that schema into a function
// which takes the schema you want to compare as a parameter
const CreateUserSchema = {
	type: "object",
	properties: {
		username: {type: "string", minLength: 3},
		email: {type: "string", format: "email"}
	},
	required: ["username", "email"], //some properties might be optional
	additionalProperties: false
}

const UpdateUserSchema = {
	type: "object",
	properties: {
		username: {type: "string", minLength: 3},
		email: {type: "string", format: "email"}
	},
	additionalProperties: false
}

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
	validateCreateUser:
		ajv.compile(CreateUserSchema),
	validateUpdateUser:
		ajv.compile(UpdateUserSchema),
	validateUserParams:
		ajv.compile(UserParamSchema)
}
