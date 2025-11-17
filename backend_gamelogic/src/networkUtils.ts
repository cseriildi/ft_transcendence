import { GameServer } from "./gameTypes.js";

/**
 * Removes a client from the game when sending fails
 * Iterates through clients to find by connection reference
 */
function removeFailedClient(game: GameServer, failedConnection: any): void {
  for (const [playerNum, { connection }] of game.clients.entries()) {
    if (connection === failedConnection) {
      game.clients.delete(playerNum);
      break;
    }
  }
}

export function broadcastGameState(game: GameServer) {
  const gameState = {
    ball: {
      x: game.Ball.x,
      y: game.Ball.y,
      speedX: game.Ball.speedX,
      speedY: game.Ball.speedY,
    },
    paddle1: {
      cx: game.Paddle1.cx,
      cy: game.Paddle1.cy,
      speed: game.Paddle1.speed,
    },
    paddle2: {
      cx: game.Paddle2.cx,
      cy: game.Paddle2.cy,
      speed: game.Paddle2.speed,
    },
    score: {
      player1: game.score1,
      player2: game.score2,
    },
    countdown: game.countdown,
  };

  const message = JSON.stringify({
    type: "gameState",
    data: gameState,
  });

  // Send to all connected clients
  for (const { connection } of game.clients.values()) {
    try {
      connection.send(message);
    } catch (err) {
      removeFailedClient(game, connection);
    }
  }
}

export function broadcastGameSetup(game: GameServer) {
  const paddle1Capsule = game.Paddle1.getCapsule();
  const paddle2Capsule = game.Paddle2.getCapsule();

  const gameState = {
    field: {
      width: game.Field.width,
      height: game.Field.height,
    },
    ball: {
      x: game.Ball.x,
      y: game.Ball.y,
      radius: game.Ball.radius,
      speedX: game.Ball.speedX,
      speedY: game.Ball.speedY,
    },
    paddle1: {
      cx: game.Paddle1.cx,
      cy: game.Paddle1.cy,
      length: game.Paddle1.length,
      width: game.Paddle1.width,
      radius: paddle1Capsule.R,
      capsule: paddle1Capsule,
    },
    paddle2: {
      cx: game.Paddle2.cx,
      cy: game.Paddle2.cy,
      length: game.Paddle2.length,
      width: game.Paddle2.width,
      radius: paddle2Capsule.R,
      capsule: paddle2Capsule,
    },
    score: {
      player1: game.score1,
      player2: game.score2,
    },
    countdown: game.countdown,
  };

  // Get player usernames from game clients
  const player1Info = game.clients.get(1);
  const player2Info = game.clients.get(2);
  const player1Username = player1Info?.playerInfo?.username || "Player 1";
  const player2Username = player2Info?.playerInfo?.username || "Player 2";

  // Send to all connected clients - each gets told which player they are
  for (const [playerNum, { connection }] of game.clients.entries()) {
    if (!connection) continue; // Skip clients without connections (e.g., tournament AI)
    try {
      const message = JSON.stringify({
        type: "gameSetup",
        playerNumber: playerNum,
        data: gameState,
        player1Username,
        player2Username,
      });
      connection.send(message);
    } catch (err) {
      removeFailedClient(game, connection);
    }
  }
}

export function broadcastGameResult(game: GameServer) {
  broadcastGameSetup(game);

  const result = game.getResult();
  if (!result) {
    console.warn("Cannot broadcast game result: missing player info");
    return;
  }

  const { winner, loser, winnerScore, loserScore } = result;

  // Send to all connected clients
  for (const [playerNum, { connection }] of game.clients.entries()) {
    if (!connection) continue;
    try {
      const message = JSON.stringify({
        type: "gameResult",
        mode: game.gameMode,
        data: {
          winner: winner.username,
          loser: loser.username,
          winnerScore,
          loserScore,
        },
      });
      connection.send(message);
    } catch (err) {
      console.error("Failed to send game result to client:", err);
    }
  }
}
