import { config, PHYSICS_INTERVAL, RENDER_INTERVAL } from "./config.js";

// Game mode types
export enum GameMode {
  LOCAL = "LOCAL", // Two players on same machine
  ONLINE = "ONLINE", // Two players on different machines
  VS_AI = "VS_AI", // Player vs AI
}

// Player information
export interface PlayerInfo {
  userId: number | string;
  username: string;
  avatar?: string;
}

export interface GameStartPayload {
  type: "startGame";
  mode: GameMode;
  player: PlayerInfo;
}

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
  radius: number = config.game.ballRadius;
  speedX: number;
  speedY: number;
  constructor(field: Field) {
    const angle = ((Math.random() - 0.5) * Math.PI) / 2;
    this.x = field.width / 2;
    this.y = field.height / 2;
    this.radius = config.game.ballRadius;
    this.speedX = Math.cos(angle) * config.game.ballSpeed * (Math.random() < 0.5 ? 1 : -1);
    this.speedY = Math.sin(angle) * config.game.ballSpeed;
  }
}

export class Paddle {
  cx: number;
  cy: number;
  length: number;
  width: number;
  speed: number;
  ySpeed: number;
  private _capsule: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    R: number;
  } | null = null;
  private _lastCy: number = -1;

  constructor(pos: number, field: Field, speed: number) {
    this.cy = field.height / 2; // center y
    this.length = field.height / 5; // total length
    this.width = field.width / 50; // thickness of paddle
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
      R: this.width / 2,
    };
    this._lastCy = this.cy;

    return this._capsule;
  }
}

export class AIPlayer {
  aiPlayerNo: 1 | 2 | null = 2;
  aiDifficulty: "easy" | "medium" | "hard" = "medium";
  aiLastDecisionTime: number = Date.now();
  aiTargetY: number | null = null;
}

export class GameServer {
  Field: Field;
  Ball: Ball;
  Paddle1: Paddle;
  Paddle2: Paddle;
  score1: number = 0;
  score2: number = 0;
  countdown: number = 3;
  maxScore: number;
  clients = new Map<1 | 2, { playerInfo: PlayerInfo; connection: any }>();
  physicsInterval: number;
  renderInterval: number;
  gameMode: GameMode;

  private physicsLoopId?: NodeJS.Timeout;
  private renderLoopId?: NodeJS.Timeout;
  private isRunning: boolean = false;

  // AI Config
  aiEnabled: boolean = false;
  aiPlayer: AIPlayer = new AIPlayer();

  // Callbacks for game loops (injected from outside)
  private onPhysicsUpdate?: (game: GameServer) => void;
  private onRender?: (game: GameServer) => void;

  constructor(gameMode: GameMode) {
    this.Field = new Field(config.game.width, config.game.height);
    this.Ball = new Ball(this.Field);
    this.Paddle1 = new Paddle(1, this.Field, config.game.paddleSpeed);
    this.Paddle2 = new Paddle(2, this.Field, config.game.paddleSpeed);
    this.maxScore = config.game.maxScore;
    this.physicsInterval = PHYSICS_INTERVAL;
    this.renderInterval = RENDER_INTERVAL;
    this.gameMode = gameMode;
  }

  // Set callback functions
  setUpdateCallback(callback: (game: GameServer) => void) {
    this.onPhysicsUpdate = callback;
  }

  setRenderCallback(callback: (game: GameServer) => void) {
    this.onRender = callback;
  }

  // Start the game loops
  start() {
    if (this.isRunning) {
      console.warn("⚠️  Game loops already running");
      return;
    }

    if (!this.onPhysicsUpdate || !this.onRender) {
      throw new Error(
        "❌ Callbacks not set. Call setUpdateCallback() and setRenderCallback() first."
      );
    }

    console.log("▶️  Starting game loops...");

    // Start physics loop
    this.physicsLoopId = setInterval(() => {
      this.onPhysicsUpdate!(this);
    }, this.physicsInterval);

    // Start render loop
    this.renderLoopId = setInterval(() => {
      this.onRender!(this);
    }, this.renderInterval);

    this.isRunning = true;
    console.log(
      `✅ Game loops started (Physics: ${this.physicsInterval}ms, Render: ${this.renderInterval}ms)`
    );
  }

  // Stop the game loops
  stop() {
    if (!this.isRunning) {
      console.warn("⚠️  Game loops not running");
      return;
    }

    console.log("⏸️  Stopping game loops...");

    if (this.physicsLoopId) {
      clearInterval(this.physicsLoopId);
      this.physicsLoopId = undefined;
    }

    if (this.renderLoopId) {
      clearInterval(this.renderLoopId);
      this.renderLoopId = undefined;
    }

    this.isRunning = false;
    console.log("✅ Game loops stopped");
  }

  // Get game result
  getResult() {
    const player1 = this.clients.get(1)?.playerInfo;
    const player2 = this.clients.get(2)?.playerInfo;

    if (!player1 || !player2) {
      return null;
    }

    const winner = this.score1 > this.score2 ? player1 : player2;
    const loser = this.score1 > this.score2 ? player2 : player1;
    const winnerScore = Math.max(this.score1, this.score2);
    const loserScore = Math.min(this.score1, this.score2);

    return {
      winner,
      loser,
      winnerScore,
      loserScore,
    };
  }

  // Get current state

  // Check if game is running
  running() {
    return this.isRunning;
  }
}
