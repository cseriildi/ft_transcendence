// src/routes/users.ts
import { FastifyInstance, FastifyReply } from 'fastify'
import { 
  CreateUserBody, 
  UserParams, 
  CreateUserResponse,
  GetUserResponse,
  GetUsersResponse,
  UserErrorResponse
} from '../types/users.ts'
import '../types/fastify.ts'
import { userController } from '../controllers/users.ts'

async function userRoutes(fastify: FastifyInstance, reply: FastifyReply) {
  fastify.get<{ 
    Params: UserParams
    Reply: GetUserResponse | UserErrorResponse 
  }>('/users/:id', userController.getUserById)

  fastify.get<{ 
    Reply: GetUsersResponse | UserErrorResponse 
  }>('/users', userController.getUsers)

  fastify.post<{ 
    Body: CreateUserBody
    Reply: CreateUserResponse | UserErrorResponse 
  }>('/users', userController.createUser)
}

export default userRoutes