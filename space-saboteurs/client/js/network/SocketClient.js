// Thin wrapper around the Socket.IO client. Loaded via CDN script tag in
// index.html (window.io), so this file just wires it up and exposes a
// small promise-based emit() helper for ack-based calls.

export class SocketClient {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = window.io(this.url, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      this.socket.on("connect", () => resolve(this.socket));
      this.socket.on("connect_error", (err) => {
        if (!this._connectedOnce) reject(err);
      });
      this.socket.once("connect", () => {
        this._connectedOnce = true;
      });

      // Re-attach any listeners registered before connect() resolved.
      for (const [event, handlers] of this.listeners.entries()) {
        handlers.forEach((h) => this.socket.on(event, h));
      }
    });
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(handler);
    if (this.socket) this.socket.on(event, handler);
  }

  emit(event, payload) {
    if (!this.socket) return;
    this.socket.emit(event, payload);
  }

  // Promise-based emit for events that use an ack callback.
  request(event, payload, timeoutMs = 6000) {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error("Not connected"));
      const timer = setTimeout(() => reject(new Error("Request timed out")), timeoutMs);
      this.socket.emit(event, payload, (response) => {
        clearTimeout(timer);
        resolve(response);
      });
    });
  }

  get connected() {
    return !!(this.socket && this.socket.connected);
  }

  get id() {
    return this.socket ? this.socket.id : null;
  }
}
