import { FastifyInstance } from "fastify";
import "../../types/fastifyTypes.ts";
import { oauthController } from "./oAuthController.ts";

async function oauthRoutes(fastify: FastifyInstance) {
  // Initiate GitHub OAuth flow
  fastify.get("/github", {
    schema: {
      tags: ["oauth"],
      description: "Initiate GitHub OAuth authentication flow",
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                redirectUrl: { type: "string", format: "uri" }
              }
            },
            message: { type: "string" },
            timestamp: { type: "string" }
          }
        },
        500: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            timestamp: { type: "string" }
          }
        }
      }
    }
  }, oauthController.initiateGitHub);

  // Handle GitHub OAuth callback
  fastify.get<{ Querystring: { code: string; state: string } }>(
    "/github/callback",
    {
      schema: {
        tags: ["oauth"],
        description: "Handle GitHub OAuth callback and create/login user",
        querystring: {
          type: "object",
          properties: {
            code: { type: "string", description: "Authorization code from GitHub" },
            state: { type: "string", description: "CSRF protection state" }
          },
          required: ["code", "state"]
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  id: { type: "number" },
                  username: { type: "string" },
                  email: { type: "string" },
                  created_at: { type: "string" },
                  tokens: {
                    type: "object",
                    properties: {
                      accessToken: { type: "string" },
                      refreshToken: { type: "string" }
                    }
                  }
                }
              },
              message: { type: "string" },
              timestamp: { type: "string" }
            }
          },
          400: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              timestamp: { type: "string" }
            }
          },
          401: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              timestamp: { type: "string" }
            }
          }
        }
      }
    },
    oauthController.handleGitHubCallback
  );
}

export default oauthRoutes;
