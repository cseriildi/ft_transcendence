import { Router } from "../router/Router.js";
import { getUserId } from "../utils/utils.js";

export class Chat {
    private router: Router;
    private ws: WebSocket | null = null;

    constructor(router: Router) {
        this.router = router;
    }

    initPage(): void {
        const chatForm = document.getElementById("chat-form") as HTMLFormElement;
        const chatInput = document.getElementById("chat-input") as HTMLInputElement;
        const chatBox = document.getElementById("chat-box") as HTMLDivElement;
        const backBtn = document.getElementById("back-btn");

        const urlParams = new URLSearchParams(window.location.search);
        const chatId = urlParams.get('chatId'); // Extract chat ID from the URL

        if (!chatId) {
            console.error("Chat ID is missing in the URL");
            return;
        }

        // Establish WebSocket connection
        this.connectWebSocket(chatBox);

        chatForm?.addEventListener("submit", (e) => {
            e.preventDefault();
            const message = chatInput.value.trim();
            if (message && this.ws && this.ws.readyState === WebSocket.OPEN) {
                // Send message via WebSocket with chat ID
                this.ws.send(JSON.stringify({ action: "send_message", chatid: chatId, message }));

                // Display the message in the chat box
                const messageElement = document.createElement("div");
                messageElement.textContent = `You: ${message}`;
                messageElement.classList.add("text-white", "mb-2");
                chatBox.appendChild(messageElement);
                chatInput.value = "";
            }
        });

        backBtn?.addEventListener("click", () => {
            this.ws?.close();
            this.router.navigate("/profile");
        });
    }

    private connectWebSocket(chatBox: HTMLDivElement): void {
        const urlParams = new URLSearchParams(window.location.search);
        // const username = urlParams.get('username'); // Extracts 'user' from the URL
        const chatId = urlParams.get('chatId'); // Extracts 'id' from the URL
        this.ws = new WebSocket(`ws://localhost:3002/ws?userId=${getUserId()}&username=${getUserId()}`);

        this.ws.onopen = () => {
            console.log("Connected to WebSocket server");

            // Send join_chat action with chat ID
            // const chatId = urlParams.get('chatId');
            if (chatId) {
                this.ws?.send(JSON.stringify({ action: "join_chat", chatid: chatId }));
                console.log(`Sent join_chat action for chat ID: ${chatId}`);
            } else {
                console.error("Chat ID is missing in the URL");
            }
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === "chat_connected") {
                // Display chat history
                if (data.history && Array.isArray(data.history)) {
                    data.history.forEach((message: { username: string; message: string; timestamp: number }) => {
                        const messageElement = document.createElement("div");
                        const timestamp = new Date(message.timestamp).toLocaleTimeString();
                        messageElement.textContent = `[${timestamp}] ${message.username}: ${message.message}`;
                        messageElement.classList.add("text-neon-green", "mb-2");
                        chatBox.appendChild(messageElement);
                    });
                }
            } else if (data.type === "message") {
                // Display new incoming message
                const messageElement = document.createElement("div");
                const timestamp = new Date(data.timestamp).toLocaleTimeString();
                messageElement.textContent = `[${timestamp}] ${data.username}: ${data.message}`;
                messageElement.classList.add("text-neon-green", "mb-2");
                chatBox.appendChild(messageElement);
            }
        };

        this.ws.onclose = () => {
            console.log("Disconnected from WebSocket server");
        };

        this.ws.onerror = (error) => {
            console.error("WebSocket error:", error);
        };
    }
}

export default Chat;