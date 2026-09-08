const {
  ROOMS,
  SPAWN_POINTS,
  TASK_DEFINITIONS,
  SABOTAGE_TYPES,
  roomAt,
  clampToWalkable,
} = require("../game/MapData");
const {
  MAX_PLAYER_SPEED,
  KILL_RANGE,
  REPORT_RANGE,
  TASK_RANGE,
  KILL_COOLDOWN_MS,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  clampMovementVector,
  distance,
} = require("../validation/InputValidator");

const PLAYER_COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6",
  "#e67e22", "#1abc9c", "#ecf0f1", "#e84393", "#95a5a6",
];

const TICK_RATE = 25; // server ticks per second
const TICK_MS = 1000 / TICK_RATE;
const MEETING_DURATION_MS = 45000;
const COUNTDOWN_MS = 5000;

function genPlayerId() {
  return "player_" + Math.random().toString(36).slice(2, 10);
}

function genReconnectToken() {
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}

class GameRoom {
  constructor(roomId, io) {
    this.roomId = roomId;
    this.io = io;
    this.players = new Map(); // id -> player
    this.hostId = null;
    this.phase = "LOBBY"; // LOBBY, COUNTDOWN, PLAYING, MEETING, RESULTS
    this.bodies = []; // { id, x, y, room, victimId, victimName }
    this.sabotage = null; // { type, startedAt, timerMs, fixedRooms:Set }
    this.meeting = null; // { calledBy, votes:Map, startedAt, chat:[] }
    this.winner = null;
    this.settings = {
      imposters: 1,
      killCooldownMs: KILL_COOLDOWN_MS,
      taskCount: 4,
      mapName: "Nebula Station",
    };
    this.countdownEndsAt = null;
    this.loopHandle = null;
    this.createdAt = Date.now();
    this._nextColorIdx = 0;
    this.startLoop();
  }

  // ---------- lifecycle ----------

  startLoop() {
    if (this.loopHandle) return;
    this.loopHandle = setInterval(() => this.tick(), TICK_MS);
  }

  destroy() {
    if (this.loopHandle) clearInterval(this.loopHandle);
    this.loopHandle = null;
  }

  isEmpty() {
    return [...this.players.values()].every((p) => !p.connected);
  }

  // ---------- player management ----------

