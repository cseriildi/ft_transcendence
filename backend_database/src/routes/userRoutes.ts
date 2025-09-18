// src/routes/users.ts
import { FastifyInstance, FastifyReply } from "fastify";
import {
  CreateUserBody,
  UserParams,
  CreateUserResponse,
  GetUserResponse,
  GetUsersResponse,
  UserErrorResponse,
  UserLoginBody,
  UserLoginResponse,
} from "../types/userTypes.ts";
import "../types/fastifyTypes.ts";
import { userController } from "../controllers/userController.ts";

async function userRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Params: UserParams;
    Reply: GetUserResponse | UserErrorResponse;
  }>("/users/:id", userController.getUserById);

  fastify.get<{
    Reply: GetUsersResponse | UserErrorResponse;
  }>("/users", userController.getUsers);

  fastify.post<{
    Body: CreateUserBody;
    Reply: CreateUserResponse | UserErrorResponse;
  }>("/register", userController.createUser);

  fastify.post<{
    Body: UserLoginBody;
    Reply: UserLoginResponse | UserErrorResponse;
  }>("/login", userController.loginUser);
}

export default userRoutes;
