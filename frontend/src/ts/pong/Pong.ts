import { SecureTokenManager } from "../utils/secureTokenManager.js";

interface PlayerInfo {
  userId: number;
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
  isWaiting?: boolean;
}

interface Capsule {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  R: number;
}

interface PlayerInput {
  player: number;
  action: "up" | "down" | "stop";
}

import { i18n } from "../utils/i18n.js";

export class Pong {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ws: WebSocket | null = null;
  private gameState: GameState | null = null;
  private readonly wsUrl: string;
  private isConnected: boolean = false;
  private currentGameMode: string = "local";
  private currentPlayerInfo: PlayerInfo | null = null;
  private gameId: string | undefined;
  private assignedPlayerNumber: 1 | 2 | null = null; // Track which player this client is
  private player1Username: string = "Player 1";
  private player2Username: string = "Player 2";
  private authCheckInterval: number | null = null;
  private storageListener: ((event: StorageEvent) => void) | null = null;
  private isDestroyed: boolean = false;
  // Note: autoreconnect behavior is handled in onclose (keeps main branch behavior)

  // Store references to event listeners for cleanup
  private keydownListener: ((event: KeyboardEvent) => void) | null = null;
  private keyupListener: ((event: KeyboardEvent) => void) | null = null;
  private keysPressed: Set<string> = new Set();
  private languageChangeListener: (() => void) | null = null;

  // Mobile button controls
  private buttonListeners: Array<{
    element: HTMLElement;
    event: string;
    handler: (e: Event) => void;
    options?: AddEventListenerOptions;
  }> = [];

  // Tournament bracket tracking
  private tournamentPlayers: string[] = [];
  private tournamentMatches: Array<{
    player1: string;
    player2: string;
    winner?: string;
    round: number;
  }> = [];
  private currentRound: number = 0;
  private currentMatchPlayers: { player1: string; player2: string } | null = null;

  constructor(canvasId: string, wsUrl: string, gameMode: string, gameId?: string) {
    const canvasEl = document.getElementById(canvasId);
    if (!canvasEl) throw new Error(`Canvas element with id "${canvasId}" not found.`);
    const canvas = canvasEl as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2D rendering context.");

    this.canvas = canvas;
    this.ctx = ctx;
    this.wsUrl = wsUrl;
    this.currentGameMode = gameMode;
    this.gameId = gameId;
    this.setupInputHandlers();
    this.setupButtonControls();
    this.setupLanguageListener();
    this.connect();
    this.renderLoop();
  }

  /**
   * Start a game with optional game mode and player information
   * @param gameMode - The game mode (LOCAL, ONLINE, TOURNAMENT). Defaults to LOCAL.
   * @param playerInfo - Optional player information (userId, username, avatar). Required for ONLINE mode.
   * @param difficulty - Optional difficulty level for AI mode ("easy", "medium", "hard").
   */
  public startGame(
    gameMode: string,
    playerInfo?: PlayerInfo,
    difficulty?: "easy" | "medium" | "hard",
    gameId?: string
  ) {
    this.currentGameMode = gameMode;

    // For ONLINE mode, playerInfo is required
    if (["remote", "friend"].includes(gameMode) && !playerInfo) {
      console.error(`❌ Player info is required for ${gameMode} mode`);
      return;
    }

    if (gameMode === "friend" && !gameId) {
      console.error("❌ Game ID is required for friend mode");
      return;
    }

    this.currentPlayerInfo = playerInfo || null;

    const message: Record<string, unknown> = {
      type: "newGame",
      mode: this.currentGameMode,
    };
    if (difficulty) message.difficulty = difficulty;

    console.log("📨 Sending message:", message);

    // Update button visibility for new game mode
    this.updateButtonVisibility();

    // For authenticated modes, ensure WebSocket is open before sending
    if (["remote", "friend"].includes(gameMode)) {
      if (!this.isConnected) {
        this.ws?.addEventListener(
          "open",
          () => {
            this.sendWhenConnected(message);
          },
          { once: true }
        );
      } else {
        this.sendWhenConnected(message);
      }
    } else {
      this.sendWhenConnected(message);
    }
  }

