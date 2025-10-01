import { FastifyInstance, FastifyReply } from "fastify";
import "../../types/fastifyTypes.ts";
import { oauthController } from "./oAuthController.ts";

export async function oauthRoutes(fastify: FastifyInstance) {
  // Initiate OAuth flow
  fastify.get<{ Params: { provider: string } }>(
    '/auth/:provider',
    oauthController.initiateAuth
  );
  
  // Handle OAuth callback
  fastify.get<{ 
    Params: { provider: string };
    Querystring: { code: string; state: string };
  }>(
    '/auth/:provider/callback',
    oauthController.handleCallback
  );
}

export default oauthRoutes;