  addPlayer({ name, socketId }) {
    if (this.players.size >= MAX_PLAYERS) {
      return { error: "ROOM_FULL" };
    }
    if (this.phase !== "LOBBY") {
      return { error: "GAME_ALREADY_STARTED" };
    }
    const nameTrimmed = name.trim().slice(0, 16);
    const taken = new Set([...this.players.values()].map((p) => p.name.toLowerCase()));
    let finalName = nameTrimmed;
    let suffix = 2;
    while (taken.has(finalName.toLowerCase())) {
      finalName = `${nameTrimmed}${suffix}`;
      suffix += 1;
    }

    const id = genPlayerId();
    const spawn = SPAWN_POINTS[this.players.size % SPAWN_POINTS.length];
    const player = {
      id,
      socketId,
      name: finalName,
      color: PLAYER_COLORS[this._nextColorIdx % PLAYER_COLORS.length],
      x: spawn.x,
      y: spawn.y,
      input: { x: 0, y: 0 },
      role: null,
      alive: true,
      isAI: false,
      tasks: [],
      connected: true,
      lastInputAt: Date.now(),
      killCooldownUntil: 0,
      ready: false,
      reconnectToken: genReconnectToken(),
      disconnectedAt: null,
    };
    this._nextColorIdx += 1;
    this.players.set(id, player);
    if (!this.hostId) this.hostId = id;
    return { player };
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) return;
    if (this.phase === "LOBBY") {
      this.players.delete(playerId);
    } else {
      // Mark inactive rather than deleting mid-match so state stays sane.
      player.connected = false;
      player.disconnectedAt = Date.now();
    }
    if (this.hostId === playerId) {
      this.migrateHost();
    }
  }

  migrateHost() {
    const next = [...this.players.values()].find((p) => p.connected);
    this.hostId = next ? next.id : null;
    if (next) {
      this.broadcastSystemMessage(`${next.name} is now the host.`);
    }
  }

  findPlayerBySocket(socketId) {
    return [...this.players.values()].find((p) => p.socketId === socketId);
  }

  reconnectPlayer(reconnectToken, newSocketId) {
    const player = [...this.players.values()].find((p) => p.reconnectToken === reconnectToken);
    if (!player) return null;
    player.socketId = newSocketId;
    player.connected = true;
    player.disconnectedAt = null;
    return player;
  }

  // ---------- lobby ----------

  setReady(playerId, ready) {
    const player = this.players.get(playerId);
    if (!player) return;
    player.ready = !!ready;
  }

  updateSettings(playerId, settings) {
    if (playerId !== this.hostId) return { error: "NOT_HOST" };
    if (this.phase !== "LOBBY") return { error: "GAME_ALREADY_STARTED" };
    const s = this.settings;
    if (Number.isInteger(settings.imposters)) {
      s.imposters = Math.max(1, Math.min(3, settings.imposters));
    }
    if (Number.isInteger(settings.killCooldownMs)) {
      s.killCooldownMs = Math.max(5000, Math.min(60000, settings.killCooldownMs));
    }
    if (Number.isInteger(settings.taskCount)) {
      s.taskCount = Math.max(2, Math.min(TASK_DEFINITIONS.length, settings.taskCount));
    }
    return { ok: true };
  }

  canStart(playerId) {
    if (playerId !== this.hostId) return { error: "NOT_HOST" };
    if (this.phase !== "LOBBY") return { error: "GAME_ALREADY_STARTED" };
    const connectedCount = [...this.players.values()].filter((p) => p.connected).length;
    if (connectedCount < MIN_PLAYERS_TO_START) return { error: "NOT_ENOUGH_PLAYERS" };
    if (this.settings.imposters >= connectedCount) return { error: "TOO_MANY_IMPOSTERS" };
    return { ok: true };
  }

  startCountdown(playerId) {
    const check = this.canStart(playerId);
    if (check.error) return check;
    this.phase = "COUNTDOWN";
    this.countdownEndsAt = Date.now() + COUNTDOWN_MS;
    return { ok: true };
  }

  beginMatch() {
    this.phase = "PLAYING";
    this.bodies = [];
    this.sabotage = null;
    this.meeting = null;
    this.winner = null;

    const connected = [...this.players.values()].filter((p) => p.connected);
    const shuffled = [...connected].sort(() => Math.random() - 0.5);
    const imposterCount = Math.min(this.settings.imposters, shuffled.length - 1);
    shuffled.forEach((p, i) => {
      p.role = i < imposterCount ? "IMPOSTER" : "CREWMATE";
      p.alive = true;
      p.killCooldownUntil = Date.now() + this.settings.killCooldownMs;
      const spawn = SPAWN_POINTS[i % SPAWN_POINTS.length];
      p.x = spawn.x;
      p.y = spawn.y;
      p.input = { x: 0, y: 0 };
      p.tasks = this.assignTasks();
    });
  }

  assignTasks() {
    const pool = [...TASK_DEFINITIONS].sort(() => Math.random() - 0.5).slice(0, this.settings.taskCount);
    return pool.map((t) => ({ id: t.id, completed: false }));
  }

  // ---------- movement ----------

  applyInput(playerId, x, y) {
    const player = this.players.get(playerId);
    if (!player || !player.connected) return;
    if (this.phase !== "PLAYING") return;
    if (!player.alive) return;
    player.input = clampMovementVector(x, y);
    player.lastInputAt = Date.now();
  }

  // ---------- tasks ----------

  completeTask(playerId, taskId) {
    if (this.phase !== "PLAYING") return { error: "WRONG_PHASE" };
    const player = this.players.get(playerId);
    if (!player || !player.alive) return { error: "INVALID_PLAYER" };
    const task = player.tasks.find((t) => t.id === taskId);
    if (!task) return { error: "TASK_NOT_ASSIGNED" };
    if (task.completed) return { error: "ALREADY_COMPLETE" };
    const def = TASK_DEFINITIONS.find((t) => t.id === taskId);
    if (!def) return { error: "UNKNOWN_TASK" };
    if (distance(player, def) > TASK_RANGE) return { error: "TOO_FAR" };
    task.completed = true;
    return { ok: true };
  }

  taskProgress() {
    const crew = [...this.players.values()].filter((p) => p.role === "CREWMATE");
    let total = 0;
    let done = 0;
    crew.forEach((p) => {
      total += p.tasks.length;
      done += p.tasks.filter((t) => t.completed).length;
    });
    return { total, done };
  }

  // ---------- kill ----------

  requestKill(playerId, targetId) {
    if (this.phase !== "PLAYING") return { error: "WRONG_PHASE" };
    const killer = this.players.get(playerId);
    const target = this.players.get(targetId);
    if (!killer || !target) return { error: "INVALID_PLAYER" };
    if (killer.role !== "IMPOSTER") return { error: "NOT_IMPOSTER" };
    if (!killer.alive) return { error: "DEAD" };
    if (!target.alive) return { error: "TARGET_DEAD" };
    if (target.id === killer.id) return { error: "SELF_TARGET" };
    if (Date.now() < killer.killCooldownUntil) return { error: "ON_COOLDOWN" };
    if (distance(killer, target) > KILL_RANGE) return { error: "TOO_FAR" };

    target.alive = false;
    killer.killCooldownUntil = Date.now() + this.settings.killCooldownMs;
    const body = {
      id: "body_" + Math.random().toString(36).slice(2, 8),
      x: target.x,
      y: target.y,
      room: roomAt(target.x, target.y),
      victimId: target.id,
      victimName: target.name,
    };
    this.bodies.push(body);
    return { ok: true, body, victim: target };
  }

  // ---------- report ----------

  reportBody(playerId, bodyId) {
    if (this.phase !== "PLAYING") return { error: "WRONG_PHASE" };
    const reporter = this.players.get(playerId);
    if (!reporter || !reporter.alive) return { error: "INVALID_PLAYER" };
    const body = this.bodies.find((b) => b.id === bodyId);
    if (!body) return { error: "BODY_NOT_FOUND" };
    if (distance(reporter, body) > REPORT_RANGE) return { error: "TOO_FAR" };
    this.startMeeting(reporter, `${reporter.name} reported ${body.victimName}'s body.`);
    return { ok: true };
  }

  callEmergencyMeeting(playerId) {
    if (this.phase !== "PLAYING") return { error: "WRONG_PHASE" };
    const caller = this.players.get(playerId);
    if (!caller || !caller.alive) return { error: "INVALID_PLAYER" };
    this.startMeeting(caller, `${caller.name} called an emergency meeting.`);
    return { ok: true };
  }

  startMeeting(caller, reason) {
    this.phase = "MEETING";
    this.meeting = {
      calledBy: caller.id,
      reason,
      votes: new Map(),
      startedAt: Date.now(),
      durationMs: MEETING_DURATION_MS,
      chat: [],
    };
  }

  submitVote(playerId, targetId) {
    if (this.phase !== "MEETING" || !this.meeting) return { error: "NO_MEETING" };
    const voter = this.players.get(playerId);
    if (!voter || !voter.alive) return { error: "INVALID_VOTER" };
    if (this.meeting.votes.has(playerId)) return { error: "ALREADY_VOTED" };
    if (targetId !== "skip") {
      const target = this.players.get(targetId);
      if (!target || !target.alive) return { error: "INVALID_TARGET" };
    }
    this.meeting.votes.set(playerId, targetId);
    return { ok: true };
  }

  submitChat(playerId, text) {
    if (this.phase !== "MEETING" || !this.meeting) return { error: "NO_MEETING" };
    const player = this.players.get(playerId);
    if (!player) return { error: "INVALID_PLAYER" };
    const clean = String(text).slice(0, 200).trim();
    if (!clean) return { error: "EMPTY" };
    const entry = { playerId, name: player.name, text: clean, at: Date.now() };
    this.meeting.chat.push(entry);
    if (this.meeting.chat.length > 100) this.meeting.chat.shift();
    return { ok: true, entry };
  }

  resolveMeeting() {
    if (!this.meeting) return null;
    const tally = new Map();
    for (const target of this.meeting.votes.values()) {
      tally.set(target, (tally.get(target) || 0) + 1);
    }
    let ejectedId = null;
    let topCount = 0;
    let tie = false;
    for (const [target, count] of tally.entries()) {
      if (count > topCount) {
        topCount = count;
        ejectedId = target;
        tie = false;
      } else if (count === topCount) {
        tie = true;
      }
    }
    let ejectedPlayer = null;
    if (!tie && ejectedId && ejectedId !== "skip") {
      const player = this.players.get(ejectedId);
      if (player) {
        player.alive = false;
        ejectedPlayer = player;
      }
    }
    const result = { ejectedPlayer, tie, votes: Object.fromEntries(this.meeting.votes) };
    this.meeting = null;
    this.bodies = [];
    this.phase = "PLAYING";
    return result;
  }

  // ---------- sabotage ----------

  startSabotage(playerId, type) {
    if (this.phase !== "PLAYING") return { error: "WRONG_PHASE" };
    const player = this.players.get(playerId);
    if (!player || player.role !== "IMPOSTER" || !player.alive) return { error: "NOT_IMPOSTER" };
    if (this.sabotage) return { error: "ALREADY_ACTIVE" };
    const def = SABOTAGE_TYPES[type];
    if (!def) return { error: "UNKNOWN_SABOTAGE" };
    this.sabotage = {
      type,
      startedAt: Date.now(),
      timerMs: def.timerMs,
      fixedRooms: new Set(),
    };
    return { ok: true, def };
  }

  repairSabotage(playerId, roomName) {
    if (!this.sabotage) return { error: "NONE_ACTIVE" };
    const player = this.players.get(playerId);
    if (!player || !player.alive) return { error: "INVALID_PLAYER" };
    const def = SABOTAGE_TYPES[this.sabotage.type];
    const playerRoom = roomAt(player.x, player.y);
    if (!def.fixRooms.includes(playerRoom)) return { error: "WRONG_LOCATION" };
    this.sabotage.fixedRooms.add(playerRoom);
    const complete = def.fixRooms.every((r) => this.sabotage.fixedRooms.has(r));
    if (complete) {
      this.sabotage = null;
      return { ok: true, resolved: true };
    }
    return { ok: true, resolved: false };
  }

  // ---------- win conditions ----------

  checkWinConditions() {
    if (this.phase !== "PLAYING" || this.winner) return null;

    const alive = [...this.players.values()].filter((p) => p.connected && p.role);
    const aliveCrew = alive.filter((p) => p.alive && p.role === "CREWMATE");
    const aliveImposters = alive.filter((p) => p.alive && p.role === "IMPOSTER");

    if (aliveImposters.length === 0) {
      return this.endGame("CREWMATES", "All imposters were eliminated.");
    }
    if (aliveImposters.length >= aliveCrew.length) {
      return this.endGame("IMPOSTERS", "Imposters equal or outnumber the crew.");
    }
    const { total, done } = this.taskProgress();
    if (total > 0 && done >= total) {
      return this.endGame("CREWMATES", "All tasks completed.");
    }
    if (this.sabotage) {
      const def = SABOTAGE_TYPES[this.sabotage.type];
      const elapsed = Date.now() - this.sabotage.startedAt;
      const isFatal = this.sabotage.type === "oxygen" || this.sabotage.type === "reactor";
      if (isFatal && elapsed >= def.timerMs) {
        return this.endGame("IMPOSTERS", `${def.label} sabotage was not fixed in time.`);
      }
    }
    return null;
  }

  endGame(winner, reason) {
    this.phase = "RESULTS";
    this.winner = winner;
    this.winReason = reason;
    this.sabotage = null;
    this.meeting = null;
    return { winner, reason };
  }

  playAgain(playerId) {
    if (playerId !== this.hostId) return { error: "NOT_HOST" };
    this.phase = "LOBBY";
    this.winner = null;
    this.bodies = [];
    this.sabotage = null;
    this.meeting = null;
    this.players.forEach((p) => {
      p.role = null;
      p.alive = true;
      p.tasks = [];
      p.ready = false;
      p.killCooldownUntil = 0;
    });
    return { ok: true };
  }

  // ---------- tick ----------

  tick() {
    const now = Date.now();

    if (this.phase === "COUNTDOWN" && this.countdownEndsAt && now >= this.countdownEndsAt) {
      this.beginMatch();
      this.io.to(this.roomId).emit("game_state", this.publicSnapshot());
      return;
    }

    if (this.phase === "PLAYING") {
      const dt = TICK_MS / 1000;
      this.players.forEach((p) => {
        if (!p.connected || !p.alive || !p.role) return;
        const speed = MAX_PLAYER_SPEED * dt;
        const nx = p.x + p.input.x * speed;
        const ny = p.y + p.input.y * speed;
        const clamped = clampToWalkable(nx, ny);
        p.x = clamped.x;
        p.y = clamped.y;
      });

      const winResult = this.checkWinConditions();
      if (winResult) {
        this.io.to(this.roomId).emit("game_over", this.resultsSnapshot());
        return;
      }
    }

    if (this.phase === "MEETING" && this.meeting) {
      const elapsed = now - this.meeting.startedAt;
      const aliveCount = [...this.players.values()].filter((p) => p.connected && p.alive).length;
      const allVoted = this.meeting.votes.size >= aliveCount;
      if (elapsed >= this.meeting.durationMs || allVoted) {
        const result = this.resolveMeeting();
        this.io.to(this.roomId).emit("voting_results", result && {
          ejectedName: result.ejectedPlayer ? result.ejectedPlayer.name : null,
          ejectedRole: result.ejectedPlayer ? result.ejectedPlayer.role : null,
          tie: result.tie,
        });
        const winResult = this.checkWinConditions();
        if (winResult) {
          this.io.to(this.roomId).emit("game_over", this.resultsSnapshot());
          return;
        }
        this.io.to(this.roomId).emit("game_state", this.publicSnapshot());
        return;
      }
    }

    // Broadcast a lightweight movement snapshot during active play.
    if (this.phase === "PLAYING") {
      this.io.to(this.roomId).emit("player_moved", this.movementSnapshot());
    }
  }

  // ---------- snapshots (never leak hidden info) ----------

  movementSnapshot() {
    return [...this.players.values()]
      .filter((p) => p.connected)
      .map((p) => ({ id: p.id, x: p.x, y: p.y, alive: p.alive }));
  }

  publicSnapshot() {
    return {
      roomId: this.roomId,
      phase: this.phase,
      hostId: this.hostId,
      settings: this.settings,
      countdownEndsAt: this.countdownEndsAt,
      serverTime: Date.now(),
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        x: p.x,
        y: p.y,
        alive: p.alive,
        connected: p.connected,
        ready: p.ready,
        taskCount: p.tasks.length,
        tasksDone: p.tasks.filter((t) => t.completed).length,
      })),
      bodies: this.bodies.map((b) => ({ id: b.id, x: b.x, y: b.y, room: b.room, victimName: b.victimName })),
      sabotage: this.sabotage
        ? {
            type: this.sabotage.type,
            label: SABOTAGE_TYPES[this.sabotage.type].label,
            startedAt: this.sabotage.startedAt,
            timerMs: this.sabotage.timerMs,
            fixedRooms: [...this.sabotage.fixedRooms],
            fixRoomsNeeded: SABOTAGE_TYPES[this.sabotage.type].fixRooms,
          }
        : null,
      meeting: this.meeting
        ? {
            calledBy: this.meeting.calledBy,
            reason: this.meeting.reason,
            startedAt: this.meeting.startedAt,
            durationMs: this.meeting.durationMs,
            votesCast: this.meeting.votes.size,
            chat: this.meeting.chat,
          }
        : null,
      taskProgress: this.taskProgress(),
    };
  }

  // Private, per-player view: includes their own role + task list only.
  privateSnapshot(playerId) {
    const player = this.players.get(playerId);
    if (!player) return null;
    return {
      role: player.role,
      tasks: player.tasks,
      killCooldownUntil: player.killCooldownUntil,
      killRange: KILL_RANGE,
      reportRange: REPORT_RANGE,
      taskRange: TASK_RANGE,
    };
  }

  resultsSnapshot() {
    return {
      winner: this.winner,
      reason: this.winReason,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        alive: p.alive,
        tasksDone: p.tasks.filter((t) => t.completed).length,
        taskCount: p.tasks.length,
      })),
    };
  }

  broadcastSystemMessage(text) {
    this.io.to(this.roomId).emit("system_message", { text, at: Date.now() });
  }
}

module.exports = GameRoom;