  /**
   * Get the current game score
   */
  public getScore(): { player1: number; player2: number } | null {
    return this.gameState?.score || null;
  }

  newTournament(playerNames: string[]) {
    const message: Record<string, unknown> = {
      type: "newTournament",
      mode: this.currentGameMode,
      players: playerNames,
    };

    // Initialize tournament tracking
    this.tournamentPlayers = [...playerNames];
    this.tournamentMatches = [];
    this.currentRound = 0;
    this.updateTournamentBracket();

    this.sendWhenConnected(message);
  }

  /**
   * Send a JSON message immediately if the WebSocket is open,
   * otherwise send it once when the socket opens. Warn if `ws` is null.
   */
  private sendWhenConnected(message: Record<string, unknown>) {
    if (!this.ws) {
      console.warn("WebSocket not initialized, cannot send message", message);
      return;
    }

    const send = () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
      }
    };

    if (this.ws.readyState === WebSocket.OPEN) {
      send();
    } else {
      this.ws.addEventListener(
        "open",
        () => {
          send();
        },
        { once: true }
      );
    }
  }

  private connect() {
    let urlWithMode = `${this.wsUrl}?mode=${encodeURIComponent(this.currentGameMode)}`;

    // Add gameId for friend mode
    if (this.currentGameMode === "friend" && this.gameId) {
      urlWithMode += `&gameId=${encodeURIComponent(this.gameId)}`;
    }

    // Add access token for authenticated modes
    if (["remote", "friend"].includes(this.currentGameMode)) {
      const accessToken = SecureTokenManager.getInstance().getAccessToken();
      if (accessToken) {
        urlWithMode += `&token=${encodeURIComponent(accessToken)}`;
      } else {
        console.warn(`⚠️ No access token available for ${this.currentGameMode} mode`);
      }
    }

    try {
      if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
        try {
          this.ws.close(1000, "client_reconnect");
        } catch (e) {}
      }
    } catch (e) {}

    try {
      this.ws = new WebSocket(urlWithMode);
    } catch (err) {
      return;
    }

    this.ws.onopen = () => {
      this.isConnected = true;
      console.log("✅ Connected to game server");
      // send a backup auth message in case token wasn't included in the URL
      try {
        const accessToken = SecureTokenManager.getInstance().getAccessToken();
        if (accessToken && this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: "auth", token: accessToken }));
        }
      } catch (e) {
        // ignore
      }

      // Start periodic auth check for authenticated modes (every 5 seconds)
      if (["remote", "friend"].includes(this.currentGameMode)) {
        this.startAuthCheck();
      }
    };

    this.ws.onerror = (event: Event) => {
      console.error("❌ WebSocket encountered an error", {
        url: urlWithMode,
        readyState: this.ws?.readyState,
        event,
      });
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === "error") {
          // Handle error messages from server
          console.error("❌ Game server error:", message.message);
          if (message.message === "You have been disconnected") {
            this.destroy();
            window.location.href = "/";
            return;
          }
          alert(`${i18n.t("pong.gameError")}: ${message.message}`);
        } else if (["playerLeft", "gameResult"].includes(message.type)) {
          if (message.type === "gameResult") {
            console.log("🏆 Game Over! Result:", message.data);

            // Show win/loss notification
            if (["remote", "friend", "ai"].includes(this.currentGameMode)) {
              const result = message.data;
              let didWin = false;

              if (this.currentGameMode === "ai") {
                // In AI mode, player is always player 2
                didWin = result.winner === 2;
              } else if (
                ["remote", "friend"].includes(this.currentGameMode) &&
                this.assignedPlayerNumber
              ) {
                didWin = result.winner === this.assignedPlayerNumber;
              }

              const notificationMessage = didWin ? i18n.t("pong.youWon") : i18n.t("pong.youLost");
              alert(`${i18n.t("pong.gameOver")}\n\n${notificationMessage}`);
            } else if (this.currentGameMode === "tournament") {
              const result = message.data;
              // Fallback to player number if winnerName is missing (defensive programming)
              const winner = result.winnerName || `Player ${result.winner}`;

              // Update tournament bracket with winner
              this.recordTournamentWinner(this.player1Username, this.player2Username, winner);

              alert(
                `${i18n.t("pong.gameOver")}\n\n${i18n.t("pong.playerWins", { player: winner })}`
              );
            }

            this.sendWhenConnected({
              type: "nextGame",
              mode: this.currentGameMode,
            });
            if (["remote", "tournament"].includes(this.currentGameMode)) {
              window.dispatchEvent(new CustomEvent("pong:showNewGameButton"));
            }
          } else {
            console.warn("⚠️ Player left:", message.message);
            alert(`⚠️ ${message.message}`);
          }
        }
        if (["gameSetup"].includes(message.type)) {
          this.gameState = message.data;

          if (["friend", "remote"].includes(this.currentGameMode)) {
            if (message.playerNumber) {
              this.assignedPlayerNumber = message.playerNumber;
            } else {
              this.assignedPlayerNumber = 1;
            }
          } else {
            this.assignedPlayerNumber = null;
          }
          if (["remote", "friend", "tournament", "ai"].includes(this.currentGameMode)) {
            if (message.player1Username) {
              this.player1Username = message.player1Username;
            }
            if (message.player2Username) {
              this.player2Username = message.player2Username;
            }
            this.updatePlayerNamesDisplay();
          }

          // Track tournament match
          if (
            this.currentGameMode === "tournament" &&
            message.player1Username &&
            message.player2Username
          ) {
            this.updateTournamentStatus(message.player1Username, message.player2Username);
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
            if (message.data.isWaiting) {
              this.gameState.isWaiting = message.data.isWaiting;
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
        } else if (message.type === "tournamentComplete" && message.mode === "tournament") {
          console.log("🎉 Tournament Complete! Results:", message.data);
        }
      } catch (err) {
        console.error("Error parsing game message:", err);
      }
    };

    this.ws.onclose = (ev: CloseEvent) => {
      this.isConnected = false;
      this.stopAuthCheck();
      console.warn("WebSocket closed", {
        url: urlWithMode,
        code: ev.code,
        reason: ev.reason,
        wasClean: ev.wasClean,
      });

      // Don't reconnect if destroyed
      if (this.isDestroyed) {
        return;
      }

      // Don't reconnect if user logged out (for authenticated modes)
      if (["remote", "friend"].includes(this.currentGameMode)) {
        const hasUserId = localStorage.getItem("userId") !== null;
        if (!hasUserId) {
          return;
        }
      }

      setTimeout(() => this.connect(), 3000);
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

  private updatePlayerNamesDisplay() {
    const name1El = document.getElementById("name-player1");
    const name2El = document.getElementById("name-player2");

    if (!name1El || !name2El) return;

    switch (this.currentGameMode) {
      case "ai":
        name1El.textContent = i18n.t("pong_dynamic.ai");
        name2El.textContent = i18n.t("pong_dynamic.you");
        break;
      case "local":
        name1El.textContent = i18n.t("pong_dynamic.player1");
        name2El.textContent = i18n.t("pong_dynamic.player2");
        break;
      default:
        name1El.textContent = this.player1Username;
        name2El.textContent = this.player2Username;
    }
  }

  private setupLanguageListener() {
    this.languageChangeListener = () => {
      this.updatePlayerNamesDisplay();
      // Update tournament bracket to refresh translated labels
      if (this.currentGameMode === "tournament") {
        this.updateTournamentBracket();
        // Update current match status text
        if (this.currentMatchPlayers) {
          const statusEl = document.getElementById("tournament-status");
          if (statusEl) {
            statusEl.textContent = `${i18n.t("tournament.currentMatch")}: ${this.currentMatchPlayers.player1} vs ${this.currentMatchPlayers.player2}`;
          }
        }
      }
    };
    window.addEventListener("languageChanged", this.languageChangeListener);
  }

  /**
   * Helper to determine the correct player number for Player 2 buttons.
   * In online/friend modes, uses the assigned player number.
   * Otherwise, defaults to player 2.
   */
  private getPlayerNumberForP2(): number {
    return ["remote", "friend"].includes(this.currentGameMode) && this.assignedPlayerNumber
      ? this.assignedPlayerNumber
      : 2;
  }

  private setupButtonControls() {
    const sendInput = (type: string, data: PlayerInput) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type, data }));
      }
    };

    // Get button elements
    const p1UpBtn = document.getElementById("p1-up-btn");
    const p1DownBtn = document.getElementById("p1-down-btn");
    const p2UpBtn = document.getElementById("p2-up-btn");
    const p2DownBtn = document.getElementById("p2-down-btn");

    // Player 1 buttons
    if (p1UpBtn) {
      const upHandler = (e: Event) => {
        e.preventDefault();
        sendInput("playerInput", { player: 1, action: "up" });
      };
      const upStopHandler = (e: Event) => {
        e.preventDefault();
        sendInput("playerInput", { player: 1, action: "stop" });
      };

      p1UpBtn.addEventListener("touchstart", upHandler, { passive: false });
      p1UpBtn.addEventListener("mousedown", upHandler);
      p1UpBtn.addEventListener("touchend", upStopHandler, { passive: false });
      p1UpBtn.addEventListener("touchcancel", upStopHandler, {
        passive: false,
      });
      p1UpBtn.addEventListener("mouseup", upStopHandler);

      this.buttonListeners.push(
        { element: p1UpBtn, event: "touchstart", handler: upHandler, options: { passive: false } },
        { element: p1UpBtn, event: "mousedown", handler: upHandler },
        {
          element: p1UpBtn,
          event: "touchend",
          handler: upStopHandler,
          options: { passive: false },
        },
        {
          element: p1UpBtn,
          event: "touchcancel",
          handler: upStopHandler,
          options: { passive: false },
        },
        { element: p1UpBtn, event: "mouseup", handler: upStopHandler }
      );
    }

    if (p1DownBtn) {
      const downHandler = (e: Event) => {
        e.preventDefault();
        sendInput("playerInput", { player: 1, action: "down" });
      };
      const downStopHandler = (e: Event) => {
        e.preventDefault();
        sendInput("playerInput", { player: 1, action: "stop" });
      };

      p1DownBtn.addEventListener("touchstart", downHandler, { passive: false });
      p1DownBtn.addEventListener("mousedown", downHandler);
      p1DownBtn.addEventListener("touchend", downStopHandler, {
        passive: false,
      });
      p1DownBtn.addEventListener("touchcancel", downStopHandler, {
        passive: false,
      });
      p1DownBtn.addEventListener("mouseup", downStopHandler);

      this.buttonListeners.push(
        {
          element: p1DownBtn,
          event: "touchstart",
          handler: downHandler,
          options: { passive: false },
        },
        { element: p1DownBtn, event: "mousedown", handler: downHandler },
        {
          element: p1DownBtn,
          event: "touchend",
          handler: downStopHandler,
          options: { passive: false },
        },
        {
          element: p1DownBtn,
          event: "touchcancel",
          handler: downStopHandler,
          options: { passive: false },
        },
        { element: p1DownBtn, event: "mouseup", handler: downStopHandler }
      );
    }

    // Player 2 buttons (or single player in online/AI mode)
    if (p2UpBtn) {
      const upHandler = (e: Event) => {
        e.preventDefault();
        sendInput("playerInput", { player: this.getPlayerNumberForP2(), action: "up" });
      };
      const upStopHandler = (e: Event) => {
        e.preventDefault();
        sendInput("playerInput", { player: this.getPlayerNumberForP2(), action: "stop" });
      };

      p2UpBtn.addEventListener("touchstart", upHandler, { passive: false });
      p2UpBtn.addEventListener("mousedown", upHandler);
      p2UpBtn.addEventListener("touchend", upStopHandler, { passive: false });
      p2UpBtn.addEventListener("touchcancel", upStopHandler, {
        passive: false,
      });
      p2UpBtn.addEventListener("mouseup", upStopHandler);

      this.buttonListeners.push(
        { element: p2UpBtn, event: "touchstart", handler: upHandler, options: { passive: false } },
        { element: p2UpBtn, event: "mousedown", handler: upHandler },
        {
          element: p2UpBtn,
          event: "touchend",
          handler: upStopHandler,
          options: { passive: false },
        },
        {
          element: p2UpBtn,
          event: "touchcancel",
          handler: upStopHandler,
          options: { passive: false },
        },
        { element: p2UpBtn, event: "mouseup", handler: upStopHandler }
      );
    }

    if (p2DownBtn) {
      const downHandler = (e: Event) => {
        e.preventDefault();
        sendInput("playerInput", { player: this.getPlayerNumberForP2(), action: "down" });
      };
      const downStopHandler = (e: Event) => {
        e.preventDefault();
        sendInput("playerInput", { player: this.getPlayerNumberForP2(), action: "stop" });
      };

      p2DownBtn.addEventListener("touchstart", downHandler, { passive: false });
      p2DownBtn.addEventListener("mousedown", downHandler);
      p2DownBtn.addEventListener("touchend", downStopHandler, {
        passive: false,
      });
      p2DownBtn.addEventListener("touchcancel", downStopHandler, {
        passive: false,
      });
      p2DownBtn.addEventListener("mouseup", downStopHandler);

      this.buttonListeners.push(
        {
          element: p2DownBtn,
          event: "touchstart",
          handler: downHandler,
          options: { passive: false },
        },
        { element: p2DownBtn, event: "mousedown", handler: downHandler },
        {
          element: p2DownBtn,
          event: "touchend",
          handler: downStopHandler,
          options: { passive: false },
        },
        {
          element: p2DownBtn,
          event: "touchcancel",
          handler: downStopHandler,
          options: { passive: false },
        },
        { element: p2DownBtn, event: "mouseup", handler: downStopHandler }
      );
    }

    // Update button visibility based on game mode
    this.updateButtonVisibility();
  }

  private updateButtonVisibility() {
    const mobileControls = document.getElementById("mobile-controls");
    const player1Controls = document.getElementById("player1-controls");
    const player2Controls = document.getElementById("player2-controls");
    const player2Label = document.getElementById("player2-controls-label");

    if (!mobileControls || !player1Controls || !player2Controls) return;

    // Show mobile controls
    mobileControls.classList.remove("hidden");

    if (["local", "tournament"].includes(this.currentGameMode)) {
      // Local mode: show both players
      player1Controls.classList.remove("hidden");
      player2Controls.classList.remove("hidden");
      if (player2Label) {
        player2Label.setAttribute("data-i18n", "pong_dynamic.player2");
        player2Label.textContent = i18n.t("pong_dynamic.player2");
      }
    } else if (["remote", "friend", "ai"].includes(this.currentGameMode)) {
      // Online/AI mode: show only player 2 controls (or assigned player)
      player1Controls.classList.add("hidden");
      player2Controls.classList.remove("hidden");
      if (player2Label) {
        if (this.currentGameMode === "ai") {
          player2Label.setAttribute("data-i18n", "pong_dynamic.you");
          player2Label.textContent = i18n.t("pong_dynamic.you");
        } else {
          player2Label.removeAttribute("data-i18n");
          player2Label.textContent = "You";
        }
      }
    }
  }

  /**
   * Handle keydown events based on game mode
   */
  private handleKeyDown(key: string, sendInput: (type: string, data: PlayerInput) => void): void {
    if (this.keysPressed.has(key)) return;
    this.keysPressed.add(key);

    // Skip if waiting for opponent
    if (["friend", "remote"].includes(this.currentGameMode) && this.assignedPlayerNumber === null) {
      return;
    }

    if (["friend", "remote"].includes(this.currentGameMode)) {
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
  private handleKeyUp(key: string, sendInput: (type: string, data: PlayerInput) => void): void {
    this.keysPressed.delete(key);

    // Skip if waiting for opponent
    if (["friend", "remote"].includes(this.currentGameMode) && this.assignedPlayerNumber === null) {
      return;
    }

    if (["friend", "remote"].includes(this.currentGameMode)) {
      // ONLINE mode: only stop assigned player
      if (this.assignedPlayerNumber) {
        if (key === "arrowup" || key === "arrowdown") {
          if (this.keysPressed.has("arrowup")) {
            sendInput("playerInput", {
              player: this.assignedPlayerNumber,
              action: "up",
            });
          } else if (this.keysPressed.has("arrowdown")) {
            sendInput("playerInput", {
              player: this.assignedPlayerNumber,
              action: "down",
            });
          } else {
            sendInput("playerInput", {
              player: this.assignedPlayerNumber,
              action: "stop",
            });
          }
        }
      }
    } else {
      // LOCAL mode: stop both players
      // Player 1
      if (key === "s" || key === "x") {
        if (this.keysPressed.has("s")) {
          sendInput("playerInput", { player: 1, action: "up" });
        } else if (this.keysPressed.has("x")) {
          sendInput("playerInput", { player: 1, action: "down" });
        } else {
          sendInput("playerInput", { player: 1, action: "stop" });
        }
      }
      // Player 2
      if (key === "arrowup" || key === "arrowdown") {
        if (this.keysPressed.has("arrowup")) {
          sendInput("playerInput", { player: 2, action: "up" });
        } else if (this.keysPressed.has("arrowdown")) {
          sendInput("playerInput", { player: 2, action: "down" });
        } else {
          sendInput("playerInput", { player: 2, action: "stop" });
        }
      }
    }
  }

  private setupInputHandlers() {
    const sendInput = (type: string, data: PlayerInput) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type, data }));
      }
    };

    // Create and store keydown listener
    this.keydownListener = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      // Prevent arrow keys from scrolling the page
      if (key === "arrowup" || key === "arrowdown") {
        event.preventDefault();
      }
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

    if (this.gameState.isWaiting) {
      switch (this.currentGameMode) {
        case "remote": {
          this.ctx.fillStyle = "#fff";
          this.ctx.font = "bold 200px Arial";
          this.ctx.textAlign = "center";
          this.ctx.textBaseline = "middle";
          this.ctx.fillText(i18n.t("pong.waitingForOpponent"), width / 2, height / 2);
          break;
        }
        case "friend": {
          this.ctx.fillStyle = "#fff";
          this.ctx.font = "bold 150px Arial";
          this.ctx.textAlign = "center";
          this.ctx.textBaseline = "middle";
          this.ctx.fillText("Waiting for friend to join...", width / 2, height / 2);
          break;
        }
        case "tournament": {
          this.ctx.fillStyle = "#fff";
          this.ctx.font = "bold 150px Arial";
          this.ctx.textAlign = "center";
          this.ctx.textBaseline = "middle";
          this.ctx.fillText(i18n.t("pong.waitingForStart"), width / 2, height / 2);
          break;
        }
        default:
          break;
      }
    } else if (countdown && countdown > 0) {
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

  // (auto-reconnect follows main branch behavior; no explicit disable method)

  private startAuthCheck(): void {
    // Clear any existing interval
    this.stopAuthCheck();

    // Listen for storage changes (logout in another tab)
    this.storageListener = (event: StorageEvent) => {
      // Check if userId or username was removed (logout)
      if ((event.key === "userId" || event.key === "username") && event.newValue === null) {
        console.log("🚪 User logged out in another tab, closing game connection");
        this.stopAuthCheck();
        if (this.ws) {
          this.ws.close(1000, "user_logged_out");
        }
        this.destroy();
        window.location.href = "/";
      }
    };
    window.addEventListener("storage", this.storageListener);

    // Check auth status every 5 seconds (fallback if storage event missed)
    this.authCheckInterval = window.setInterval(() => {
      // Check both in-memory token AND localStorage (for cross-tab logout detection)
      const isAuth = SecureTokenManager.getInstance().isAuthenticated();
      const hasUserId = localStorage.getItem("userId") !== null;

      if (!isAuth || !hasUserId) {
        console.log("🚪 User logged out, closing game connection");
        this.stopAuthCheck();
        if (this.ws) {
          this.ws.close(1000, "user_logged_out");
        }
        this.destroy();
        window.location.href = "/";
      }
    }, 5000); // Check every 5 seconds
  }

  private stopAuthCheck(): void {
    if (this.authCheckInterval !== null) {
      clearInterval(this.authCheckInterval);
      this.authCheckInterval = null;
    }
    if (this.storageListener !== null) {
      window.removeEventListener("storage", this.storageListener);
      this.storageListener = null;
    }
  }

  private updateTournamentStatus(player1: string, player2: string): void {
    // Store current match players for language change updates
    this.currentMatchPlayers = { player1, player2 };

    const statusEl = document.getElementById("tournament-status");
    if (statusEl) {
      statusEl.textContent = `${i18n.t("tournament.currentMatch")}: ${player1} vs ${player2}`;
    }

    // Add this match to the bracket if not already present
    const existingMatch = this.tournamentMatches.find(
      (m) =>
        (m.player1 === player1 && m.player2 === player2) ||
        (m.player1 === player2 && m.player2 === player1)
    );

    if (!existingMatch) {
      // Determine round number based on number of completed matches
      const completedMatches = this.tournamentMatches.filter((m) => m.winner).length;
      const numPlayers = this.tournamentPlayers.length;

      // Calculate which round we're in
      let round = 1;
      let matchesInPreviousRounds = 0;
      let matchesPerRound = numPlayers / 2;

      while (completedMatches >= matchesInPreviousRounds + matchesPerRound) {
        matchesInPreviousRounds += matchesPerRound;
        matchesPerRound /= 2;
        round++;
      }

      this.currentRound = round;
      this.tournamentMatches.push({
        player1,
        player2,
        round,
        winner: undefined,
      });
      this.updateTournamentBracket();
    }
  }

  private recordTournamentWinner(player1: string, player2: string, winner: string): void {
    // Find the match
    const match = this.tournamentMatches.find(
      (m) =>
        (m.player1 === player1 && m.player2 === player2) ||
        (m.player1 === player2 && m.player2 === player1)
    );

    if (match) {
      match.winner = winner;
      this.updateTournamentBracket();
    }
  }

  private updateTournamentBracket(): void {
    const bracketEl = document.getElementById("tournament-bracket");
    const containerEl = document.getElementById("bracket-container");

    if (!bracketEl || !containerEl) return;

    if (this.currentGameMode !== "tournament" || this.tournamentPlayers.length === 0) {
      bracketEl.classList.add("hidden");
      return;
    }

    bracketEl.classList.remove("hidden");

    // Calculate number of rounds based on player count
    const numPlayers = this.tournamentPlayers.length;
    const numRounds = Math.log2(numPlayers);

    // Clear existing content
    containerEl.innerHTML = "";

    // Create main container
    const mainContainer = document.createElement("div");
    mainContainer.className =
      "flex flex-col sm:flex-row gap-4 sm:gap-8 items-center sm:items-center";

    // Group matches by round
    const matchesByRound: Array<Array<(typeof this.tournamentMatches)[0]>> = [];
    for (let r = 0; r < numRounds; r++) {
      matchesByRound[r] = this.tournamentMatches.filter((m) => m.round === r + 1);
    }

    // Render each round
    for (let round = 0; round < numRounds; round++) {
      const roundMatches = matchesByRound[round] || [];
      const roundLabel =
        round === numRounds - 1
          ? i18n.t("tournament.final")
          : round === numRounds - 2
            ? i18n.t("tournament.semiFinal")
            : `${i18n.t("tournament.round")} ${round + 1}`;

      // Only show rounds that have matches
      if (roundMatches.length === 0) continue;

      // Create round container
      const roundContainer = document.createElement("div");
      roundContainer.className = "flex flex-col gap-4 w-full sm:w-auto";

      // Create round label
      const roundLabelEl = document.createElement("h4");
      roundLabelEl.className = "text-neon-green text-center font-bold text-sm sm:text-base mb-2";
      roundLabelEl.textContent = roundLabel;
      roundContainer.appendChild(roundLabelEl);

      // Add matches
      for (const match of roundMatches) {
        roundContainer.appendChild(this.renderMatch(match));
      }

      mainContainer.appendChild(roundContainer);

      // Add connector arrows between rounds
      if (
        round < numRounds - 1 &&
        matchesByRound[round + 1] &&
        matchesByRound[round + 1].length > 0
      ) {
        const connectorDiv = document.createElement("div");
        connectorDiv.className = "flex items-center justify-center";

        const desktopArrow = document.createElement("div");
        desktopArrow.className = "text-neon-pink text-2xl sm:inline hidden";
        desktopArrow.textContent = "→";

        const mobileArrow = document.createElement("div");
        mobileArrow.className = "text-neon-pink text-2xl sm:hidden inline";
        mobileArrow.textContent = "↓";

        connectorDiv.appendChild(desktopArrow);
        connectorDiv.appendChild(mobileArrow);
        mainContainer.appendChild(connectorDiv);
      }
    }

    containerEl.appendChild(mainContainer);
  }

  private renderMatch(match: {
    player1: string;
    player2: string;
    winner?: string;
    round: number;
  }): HTMLElement {
    const isPlayer1Winner = match.winner === match.player1;
    const isPlayer2Winner = match.winner === match.player2;

    // Create match card
    const card = document.createElement("div");
    card.className = "glass-card p-3 sm:min-w-[150px] w-full sm:w-auto";

    const innerDiv = document.createElement("div");
    innerDiv.className = "flex flex-col gap-2";

    // Player 1
    const player1Div = document.createElement("div");
    player1Div.className = `text-sm sm:text-base ${isPlayer1Winner ? "text-neon-green font-bold" : "text-white"} ${isPlayer2Winner ? "opacity-50" : ""}`;
    player1Div.textContent = match.player1 + (isPlayer1Winner ? " ✓" : "");

    // Divider
    const divider = document.createElement("div");
    divider.className = "border-t border-neon-pink/30";

    // Player 2
    const player2Div = document.createElement("div");
    player2Div.className = `text-sm sm:text-base ${isPlayer2Winner ? "text-neon-green font-bold" : "text-white"} ${isPlayer1Winner ? "opacity-50" : ""}`;
    player2Div.textContent = match.player2 + (isPlayer2Winner ? " ✓" : "");

    innerDiv.appendChild(player1Div);
    innerDiv.appendChild(divider);
    innerDiv.appendChild(player2Div);
    card.appendChild(innerDiv);

    return card;
  }

  public destroy(): void {
    // Mark as destroyed to prevent reconnection
    this.isDestroyed = true;

    // Stop auth check
    this.stopAuthCheck();

    // Remove event listeners
    if (this.keydownListener) {
      document.removeEventListener("keydown", this.keydownListener);
    }
    if (this.keyupListener) {
      document.removeEventListener("keyup", this.keyupListener);
    }
    if (this.languageChangeListener) {
      window.removeEventListener("languageChanged", this.languageChangeListener);
    }

    // Clean up button listeners
    this.buttonListeners.forEach(({ element, event, handler, options }) => {
      element.removeEventListener(event, handler, options);
    });
    this.buttonListeners = [];

    this.ws?.close();
    this.ws = null;
    this.isConnected = false;
    console.log("🛑 Pong destroyed");
  }
}
