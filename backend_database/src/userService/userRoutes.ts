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
} from "./userTypes.ts";
import "../types/fastifyTypes.ts";
import { userController } from "./userController.ts";

async function userRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Params: UserParams;
    Reply: GetUserResponse | UserErrorResponse;
  }>("/users/:id", userController.getUserById);

  fastify.get<{
    Reply: GetUsersResponse | UserErrorResponse;
  }>("/users", userController.getUsers);
}

export default userRoutes;
