import { config, PHYSICS_INTERVAL, RENDER_INTERVAL, VALID_MODES } from "./config.js";
import { resetBall } from "./gameUtils.js";
import { broadcastGameSetup, broadcastGameState, sendErrorToClient } from "./networkUtils.js";
import { Tournament } from "./Tournament.js";

// Player information
export interface PlayerInfo {
  userId: number;
  username: string;
  avatar?: string;
}

export interface GameStartPayload {
  type: "newGame";
  mode: string;
  player: PlayerInfo;
  difficulty?: "easy" | "medium" | "hard";
}

export class Field {
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }
}

export interface Result {
  player1: PlayerInfo;
  player2: PlayerInfo;
  score1: number;
  score2: number;
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
  aiPlayerNo: 1 | 2 | null = 1;
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
  countdown: number = 0;
  maxScore: number;
  clients = new Map<1 | 2, { playerInfo: PlayerInfo; connection: any }>();
  isWaiting: boolean = false;
  physicsInterval: number;
  renderInterval: number;
  gameMode: string;
  tournament: Tournament | null = null;
  gameId: string | undefined;

  private physicsLoopId?: NodeJS.Timeout;
  private renderLoopId?: NodeJS.Timeout;
  private isRunning: boolean = false;

  // AI Config
  isServe: boolean = true;
  aiPlayer: AIPlayer = new AIPlayer();

  // Callbacks for game loops (injected from outside)
  private onPhysicsUpdate?: (game: GameServer) => void;
  private onRender?: (game: GameServer) => void;
  private onGameEnd?: (game: GameServer) => void;

  constructor(gameMode: string) {
    this.Field = new Field(config.game.width, config.game.height);
    this.Ball = new Ball(this.Field);
    this.Paddle1 = new Paddle(1, this.Field, config.game.paddleSpeed);
    this.Paddle2 = new Paddle(2, this.Field, config.game.paddleSpeed);
    this.maxScore = config.game.maxScore;
    this.physicsInterval = PHYSICS_INTERVAL;
    this.renderInterval = RENDER_INTERVAL;
    this.gameMode = gameMode;
    this.isWaiting = ["remote", "friend", "tournament"].includes(gameMode);
  }

  // Set callback functions
  setUpdateCallback(callback: (game: GameServer) => void) {
    this.onPhysicsUpdate = callback;
  }

  setRenderCallback(callback: (game: GameServer) => void) {
    this.onRender = callback;
  }

  setCleanupCallback(callback: (game: GameServer) => void) {
    this.onGameEnd = callback;
  }

  invokeCleanup() {
    if (this.onGameEnd) {
      this.onGameEnd(this);
    }
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

  connect(playerNum: 1 | 2, playerInfo: PlayerInfo, connection: any): void {
    this.clients.set(playerNum, { playerInfo, connection });
  }

  isConnected(connection: any): boolean {
    for (const client of this.clients.values()) {
      if (client.connection === connection) {
        return true;
      }
    }
    return false;
  }

  disconnect(connection: any): void {
    for (const client of this.clients.values()) {
      if (client.connection === connection) {
        sendErrorToClient(client.connection, "You have been disconnected");
        try {
          client.connection.close();
        } catch (err) {
          console.error("Error closing connection:", err);
        }
        client.connection = null;
        break;
      }
    }
  }

  disconnectByUserId(userId: number): void {
    for (const client of this.clients.values()) {
      if (client.playerInfo.userId === userId) {
        sendErrorToClient(client.connection, "You have been disconnected");
        try {
          client.connection.close();
        } catch (err) {
          console.error("Error closing connection:", err);
        }
        client.connection = null;
        break;
      }
    }
  }

  updateConnection(userId: number, newConnection: any): boolean {
    const currentClient = Array.from(this.clients.values()).find(
      (client) => client.playerInfo.userId === userId
    );
    if (currentClient) {
      this.disconnect(currentClient.connection);
      currentClient.connection = newConnection;
      broadcastGameSetup(this);
      return true;
    }
    return false;
  }

  connectionCount(): number {
    const connections = Array.from(this.clients.values()).filter(
      (client) => client.connection !== null
    );
    return connections.length;
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

  freezeBall(): void {
    this.Ball.speedX = 0;
    this.Ball.speedY = 0;
    broadcastGameSetup(this);
    this.start();
  }

  // Helper function to run game countdown and start play
  async runGameCountdown(): Promise<void> {
    this.isWaiting = false;
    broadcastGameSetup(this);
    // Run 3-second countdown
    for (let i = 3; i > 0; i--) {
      if (!this.running()) break;
      this.countdown = i;
      broadcastGameState(this);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Countdown complete, release ball
    if (this.running()) {
      this.countdown = 0;
      resetBall(this);
      broadcastGameSetup(this);
    }
  }

  // Handle player input
  handlePlayerInput(input: { player: number; action: string }) {
    const { player, action } = input;
    const targetPaddle = player === 1 ? this.Paddle1 : this.Paddle2;

    switch (action) {
      case "up":
        targetPaddle.ySpeed = -targetPaddle.speed;
        break;
      case "down":
        targetPaddle.ySpeed = targetPaddle.speed;
        break;
      case "stop":
        targetPaddle.ySpeed = 0;
        break;
    }
  }
}
