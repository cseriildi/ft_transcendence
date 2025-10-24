import { FastifyInstance } from "fastify";
import "../../types/fastifyTypes.ts";
import { oauthController } from "./oAuthController.ts";
import { OAuthSchemas } from "./oAuthSchemas.ts";

async function oauthRoutes(fastify: FastifyInstance) {
  // Initiate GitHub OAuth flow
  fastify.get("/github", {
    schema: {
      tags: ["oauth"],
      description: "Initiate GitHub OAuth authentication flow",
      ...OAuthSchemas.initiate
    }
  }, oauthController.initiateGitHub);

  // Handle GitHub OAuth callback
  fastify.get<{ Querystring: { code: string; state: string } }>(
    "/github/callback",
    {
      schema: {
        tags: ["oauth"],
        description: "Handle GitHub OAuth callback and create/login user",
        ...OAuthSchemas.callback
      }
    },
    oauthController.handleGitHubCallback
  );
}

export default oauthRoutes;
