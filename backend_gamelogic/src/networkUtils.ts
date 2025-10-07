import { GameServer } from "./gameTypes";


export function broadcastGameState(game : GameServer) {
  const paddle1Capsule = game.Paddle1.getCapsule();
  const paddle2Capsule = game.Paddle2.getCapsule();

  const gameState = {
    field: {
      width: game.Field.width,
      height: game.Field.height
    },
    ball: {
      x: game.Ball.x,
      y: game.Ball.y,
      radius: game.Ball.radius,
      speedX: game.Ball.speedX,
      speedY: game.Ball.speedY
    },
    paddle1: {
      cx: game.Paddle1.cx,
      cy: game.Paddle1.cy,
      length: game.Paddle1.length,
      width: game.Paddle1.width,
      radius: paddle1Capsule.R,
      capsule: paddle1Capsule
    },
    paddle2: {
      cx: game.Paddle2.cx,
      cy: game.Paddle2.cy,
      length: game.Paddle2.length,
      width: game.Paddle2.width,
      radius: paddle2Capsule.R,
      capsule: paddle2Capsule
    }
  };

  const message = JSON.stringify({
    type: 'gameState',
    data: gameState
  });

  // Send to all connected clients
  for (const client of game.clients) {
    try {
      client.send(message);
    } catch (err) {
      // Remove client if sending fails
      game.clients.delete(client);
    }
  }
}