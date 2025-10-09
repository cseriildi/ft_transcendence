export interface GameState {
    field: { width: number; height: number };
    ball: { x: number; y: number; radius: number };
    paddle1: { cx?: number; cy?: number; capsule: Capsule };
    paddle2: { cx?: number; cy?: number; capsule: Capsule };
    score?: { player1: number; player2: number };
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

    constructor(canvasId: string, wsUrl: string) {
        const canvasEl = document.getElementById(canvasId);
        if (!canvasEl) throw new Error(`Canvas element with id "${canvasId}" not found.`);
        const canvas = canvasEl as HTMLCanvasElement;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not get 2D rendering context.");

        this.canvas = canvas;
        this.ctx = ctx;
        this.wsUrl = wsUrl;

        this.setupInputHandlers();
        this.connect();
        this.renderLoop();
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
                
                if (message.type === "gameSetup") {
                    // Store initial full state
                    this.gameState = message.data;
                    console.log("📦 Received game setup:", this.gameState);
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
                console.error("Error parsing game state:", err);
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

    private updateCapsule(paddle: { cx?: number; cy?: number; length?: number; capsule: Capsule }) {
        if (paddle.cx === undefined || paddle.cy === undefined || paddle.length === undefined) return;
        
        const halfLength = paddle.length / 2;
        paddle.capsule.x1 = paddle.cx;
        paddle.capsule.y1 = paddle.cy - halfLength;
        paddle.capsule.x2 = paddle.cx;
        paddle.capsule.y2 = paddle.cy + halfLength;
    }

    private updateScoreDisplay() {
        if (!this.gameState?.score) return;
        
        const score1El = document.getElementById('score-player1');
        const score2El = document.getElementById('score-player2');
        
        if (score1El) score1El.textContent = this.gameState.score.player1.toString();
        if (score2El) score2El.textContent = this.gameState.score.player2.toString();
    }

    private setupInputHandlers() {
        const sendInput = (type: string, data: any) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type, data }));
            }
        };

        document.addEventListener("keydown", (event) => {
            const key = event.key.toLowerCase();
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
        });

        document.addEventListener("keyup", (event) => {
            const key = event.key.toLowerCase();
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
        });
    }

    private renderLoop = () => {
        this.draw();
        requestAnimationFrame(this.renderLoop);
    };

    private draw() {
        if (!this.gameState) return;

        const { width, height } = this.canvas;
        const { field, ball, paddle1, paddle2, score } = this.gameState;

        // Clear canvas
        this.ctx.fillStyle = "#000";
        this.ctx.fillRect(0, 0, width, height);

        // Scaling
        const scaleX = width / field.width;
        const scaleY = height / field.height;
        const scale = Math.min(scaleX, scaleY);

        // Draw center line
        this.ctx.strokeStyle = "#00ffff";
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(width / 2, 0);
        this.ctx.lineTo(width / 2, height);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Draw ball
        this.ctx.fillStyle = "#ff00cc";
        this.ctx.beginPath();
        this.ctx.arc(ball.x * scale, ball.y * scale, ball.radius * scale, 0, Math.PI * 2);
        this.ctx.fill();

        // Draw paddles
        this.ctx.fillStyle = "#39ff14";
        this.drawCapsule(paddle1.capsule, scale);
        this.drawCapsule(paddle2.capsule, scale);

        // Draw scores
        if (score) {
            this.ctx.fillStyle = "#fff";
            this.ctx.font = "bold 24px Arial";
            this.ctx.textAlign = "center";
            this.ctx.textBaseline = "middle";
            this.ctx.fillText(score.player1.toString(), width / 4, 30);
            this.ctx.fillText(score.player2.toString(), (3 * width) / 4, 30);
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
        this.ws?.close();
        this.ws = null;
        this.isConnected = false;
        console.log("🛑 Pong destroyed");
    }
}