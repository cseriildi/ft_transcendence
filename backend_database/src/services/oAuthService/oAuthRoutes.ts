import { FastifyInstance } from "fastify";
import "../../types/fastifyTypes.ts";
import { oauthController } from "./oAuthController.ts";

async function oauthRoutes(fastify: FastifyInstance) {
  // Initiate GitHub OAuth flow
  fastify.get("/oauth/github", oauthController.initiateGitHub);

  // Handle GitHub OAuth callback
  fastify.get<{ Querystring: { code: string; state: string } }>(
    "/oauth/github/callback",
    oauthController.handleGitHubCallback
  );
}

export default oauthRoutes;
