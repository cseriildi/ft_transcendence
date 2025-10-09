import { FastifyInstance, FastifyReply } from "fastify";
import "../../types/fastifyTypes.ts";
import { authController } from "./authController.ts";
import { requireAuth } from "../../utils/authUtils.ts";
import {
  CreateUserBody,
  CreateUserResponse,
  UserErrorResponse,
  UserLoginBody,
  UserLoginResponse,
} from "./authTypes.ts";

async function authRoutes(fastify: FastifyInstance) {
  fastify.post<{
    Body: CreateUserBody;
    Reply: CreateUserResponse | UserErrorResponse;
  }>("/register", authController.createUser);

  fastify.post<{
    Body: UserLoginBody;
    Reply: UserLoginResponse | UserErrorResponse;
  }>("/login", authController.loginUser);

  fastify.post<{
    Reply: UserLoginResponse | UserErrorResponse;
  }>("/refresh", authController.refresh);

  fastify.get<{
    Reply: {verified : boolean};
  }>("/verify",
    { preHandler: requireAuth }
    , authController.verifyToken);

  fastify.post("/logout", authController.logout);
}

export default authRoutes;
