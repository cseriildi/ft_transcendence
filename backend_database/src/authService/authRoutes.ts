// src/routes/users.ts
import { FastifyInstance, FastifyReply } from "fastify";
import {
  CreateUserBody,
  CreateUserResponse,
  UserErrorResponse,
  UserLoginBody,
  UserLoginResponse,
} from "./authTypes.ts";
import "../types/fastifyTypes.ts";
import { authController } from "./authController.ts";

async function authRoutes(fastify: FastifyInstance) {
  fastify.post<{
    Body: CreateUserBody;
    Reply: CreateUserResponse | UserErrorResponse;
  }>("/register", authController.createUser);

  fastify.post<{
    Body: UserLoginBody;
    Reply: UserLoginResponse | UserErrorResponse;
  }>("/login", authController.loginUser);
}

export default authRoutes;
