import Ajv from 'ajv';
// plugin that speaks for itself
import addFormats from "ajv-formats";

const ajv = new Ajv({coerceTypes: true, allErrors: true}); // options can be passed, e.g. to allow coercion of types
addFormats(ajv);

// Just need to specify what is expected from a schema,
// then compile a validator for that schema into a function
// which takes the schema you want to compare as a parameter
const CreateUserSchema = {
	type: "object",
	properties: {
		username: {type: "string", minLength: 3, maxLength: 15},
		email: {type: "string", format: "email"},
		password: {type: "string", minLength: 8, maxLength: 20},
		confirmPassword: {type: "string", minLength: 8}
	},
	required: ["username", "email", "password", "confirmPassword"], // all properties required
	additionalProperties: false
}

const UpdateUserSchema = {
	type: "object",
	properties: {
		username: {type: "string", minLength: 3},
		email: {type: "string", format: "email"},
		password: {type: "string", minLength: 8, maxLength: 15 }
	},
	required: [], //all properties optional
	additionalProperties: false
}

const UserLoginSchema = {
	type: "object",
	properties: {
		email: {type: "string", format: "email"},
		password: {type: "string", minLength: 8}
	},
	required: ["email", "password"], // all properties required
	additionalProperties: false
}

// each schema needs to be compiled once
export const AuthSchemaValidator = {
	validateCreateUser:
		ajv.compile(CreateUserSchema),
	validateUpdateUser:
		ajv.compile(UpdateUserSchema),
	validateUserLogin:
		ajv.compile(UserLoginSchema)
}
