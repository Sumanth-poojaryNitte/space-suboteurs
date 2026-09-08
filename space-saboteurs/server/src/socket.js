const RoomManager = require("./rooms/RoomManager");
const { isValidRoomCode, isValidName } = require("./validation/InputValidator");

// Very small per-socket rate limiter: max N events of a given type per window.
function makeRateLimiter(limit, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    arr.push(now);
    hits.set(key, arr);
    return arr.length <= limit;
  };
}

function attachSocketHandlers(io) {
  const roomManager = new RoomManager(io);
  const inputLimiter = makeRateLimiter(40, 1000); // ~40 input msgs/sec/socket ceiling
  const actionLimiter = makeRateLimiter(10, 1000); // kill/report/vote/etc
  const chatLimiter = makeRateLimiter(5, 3000);

  io.on("connection", (socket) => {
    let currentRoomId = null;
    let currentPlayerId = null;

    function room() {
      return currentRoomId ? roomManager.getRoom(currentRoomId) : null;
    }

    function broadcastState() {
      const r = room();
      if (!r) return;
      io.to(r.roomId).emit("game_state", r.publicSnapshot());
    }

    function sendPrivateState(playerId) {
      const r = room();
      if (!r) return;
      const priv = r.privateSnapshot(playerId);
      const p = r.players.get(playerId);
      if (p && p.socketId) io.to(p.socketId).emit("private_state", priv);
    }

    // ---- room lifecycle ----

    socket.on("create_room", ({ name }, ack) => {
      if (!isValidName(name)) return ack && ack({ error: "INVALID_NAME" });
      const r = roomManager.createRoom();
      const { player, error } = r.addPlayer({ name, socketId: socket.id });
      if (error) return ack && ack({ error });
      currentRoomId = r.roomId;
      currentPlayerId = player.id;
      socket.join(r.roomId);
      ack && ack({ ok: true, roomId: r.roomId, playerId: player.id, reconnectToken: player.reconnectToken });
      broadcastState();
    });

    socket.on("join_room", ({ roomId, name }, ack) => {
      if (!isValidRoomCode(roomId)) return ack && ack({ error: "INVALID_ROOM_CODE" });
      if (!isValidName(name)) return ack && ack({ error: "INVALID_NAME" });
      const r = roomManager.getRoom(roomId);
      if (!r) return ack && ack({ error: "ROOM_NOT_FOUND" });
      const { player, error } = r.addPlayer({ name, socketId: socket.id });
      if (error) return ack && ack({ error });
      currentRoomId = r.roomId;
      currentPlayerId = player.id;
      socket.join(r.roomId);
      ack && ack({ ok: true, roomId: r.roomId, playerId: player.id, reconnectToken: player.reconnectToken });
      io.to(r.roomId).emit("player_joined", { id: player.id, name: player.name });
      broadcastState();
    });

    socket.on("quick_play", ({ name }, ack) => {
      if (!isValidName(name)) return ack && ack({ error: "INVALID_NAME" });
      const r = roomManager.findQuickPlayRoom();
      const { player, error } = r.addPlayer({ name, socketId: socket.id });
      if (error) return ack && ack({ error });
      currentRoomId = r.roomId;
      currentPlayerId = player.id;
      socket.join(r.roomId);
      ack && ack({ ok: true, roomId: r.roomId, playerId: player.id, reconnectToken: player.reconnectToken });
      io.to(r.roomId).emit("player_joined", { id: player.id, name: player.name });
      broadcastState();
    });

    socket.on("reconnect_to_room", ({ roomId, reconnectToken }, ack) => {
      if (!isValidRoomCode(roomId)) return ack && ack({ error: "INVALID_ROOM_CODE" });
      const r = roomManager.getRoom(roomId);
      if (!r) return ack && ack({ error: "ROOM_NOT_FOUND" });
      const player = r.reconnectPlayer(reconnectToken, socket.id);
      if (!player) return ack && ack({ error: "RECONNECT_FAILED" });
      currentRoomId = r.roomId;
      currentPlayerId = player.id;
      socket.join(r.roomId);
      ack && ack({ ok: true, roomId: r.roomId, playerId: player.id });
      io.to(r.roomId).emit("system_message", { text: `${player.name} reconnected.`, at: Date.now() });
      broadcastState();
      sendPrivateState(player.id);
    });

    socket.on("leave_room", () => {
      const r = room();
      if (!r || !currentPlayerId) return;
      r.removePlayer(currentPlayerId);
      socket.leave(r.roomId);
      io.to(r.roomId).emit("player_left", { id: currentPlayerId });
      broadcastState();
      currentRoomId = null;
      currentPlayerId = null;
    });

    // ---- lobby ----

    socket.on("player_ready", ({ ready }) => {
      const r = room();
      if (!r || !currentPlayerId) return;
      r.setReady(currentPlayerId, ready);
      broadcastState();
    });

    socket.on("update_settings", (settings, ack) => {
      const r = room();
      if (!r || !currentPlayerId) return;
      const result = r.updateSettings(currentPlayerId, settings || {});
      ack && ack(result);
      broadcastState();
    });

    socket.on("start_game", (_, ack) => {
      const r = room();
      if (!r || !currentPlayerId) return;
      const result = r.startCountdown(currentPlayerId);
      ack && ack(result);
      if (result.ok) {
        broadcastState();
        // Send each player their private role/task state once the match begins.
        const checkInterval = setInterval(() => {
          if (r.phase === "PLAYING") {
            r.players.forEach((p) => sendPrivateState(p.id));
            clearInterval(checkInterval);
          } else if (r.phase === "LOBBY") {
            clearInterval(checkInterval);
          }
        }, 200);
      }
    });

    // ---- movement ----

    socket.on("player_input", ({ x, y }) => {
      if (!inputLimiter(socket.id)) return;
      const r = room();
      if (!r || !currentPlayerId) return;
      r.applyInput(currentPlayerId, x, y);
    });

    // ---- tasks ----

    socket.on("complete_task", ({ taskId }, ack) => {
      if (!actionLimiter(socket.id)) return ack && ack({ error: "RATE_LIMITED" });
      const r = room();
      if (!r || !currentPlayerId) return;
      const result = r.completeTask(currentPlayerId, taskId);
      ack && ack(result);
      if (result.ok) {
        io.to(r.roomId).emit("task_updated", { playerId: currentPlayerId, taskId, progress: r.taskProgress() });
      }
    });

    // ---- kill / report / meetings ----

    socket.on("kill_request", ({ targetId }, ack) => {
      if (!actionLimiter(socket.id)) return ack && ack({ error: "RATE_LIMITED" });
      const r = room();
      if (!r || !currentPlayerId) return;
      const result = r.requestKill(currentPlayerId, targetId);
      ack && ack(result.error ? result : { ok: true });
      if (result.ok) {
        io.to(r.roomId).emit("player_killed", { victimId: result.victim.id, victimName: result.victim.name });
        io.to(r.roomId).emit("body_created", result.body);
        sendPrivateState(currentPlayerId);
      }
    });

    socket.on("report_body", ({ bodyId }, ack) => {
      if (!actionLimiter(socket.id)) return ack && ack({ error: "RATE_LIMITED" });
      const r = room();
      if (!r || !currentPlayerId) return;
      const result = r.reportBody(currentPlayerId, bodyId);
      ack && ack(result);
      if (result.ok) {
        io.to(r.roomId).emit("meeting_started", r.publicSnapshot().meeting);
        broadcastState();
      }
    });

    socket.on("emergency_meeting", (_, ack) => {
      if (!actionLimiter(socket.id)) return ack && ack({ error: "RATE_LIMITED" });
      const r = room();
      if (!r || !currentPlayerId) return;
      const result = r.callEmergencyMeeting(currentPlayerId);
      ack && ack(result);
      if (result.ok) {
        io.to(r.roomId).emit("meeting_started", r.publicSnapshot().meeting);
        broadcastState();
      }
    });

    socket.on("submit_vote", ({ targetId }, ack) => {
      if (!actionLimiter(socket.id)) return ack && ack({ error: "RATE_LIMITED" });
      const r = room();
      if (!r || !currentPlayerId) return;
      const result = r.submitVote(currentPlayerId, targetId);
      ack && ack(result);
      if (result.ok) {
        io.to(r.roomId).emit("vote_updated", { votesCast: r.meeting ? r.meeting.votes.size : 0 });
      }
    });

    socket.on("meeting_chat", ({ text }, ack) => {
      if (!chatLimiter(socket.id)) return ack && ack({ error: "RATE_LIMITED" });
      const r = room();
      if (!r || !currentPlayerId) return;
      const result = r.submitChat(currentPlayerId, text);
      ack && ack(result);
      if (result.ok) {
        io.to(r.roomId).emit("meeting_chat", result.entry);
      }
    });

    // ---- sabotage ----

    socket.on("start_sabotage", ({ type }, ack) => {
      if (!actionLimiter(socket.id)) return ack && ack({ error: "RATE_LIMITED" });
      const r = room();
      if (!r || !currentPlayerId) return;
      const result = r.startSabotage(currentPlayerId, type);
      ack && ack(result.error ? result : { ok: true });
      if (result.ok) {
        io.to(r.roomId).emit("sabotage_started", r.publicSnapshot().sabotage);
      }
    });

    socket.on("repair_sabotage", ({ room: roomName }, ack) => {
      if (!actionLimiter(socket.id)) return ack && ack({ error: "RATE_LIMITED" });
      const r = room();
      if (!r || !currentPlayerId) return;
      const result = r.repairSabotage(currentPlayerId, roomName);
      ack && ack(result);
      if (result.ok) {
        if (result.resolved) {
          io.to(r.roomId).emit("sabotage_repaired", {});
        } else {
          io.to(r.roomId).emit("sabotage_updated", r.publicSnapshot().sabotage);
        }
      }
    });

    // ---- results / replay ----

    socket.on("play_again", (_, ack) => {
      const r = room();
      if (!r || !currentPlayerId) return;
      const result = r.playAgain(currentPlayerId);
      ack && ack(result);
      if (result.ok) broadcastState();
    });

    // ---- debug / connection quality ----

    socket.on("ping_check", (_, ack) => {
      ack && ack({ ok: true, serverTime: Date.now() });
    });

    // ---- disconnect ----

    socket.on("disconnect", () => {
      const r = room();
      if (!r || !currentPlayerId) return;
      r.removePlayer(currentPlayerId);
      io.to(r.roomId).emit("player_left", { id: currentPlayerId });
      broadcastState();
    });
  });

  // Drive countdown -> PLAYING private state push, and general periodic
  // full-state broadcast so late UI (task progress, sabotage timers) never
  // drifts even if an incremental event was missed.
  setInterval(() => {
    for (const r of roomManager.rooms.values()) {
      if (r.phase === "LOBBY" || r.phase === "MEETING" || r.phase === "COUNTDOWN") {
        io.to(r.roomId).emit("game_state", r.publicSnapshot());
      }
    }
  }, 1000);
}

module.exports = attachSocketHandlers;
