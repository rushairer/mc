import { WebSocketServer } from 'ws';
import { GameServer } from './GameServer';

const PORT = parseInt(process.env.PORT || '8080');
const wss = new WebSocketServer({ port: PORT });

// Standalone server with default seed 98765
const gameServer = new GameServer(98765, true);
gameServer.start();

console.log(`Minecraft Clone Multiplayer Server is running on ws://localhost:${PORT}`);

wss.on('connection', (ws, req) => {
  // Extract query parameters like username
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const username = url.searchParams.get('username') || `Guest_${Math.floor(Math.random() * 9000 + 1000)}`;

  console.log(`Player connected: ${username} (IP: ${req.socket.remoteAddress})`);

  // Adapt the standard ws WebSocket to our protocol's clientSocket shape
  const clientSocket = {
    get readyState() {
      // ws: 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED
      return ws.readyState;
    },
    send: (data: string) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    },
    onmessage: null as ((event: { data: string }) => void) | null,
    onclose: null as (() => void) | null
  };

  ws.on('message', (message) => {
    if (clientSocket.onmessage) {
      clientSocket.onmessage({ data: message.toString() });
    }
  });

  ws.on('close', () => {
    console.log(`Player disconnected: ${username}`);
    if (clientSocket.onclose) {
      clientSocket.onclose();
    }
  });

  ws.on('error', (err) => {
    console.error(`Socket error for player ${username}:`, err);
  });

  gameServer.addPlayer(clientSocket, username, false);
});
