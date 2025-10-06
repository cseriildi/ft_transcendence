// src/routes/users.ts
import { FastifyInstance, FastifyReply } from "fastify";
import {
  UserParams,
  GetUserResponse,
  GetUsersResponse,
  UserErrorResponse,
} from "./userTypes.ts";
import "../../types/fastifyTypes.ts";
import { userController } from "./userController.ts";
import { requireAuth } from "../../utils/authUtils.ts";


async function userRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Params: UserParams;
    Reply: GetUserResponse | UserErrorResponse;
  }>("/users/:id",
      { preHandler: requireAuth },
       userController.getUserById);

  fastify.get<{
    Reply: GetUsersResponse | UserErrorResponse;
  }>("/users", userController.getUsers);
}

export default userRoutes;
