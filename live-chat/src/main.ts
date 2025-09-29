'use strict'
import Fastify, { FastifyReply, FastifyRequest } from 'fastify'
import path from 'path'

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fastify = Fastify()

fastify.register(import('@fastify/websocket'), {
  options: { maxPayload: 1048576 }
});

fastify.register(import('@fastify/static'), {
  root: path.join(__dirname, 'www')
})

fastify.addHook('preValidation', async (request: FastifyRequest, reply: FastifyReply) => {
  if (request.routerPath == '/chat' && !request.query.username) {
    reply.status(403).send({ error: 'Connection rejected'});
  }
})

fastify.get('/chat', { websocket: true }, (connection, req) => {
    // New user
    broadcast({
        sender: '__server',
        message: `${req.query.username} joined`
    });
    // Leaving user
    connection.socket.on('close', () => {
        broadcast({
            sender: '__server',
            message: `${req.query.username} left`
        });
    });
   // Broadcast incoming message
    connection.socket.on('message', (message) => {
        message = JSON.parse(message.toString());
        broadcast({
            sender: req.query.username,
            ...message
        });
    });
});

fastify.listen({ port: 3000 }, (err, address) => {
    if(err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Server listening at: ${address}`);
});

function broadcast(message) {
    for(let client of fastify.websocketServer.clients) {
        client.send(JSON.stringify(message));
    }
}