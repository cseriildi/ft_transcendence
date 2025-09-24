
export class Field {
  width: number;
  height: number;
  constructor() {
    this.width = 2000;
    this.height = 2000;
  }
}

export class Ball {
  x: number;
  y: number;
  radius: number;
  speedX: number;
  speedY: number;
  constructor(field: Field) {
    this.x = field.width / 2;
    this.y = field.height / 2;
    this.radius = 40;
    this.speedX = (Math.random() - 0.5) * 2 * 20;
    this.speedY = (Math.random() - 0.5) * 2 * 20;
  }
}

export class Paddle {
  cx: number;
  cy: number;
  length: number;
  width: number;
  speed: number;
  ySpeed: number;
  private _capsule: { x1: number; y1: number; x2: number; y2: number; R: number } | null = null;
  private _lastCy: number = -1;

  constructor(pos: number, field: Field) {
    this.cy = field.height / 2;                 // center y
    this.length = field.height / 5;             // total length
    this.width = 80;                            // thickness of paddle
    this.cx = pos === 1 ? this.width * 2 : field.width - this.width * 2; // center x
    this.speed = 20;
    this.ySpeed = 0;
  }

  getCapsule() {
    // Cache capsule if position hasn't changed
    if (this._capsule && this._lastCy === this.cy) {
      return this._capsule;
    }
    
    const halfLen = this.length / 2 - this.width / 2;
    this._capsule = {
      x1: this.cx,
      y1: this.cy - halfLen,
      x2: this.cx,
      y2: this.cy + halfLen,
      R: this.width / 2
    };
    this._lastCy = this.cy;
    
    return this._capsule;
  }
}

function closestPointOnSegment(paddle: Paddle, ball: Ball) {
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