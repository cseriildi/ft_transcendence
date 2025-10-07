export class Field {
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
}

export class Ball {
  x: number;
  y: number;
  radius: number;
  speedX: number;
  speedY: number;
  constructor(field: Field, radius: number, speed: number) {
    this.x = field.width / 2;
    this.y = field.height / 2;
    this.radius = radius;
    this.speedX = (Math.random() - 0.5) * speed;
    this.speedY = (Math.random() - 0.5) * speed;
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

  constructor(pos: number, field: Field, speed: number) {
    this.cy = field.height / 2;                 // center y
    this.length = field.height / 5;             // total length
    this.width = field.width / 50;                            // thickness of paddle
    this.cx = pos === 1 ? this.width * 2 : field.width - this.width * 2; // center x
    this.speed = speed;
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

export class GameServer {
  Field: Field;
  Ball: Ball;
  Paddle1: Paddle;
  Paddle2: Paddle;
  clients = new Set<any>();
  updateInterval: number;
  renderInterval: number;

  constructor(width: number, height: number, ballRadius: number, ballSpeed: number, paddleSpeed: number, updateInterval: number, renderInterval: number) {
    this.Field = new Field(width, height);
    this.Ball = new Ball(this.Field, ballRadius, ballSpeed);
    this.Paddle1 = new Paddle(1, this.Field, paddleSpeed);
    this.Paddle2 = new Paddle(2, this.Field, paddleSpeed);
    this.updateInterval = updateInterval;
    this.renderInterval = renderInterval;
  }
}