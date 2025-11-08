// Game mode types (must match backend)
export enum GameMode {
  LOCAL = "LOCAL",
  ONLINE = "ONLINE",
}

interface PlayerInfo {
  userId: number | string;
  username: string;
  avatar?: string;
}

export interface GameState {
  field: { width: number; height: number };
  ball: { x: number; y: number; radius: number };
  paddle1: { cx?: number; cy?: number; capsule: Capsule };
  paddle2: { cx?: number; cy?: number; capsule: Capsule };
  score?: { player1: number; player2: number };
  countdown?: number;
}

interface Capsule {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  R: number;
}

export class Pong {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ws: WebSocket | null = null;
  private gameState: GameState | null = null;
  private readonly wsUrl: string;
  private isConnected: boolean = false;
  private currentGameMode: GameMode = GameMode.LOCAL;
  private currentPlayerInfo: PlayerInfo | null = null;
  private readonly tabId: string;
  private assignedPlayerNumber: 1 | 2 | null = null; // Track which player this client is
  private isWaitingForOpponent: boolean = false; // Track if waiting for opponent

  // Store references to event listeners for cleanup
  private keydownListener: ((event: KeyboardEvent) => void) | null = null;
  private keyupListener: ((event: KeyboardEvent) => void) | null = null;

  constructor(canvasId: string, wsUrl: string) {
    const canvasEl = document.getElementById(canvasId);
    if (!canvasEl) throw new Error(`Canvas element with id "${canvasId}" not found.`);
    const canvas = canvasEl as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2D rendering context.");

    this.canvas = canvas;
    this.ctx = ctx;
    this.wsUrl = wsUrl;
    this.tabId = this.generateTabId();

    this.setupInputHandlers();
    this.connect();
    this.renderLoop();
  }

  /**
   * Generate or retrieve a unique ID for this browser tab
   * Persists across page refreshes within the same tab
   */
  private generateTabId(): string {
    let tabId = sessionStorage.getItem("tabId");
    if (!tabId) {
      // Use crypto.randomUUID if available, otherwise fallback
      if (typeof crypto !== "undefined" && crypto.randomUUID) {
        tabId = crypto.randomUUID();
      } else {
        // Fallback for older browsers
        tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }
      sessionStorage.setItem("tabId", tabId);
    }
    return tabId;
  }

