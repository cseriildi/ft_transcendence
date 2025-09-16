import { FastifyRequest, FastifyReply } from "fastify";
import { DatabaseHelper } from  "./databaseHelper";

type HandlerContext = {
  db: DatabaseHelper;
  reply: FastifyReply;
};

export function createHandler<TRequest = {}, TResponse = any>(
  handler: (request: FastifyRequest<TRequest>, context: HandlerContext) => Promise<TResponse>
) {
  return async (request: FastifyRequest<TRequest>, reply: FastifyReply): Promise<TResponse> => {
    const db = new DatabaseHelper(request.server.db);
    return handler(request, { db, reply });
  };
}