import { FastifyInstance } from "fastify";
import { userController } from "./userController.ts";
import { requireAuth } from "../../utils/authUtils.ts";
import { UserSchemas } from "./userSchemas.ts";
import { UserParams, GetUserResponse, GetUsersResponse, uploadAvatar, uploadAvatarResponse } from "./userTypes.ts";

async function userRoutes(fastify: FastifyInstance) {
  // GET /users/:id - Get single user (protected)
  fastify.get<{ Params: UserParams; Reply: GetUserResponse }>(
    "/users/:id",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["users"],
        description: "Get user by ID (requires authentication)",
        security: [{ bearerAuth: [] }],
        ...UserSchemas.getUser
      }
    },
    userController.getUserById
  );

  // GET /users - Get all users
  fastify.get<{ Reply: GetUsersResponse }>(
    "/users",
    {
      schema: {
        tags: ["users"],
        description: "Get all users",
        ...UserSchemas.getUsers
      }
    },
    userController.getUsers
  );

  // POST /users/avatar - Upload avatar (protected)
  fastify.post<{ Reply: uploadAvatarResponse }>(
    "/users/avatar",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["users"],
        description: "Upload avatar image (requires authentication, multipart/form-data)",
        security: [{ bearerAuth: [] }],
        consumes: ["multipart/form-data"],
        ...UserSchemas.uploadAvatar
      }
    },
    userController.uploadAvatar
  );

  fastify.get('/users/avatar/:filename', userController.serveAvatar);
}

export default userRoutes;