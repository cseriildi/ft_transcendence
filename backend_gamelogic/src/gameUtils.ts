import { Paddle, Ball, Field, GameServer } from "./gameTypes";


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
    y: capsule.y1 + aby * t
  };
}

export function collideBallCapsule(paddle: Paddle, ball: Ball): boolean {
  // Early distance check - if ball is too far, skip expensive calculations
  const roughDistance = Math.abs(ball.x - paddle.cx) + Math.abs(ball.y - paddle.cy);
  const maxPossibleDistance = ball.radius + paddle.width + paddle.length;
  if (roughDistance > maxPossibleDistance) return false;

  const capsule = paddle.getCapsule();
  const {x1, y1, x2, y2, R} = capsule;
  const {x, y, radius} = ball;

  // Closest point on segment to ball
  const S = closestPointOnSegment(paddle, ball);

  let nx = x - S.x;
  let ny = y - S.y;
  let dist = Math.hypot(nx, ny);
  const sumR = R + radius;

  if (dist > sumR) return false;

  // Normalize normal
  if (dist === 0) {
    nx = 1; ny = 0; dist = 1; // fallback
  } else {
    nx /= dist; ny /= dist;
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
  }

  return true;
}

export function collideBallWithWalls(ball: Ball, field: Field) {
  if (ball.x - ball.radius < 0 || ball.x + ball.radius > field.width) {
    ball.x = Math.max(ball.radius, Math.min(ball.x, field.width - ball.radius));
    ball.speedX *= -1;
  }
  if (ball.y - ball.radius < 0 || ball.y + ball.radius > field.height) {
    ball.y = Math.max(ball.radius, Math.min(ball.y, field.height - ball.radius));
    ball.speedY *= -1;
  }
}

export function updateGameState(game: GameServer) {
  // Update ball position
  game.Ball.x += game.Ball.speedX;
  game.Ball.y += game.Ball.speedY;

  // Check wall collisions
  collideBallWithWalls(game.Ball, game.Field);

  // Check paddle collisions
  collideBallCapsule(game.Paddle1, game.Ball);
  collideBallCapsule(game.Paddle2, game.Ball);
  
  // Update paddle positions (apply ySpeed)
  game.Paddle1.cy += game.Paddle1.ySpeed;
  game.Paddle2.cy += game.Paddle2.ySpeed;

  // Keep paddles within bounds
  const paddleHalfLength1 = game.Paddle1.length / 2;
  const paddleHalfLength2 = game.Paddle2.length / 2;
  game.Paddle1.cy = Math.max(paddleHalfLength1, Math.min(game.Paddle1.cy, game.Field.height - paddleHalfLength1));
  game.Paddle2.cy = Math.max(paddleHalfLength2, Math.min(game.Paddle2.cy, game.Field.height - paddleHalfLength2));
}

