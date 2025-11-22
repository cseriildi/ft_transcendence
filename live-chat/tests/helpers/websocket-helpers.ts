import WebSocket from "ws";

/**
 * Wait for a WebSocket message with timeout
 */
export function waitForMessage(ws: WebSocket, timeout = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("Timeout waiting for message"));
    }, timeout);

    ws.once("message", (data) => {
      clearTimeout(timeoutId);
      try {
        resolve(JSON.parse(data.toString()));
      } catch (err) {
        resolve(data.toString());
      }
    });
  });
}

/**
 * Close WebSocket gracefully
 */
export function closeWebSocket(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }
    ws.once("close", () => resolve());
    ws.close();
  });
}

/**
 * Create a WebSocket client
 */
export function createWebSocketClient(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

/**
 * Wait for WebSocket open and async auth to complete
 */
export function waitForAuthenticatedConnection(ws: WebSocket, timeout = 1000): Promise<void> {
  return new Promise((resolve, reject) => {
    let opened = false;

    const timeoutId = setTimeout(() => {
      if (opened && ws.readyState === WebSocket.OPEN) {
        // Connection opened and stayed open - auth succeeded
        resolve();
      } else if (opened) {
        // Connection opened but then closed - auth failed
        reject(new Error("Connection closed after opening (auth failed)"));
      } else {
        // Never opened
        reject(new Error("Connection timeout - never opened"));
      }
    }, timeout);

    ws.once("open", () => {
      opened = true;
      // Don't resolve immediately - wait for timeout to ensure auth completes
    });

    ws.once("close", () => {
      clearTimeout(timeoutId);
      if (opened) {
        reject(new Error("Connection closed after opening (auth failed)"));
      } else {
        reject(new Error("Connection closed before opening"));
      }
    });

    ws.once("error", (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

/**
 * Connect and join a chat room
 */
export async function connectAndJoinChat(
  serverAddress: string,
  userId: string,
  chatId: string
): Promise<WebSocket> {
  const ws = new WebSocket(`${serverAddress}/ws?userId=${userId}`);

  await new Promise((resolve, reject) => {
    ws.on("open", resolve);
    ws.on("error", reject);
  });

  // Send join_chat action
  ws.send(JSON.stringify({ action: "join_chat", chatid: chatId }));

  // Wait for chat_connected message
  await waitForMessage(ws);

  return ws;
}
