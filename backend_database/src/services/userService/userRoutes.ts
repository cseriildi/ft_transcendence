import { FastifyInstance } from "fastify";
import { userController } from "./userController.ts";
import { requireAuth } from "../../utils/authUtils.ts";
import { UserSchemas } from "./userSchemas.ts";
import { UserParams, GetUserResponse, GetUsersResponse, uploadAvatarResponse} from "./userTypes.ts";


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
        description: "Upload avatar image (requires authentication, multipart/form-data).\
          After upload, avatars are publicly accessible at /uploads/avatars/{filename}",
        security: [{ bearerAuth: [] }],
        consumes: ["multipart/form-data"],
        ...UserSchemas.uploadAvatar
      }
    },
    userController.uploadAvatar
  );

  // PATCH /users/:id/email - Change user email (protected)
  fastify.patch<{ Params: UserParams; Reply: GetUserResponse }>(
    "/users/:id/email",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["users"],
        description: "Change user email (requires authentication)",
        security: [{ bearerAuth: [] }],
        ...UserSchemas.changeEmail
      }
    },
    userController.changeEmail
  );

  // PATCH /users/:id/username - Change username (protected)
  fastify.patch<{ Params: UserParams; Reply: GetUserResponse }>(
    "/users/:id/username",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["users"],
        description: "Change username (requires authentication)",
        security: [{ bearerAuth: [] }],
        ...UserSchemas.changeUsername
      }
    },
    userController.changeUsername
  )
}

export default userRoutes;