  /**
   * Start a game with optional game mode and player information
   * @param gameMode - The game mode (LOCAL, ONLINE, TOURNAMENT). Defaults to LOCAL.
   * @param playerInfo - Optional player information (userId, username, avatar)
   */
  public startGame(gameMode: GameMode, playerInfo?: PlayerInfo) {
    this.currentGameMode = gameMode;
    // Use tabId as username for now (until login is implemented)
    this.currentPlayerInfo = playerInfo || {
      userId: this.tabId,
      username: this.tabId,
    };

    const sendStart = () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const message: any = {
          type: "startGame",
          mode: this.currentGameMode,
          player: this.currentPlayerInfo,
        };

        this.ws.send(JSON.stringify(message));
      }
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      sendStart();
    } else if (this.ws) {
      // wait for open then send once
      this.ws.addEventListener(
        "open",
        () => {
          sendStart();
        },
        { once: true }
      );
    }
  }

  private connect() {
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      this.isConnected = true;
      console.log("✅ Connected to game server");
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === "error") {
          // Handle error messages from server
          console.error("❌ Game server error:", message.message);
          alert(`Game Error: ${message.message}`);
        } else if (message.type === "waiting") {
          // Set waiting state and store player number
          this.isWaitingForOpponent = true;
        } else if (message.type === "ready") {
          this.isWaitingForOpponent = false;
        }
        if (["gameSetup", "ready", "waiting"].includes(message.type)) {
          this.gameState = message.data;

          if (this.currentGameMode === GameMode.ONLINE) {
            if (message.playerNumber) {
              this.assignedPlayerNumber = message.playerNumber;
            } else {
              this.assignedPlayerNumber = 1;
            }
          } else {
            this.assignedPlayerNumber = null;
          }

          this.updateScoreDisplay();
        } else if (message.type === "gameState") {
          // Merge updates with existing state
          if (this.gameState) {
            this.gameState.ball.x = message.data.ball.x;
            this.gameState.ball.y = message.data.ball.y;
            this.gameState.paddle1.cx = message.data.paddle1.cx;
            this.gameState.paddle1.cy = message.data.paddle1.cy;
            this.gameState.paddle2.cx = message.data.paddle2.cx;
            this.gameState.paddle2.cy = message.data.paddle2.cy;
            // Update capsules based on new positions
            this.updateCapsule(this.gameState.paddle1);
            this.updateCapsule(this.gameState.paddle2);
            if (message.data.countdown) {
              this.gameState.countdown = message.data.countdown;
            }
            // Update scores
            if (message.data.score) {
              if (!this.gameState.score) {
                this.gameState.score = { player1: 0, player2: 0 };
              }
              this.gameState.score.player1 = message.data.score.player1;
              this.gameState.score.player2 = message.data.score.player2;
              this.updateScoreDisplay();
            }
          }
        }
      } catch (err) {
        console.error("Error parsing game message:", err);
      }
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };
  }

  private updateCapsule(paddle: { cx?: number; cy?: number; capsule: Capsule }) {
    const cap = paddle.capsule;
    const dx = cap.x2 - cap.x1;
    const dy = cap.y2 - cap.y1;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (paddle.cx === undefined || paddle.cy === undefined || !isFinite(length) || length === 0)
      return;

    const halfLength = length / 2;
    paddle.capsule.x1 = paddle.cx;
    paddle.capsule.y1 = paddle.cy - halfLength;
    paddle.capsule.x2 = paddle.cx;
    paddle.capsule.y2 = paddle.cy + halfLength;
  }

  private updateScoreDisplay() {
    if (!this.gameState?.score) return;

    const score1El = document.getElementById("score-player1");
    const score2El = document.getElementById("score-player2");

    if (score1El) score1El.textContent = this.gameState.score.player1.toString();
    if (score2El) score2El.textContent = this.gameState.score.player2.toString();
  }

  /**
   * Handle keydown events based on game mode
   */
  private handleKeyDown(
    key: string,
    sendInput: (type: string, data: any) => void,
  ): void {
    // Skip if waiting for opponent
    if (
      this.currentGameMode === GameMode.ONLINE &&
      this.assignedPlayerNumber === null
    ) {
      return;
    }

    if (this.currentGameMode === GameMode.ONLINE) {
      // ONLINE mode: only control assigned player
      switch (key) {
        case "arrowup":
          if (this.assignedPlayerNumber) {
            sendInput("playerInput", {
              player: this.assignedPlayerNumber,
              action: "up",
            });
          }
          break;
        case "arrowdown":
          if (this.assignedPlayerNumber) {
            sendInput("playerInput", {
              player: this.assignedPlayerNumber,
              action: "down",
            });
          }
          break;
      }
    } else {
      // LOCAL mode: both players controllable (S/X for player 1, arrows for player 2)
      switch (key) {
        case "s":
          sendInput("playerInput", { player: 1, action: "up" });
          break;
        case "x":
          sendInput("playerInput", { player: 1, action: "down" });
          break;
        case "arrowup":
          sendInput("playerInput", { player: 2, action: "up" });
          break;
        case "arrowdown":
          sendInput("playerInput", { player: 2, action: "down" });
          break;
      }
    }
  }

  /**
   * Handle keyup events based on game mode
   */
  private handleKeyUp(
    key: string,
    sendInput: (type: string, data: any) => void,
  ): void {
    // Skip if waiting for opponent
    if (
      this.currentGameMode === GameMode.ONLINE &&
      this.assignedPlayerNumber === null
    ) {
      return;
    }

    if (this.currentGameMode === GameMode.ONLINE) {
      // ONLINE mode: only stop assigned player
      if (
        (key === "arrowup" || key === "arrowdown") &&
        this.assignedPlayerNumber
      ) {
        sendInput("playerInput", {
          player: this.assignedPlayerNumber,
          action: "stop",
        });
      }
    } else {
      // LOCAL mode: stop both players
      switch (key) {
        case "s":
        case "x":
          sendInput("playerInput", { player: 1, action: "stop" });
          break;
        case "arrowup":
        case "arrowdown":
          sendInput("playerInput", { player: 2, action: "stop" });
          break;
      }
    }
  }

  private setupInputHandlers() {
    const sendInput = (type: string, data: any) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type, data }));
      }
    };

    // Create and store keydown listener
    this.keydownListener = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      this.handleKeyDown(key, sendInput);
    };

    // Create and store keyup listener
    this.keyupListener = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      this.handleKeyUp(key, sendInput);
    };

    // Add event listeners
    document.addEventListener("keydown", this.keydownListener);
    document.addEventListener("keyup", this.keyupListener);
  }

  private renderLoop = () => {
    this.draw();
    requestAnimationFrame(this.renderLoop);
  };

  private draw() {
    if (!this.gameState) return;

    const { width, height } = this.canvas;
    const { field, ball, paddle1, paddle2, score, countdown } = this.gameState;

    // Clear canvas
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, width, height);

    // Scaling
    const scaleX = width / field.width;
    const scaleY = height / field.height;
    const scale = Math.min(scaleX, scaleY);

    // Draw center line
    this.ctx.strokeStyle = "#39ff14";
    this.ctx.lineWidth = 10;
    this.ctx.beginPath();
    this.ctx.moveTo(width / 2, 0);
    this.ctx.lineTo(width / 2, height);
    this.ctx.stroke();

    // Draw ball
    this.ctx.fillStyle = "#ff00cc";
    this.ctx.beginPath();
    this.ctx.arc(ball.x * scale, ball.y * scale, ball.radius * scale, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw paddles
    this.ctx.fillStyle = "#39ff14";
    this.drawCapsule(paddle1.capsule, scale);
    this.drawCapsule(paddle2.capsule, scale);

    // Draw waiting for opponent message
    if (this.isWaitingForOpponent) {
      this.ctx.fillStyle = "#fff";
      this.ctx.font = "bold 200px Arial";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText("Waiting for opponent...", width / 2, height / 2);
      return;
    }

    // Draw count down
    if (!this.isWaitingForOpponent && countdown && countdown > 0) {
      this.ctx.fillStyle = "#fff";
      this.ctx.font = "bold 500px Arial";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(countdown.toString(), width / 2, height / 2);
    }
  }

  private drawCapsule(capsule: Capsule, scale: number) {
    const { x1, y1, x2, y2, R } = capsule;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) {
      // Just a circle
      this.ctx.beginPath();
      this.ctx.arc(x1 * scale, y1 * scale, R * scale, 0, Math.PI * 2);
      this.ctx.fill();
      return;
    }

    const nx = dx / length;
    const ny = dy / length;
    const px = -ny * R;
    const py = nx * R;

    this.ctx.beginPath();
    this.ctx.moveTo((x1 + px) * scale, (y1 + py) * scale);
    this.ctx.lineTo((x2 + px) * scale, (y2 + py) * scale);
    this.ctx.lineTo((x2 - px) * scale, (y2 - py) * scale);
    this.ctx.lineTo((x1 - px) * scale, (y1 - py) * scale);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.beginPath();
    this.ctx.arc(x1 * scale, y1 * scale, R * scale, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.beginPath();
    this.ctx.arc(x2 * scale, y2 * scale, R * scale, 0, Math.PI * 2);
    this.ctx.fill();
  }

  public destroy(): void {
    // Remove event listeners
    if (this.keydownListener) {
      document.removeEventListener("keydown", this.keydownListener);
    }
    if (this.keyupListener) {
      document.removeEventListener("keyup", this.keyupListener);
    }

    this.ws?.close();
    this.ws = null;
    this.isConnected = false;
    console.log("🛑 Pong destroyed");
  }
}
