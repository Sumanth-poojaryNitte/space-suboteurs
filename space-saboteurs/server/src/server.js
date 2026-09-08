const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const attachSocketHandlers = require("./socket");

const PORT = process.env.PORT || 3001;
// Comma-separated list of allowed origins, e.g.
// "http://localhost:3000,https://space-saboteurs.vercel.app"
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";
const allowedOrigins = CLIENT_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);

const app = express();
app.get("/health", (req, res) => res.json({ ok: true, uptime: process.uptime() }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

attachSocketHandlers(io);

server.listen(PORT, () => {
  console.log(`Space Saboteurs game server listening on :${PORT}`);
  console.log(`Allowed client origins: ${allowedOrigins.join(", ")}`);
});
