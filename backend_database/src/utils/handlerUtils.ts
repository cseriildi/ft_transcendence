import { FastifyRequest, FastifyReply, RouteGenericInterface } from "fastify";
import { DatabaseHelper } from "./databaseUtils.ts";

type HandlerContext = {
  db: DatabaseHelper;
  reply: FastifyReply;
};

export function createHandler<
  TRequest extends RouteGenericInterface = RouteGenericInterface,
  TResponse = any,
>(handler: (request: FastifyRequest<TRequest>, context: HandlerContext) => Promise<TResponse>) {
  return async (request: FastifyRequest<TRequest>, reply: FastifyReply): Promise<TResponse> => {
    const db = new DatabaseHelper(request.server.db);
    return handler(request, { db, reply });
  };
}
