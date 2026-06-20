type Callback = (event: any) => void;

export class MockWebSocket {
  url: string;
  readyState: number = 0; // 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED
  
  onopen: Callback | null = null;
  onclose: Callback | null = null;
  onerror: Callback | null = null;
  onmessage: Callback | null = null;

  peer?: MockWebSocket;

  constructor(url: string) {
    this.url = url;
  }

  send(data: string) {
    if (this.readyState !== 1) {
      console.warn("Attempted to send message on non-open mock socket, state:", this.readyState);
      return;
    }
    // Deliver asynchronously to simulate network layer
    setTimeout(() => {
      if (this.peer && this.peer.readyState === 1 && this.peer.onmessage) {
        this.peer.onmessage({ data });
      }
    }, 0);
  }

  close() {
    if (this.readyState >= 2) return;
    this.readyState = 2; // CLOSING
    
    setTimeout(() => {
      this.readyState = 3; // CLOSED
      if (this.onclose) {
        this.onclose({ code: 1000, reason: "Normal closure", wasClean: true });
      }

      if (this.peer) {
        const peer = this.peer;
        this.peer = undefined;
        peer.peer = undefined;
        peer.close();
      }
    }, 0);
  }
}

/**
 * Creates a pair of interconnected MockWebSocket instances.
 * One for the client, one for the server.
 */
export function createMockConnectionPair(url: string): { clientSocket: MockWebSocket; serverSocket: MockWebSocket } {
  const clientSocket = new MockWebSocket(url);
  const serverSocket = new MockWebSocket(url);

  clientSocket.peer = serverSocket;
  serverSocket.peer = clientSocket;

  // Open the connection asynchronously
  setTimeout(() => {
    clientSocket.readyState = 1; // OPEN
    serverSocket.readyState = 1; // OPEN

    if (clientSocket.onopen) {
      clientSocket.onopen({});
    }
    if (serverSocket.onopen) {
      serverSocket.onopen({});
    }
  }, 10);

  return { clientSocket, serverSocket };
}
