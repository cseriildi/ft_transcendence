import { Paddle, Ball, GameServer } from "./gameTypes.js";
import { config } from "./config.js";
import { broadcastGameState } from "./networkUtils.js";
import { updateDummyPaddle } from "./opponent/opponent.js";

// Factory function to create
export function createGame(): GameServer {
  const game = new GameServer();

  // Set up callbacks
  game.setUpdateCallback(updateGameState);
  game.setRenderCallback(broadcastGameState);

  return game;
}

export function closestPointOnSegment(paddle: Paddle, ball: Ball) {
  const capsule = paddle.getCapsule();
  // Vector from (x1, y1) to (x2, y2)
  const abx = capsule.x2 - capsule.x1;
  const aby = capsule.y2 - capsule.y1;
  // Vector from (x1, y1) to ball
  const apx = ball.x - capsule.x1;
  const apy = ball.y - capsule.y1;
  const abLen2 = abx * abx + aby * aby;
  let t = abLen2 > 0 ? (apx * abx + apy * aby) / abLen2 : 0;
  t = Math.max(0, Math.min(1, t));
  return {
    x: capsule.x1 + abx * t,
    y: capsule.y1 + aby * t,
  };
}

export function collideBallCapsule(paddle: Paddle, ball: Ball): boolean {
  // Early distance check - if ball is too far, skip expensive calculations
  const roughDistance = Math.abs(ball.x - paddle.cx) + Math.abs(ball.y - paddle.cy);
  const maxPossibleDistance = ball.radius + paddle.width + paddle.length;
  if (roughDistance > maxPossibleDistance) return false;

  const capsule = paddle.getCapsule();
  const { x1, y1, x2, y2, R } = capsule;
  const { x, y, radius } = ball;

  // Closest point on segment to ball
  const S = closestPointOnSegment(paddle, ball);

  let nx = x - S.x;
  let ny = y - S.y;
  let dist = Math.hypot(nx, ny);
  const sumR = R + radius;

  if (dist > sumR) return false;

  // Normalize normal
  if (dist === 0) {
    nx = 1;
    ny = 0;
    dist = 1; // fallback
  } else {
    nx /= dist;
    ny /= dist;
  }

  // Push ball outside
  const penetration = sumR - dist;
  ball.x += nx * penetration;
  ball.y += ny * penetration;

  // Reflect velocity
  const dot = ball.speedX * nx + ball.speedY * ny;
  if (dot < 0) {
    ball.speedX -= 2 * dot * nx;
    ball.speedY -= 2 * dot * ny;

    // Restore ball to full speed if it was slowed down after reset
    const currentSpeed = Math.hypot(ball.speedX, ball.speedY);
    const normalSpeed = config.game.ballSpeed;

    if (currentSpeed < normalSpeed * 0.9) {
      // If speed is significantly lower than normal
      const speedMultiplier = normalSpeed / currentSpeed;
      ball.speedX *= speedMultiplier;
      ball.speedY *= speedMultiplier;
    }

    // Limit deflection angle to maximum 45 degrees
    const speed = Math.hypot(ball.speedX, ball.speedY);
    const angle = Math.atan2(ball.speedY, ball.speedX);
    const maxAngle = Math.PI / 4; // 45 degrees in radians

    // Clamp the angle to [-45°, +45°]
    let clampedAngle = angle;
    if (Math.abs(angle) > maxAngle) {
      clampedAngle = Math.sign(angle) * maxAngle;
    }

    // Ensure ball continues in the correct horizontal direction
    // If it was moving right, keep it moving right; if left, keep it moving left
    const movingRight = ball.speedX > 0;
    if (!movingRight && clampedAngle > 0) {
      clampedAngle = Math.PI - clampedAngle;
    } else if (!movingRight && clampedAngle < 0) {
      clampedAngle = -Math.PI - clampedAngle;
    }

    // Apply the clamped angle
    ball.speedX = Math.cos(clampedAngle) * speed;
    ball.speedY = Math.sin(clampedAngle) * speed;
  }

  return true;
}

export function resetBall(game: GameServer) {
  game.Ball.x = game.Field.width / 2;
  game.Ball.y = game.Field.height / 2;
  const angle = ((Math.random() - 0.5) * Math.PI) / 2; // -45 to +45 degrees
  const speed = config.game.ballSpeed * 0.5; // Start at half speed
  game.Ball.speedX = Math.cos(angle) * speed * (Math.random() < 0.5 ? 1 : -1); // randomize left/right
  game.Ball.speedY = Math.sin(angle) * speed;
}

export function collideBallWithWalls(game: GameServer) {
  const { Ball: ball, Field: field } = game;
  if (ball.x - ball.radius < 0) {
    game.score2 += 1;
    resetBall(game);
  } else if (ball.x + ball.radius > field.width) {
    game.score1 += 1;
    resetBall(game);
  }
  if (ball.y - ball.radius < 0 || ball.y + ball.radius > field.height) {
    ball.y = Math.max(ball.radius, Math.min(ball.y, field.height - ball.radius));
    ball.speedY *= -1;
  }
}

export function updateGameState(game: GameServer) {
  if (game.aiEnabled && game.aiPlayer.aiPlayerNo) {
    updateDummyPaddle(game, game.aiPlayer.aiPlayerNo);
  }
  // Update ball position
  game.Ball.x += game.Ball.speedX;
  game.Ball.y += game.Ball.speedY;

  // Check wall collisions
  collideBallWithWalls(game);

  if (game.score1 >= game.maxScore || game.score2 >= game.maxScore) {
    // stop the game loops
    try {
      game.stop();
    } catch (err) {
      console.error("Error stopping game:", err);
    }
    return;
  }

  // Check paddle collisions
  collideBallCapsule(game.Paddle1, game.Ball);
  collideBallCapsule(game.Paddle2, game.Ball);

  // Update paddle positions (apply ySpeed)
  game.Paddle1.cy += game.Paddle1.ySpeed;
  game.Paddle2.cy += game.Paddle2.ySpeed;

  // Keep paddles within bounds
  const paddleHalfLength1 = game.Paddle1.length / 2;
  const paddleHalfLength2 = game.Paddle2.length / 2;
  game.Paddle1.cy = Math.max(
    paddleHalfLength1,
    Math.min(game.Paddle1.cy, game.Field.height - paddleHalfLength1)
  );
  game.Paddle2.cy = Math.max(
    paddleHalfLength2,
    Math.min(game.Paddle2.cy, game.Field.height - paddleHalfLength2)
  );
}
