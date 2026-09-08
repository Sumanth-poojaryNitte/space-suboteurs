// Holds the latest data received from the server and interpolates remote
// player positions so movement looks smooth even though updates only
// arrive ~25 times/sec. The LOCAL player is rendered from its own
// predicted position for responsiveness; everyone else is interpolated.

const INTERP_SPEED = 14; // higher = snappier catch-up to server truth

export class NetworkState {
  constructor() {
    this.roomId = null;
    this.playerId = null;
    this.phase = "LOBBY";
    this.hostId = null;
    this.settings = {};
    this.serverTimeOffset = 0; // serverTime - Date.now(), for countdowns/timers
    this.players = new Map(); // id -> { name, color, alive, connected, renderX, renderY, targetX, targetY, ready, taskCount, tasksDone }
    this.bodies = [];
    this.sabotage = null;
    this.meeting = null;
    this.taskProgress = { total: 0, done: 0 };
    this.privateState = { role: null, tasks: [], killCooldownUntil: 0, killRange: 90, reportRange: 140, taskRange: 70 };
    this.ping = 0;
  }

  applyFullState(state) {
    this.roomId = state.roomId;
    this.phase = state.phase;
    this.hostId = state.hostId;
    this.settings = state.settings;
    this.countdownEndsAt = state.countdownEndsAt;
    this.serverTimeOffset = state.serverTime - Date.now();
    this.bodies = state.bodies;
    this.sabotage = state.sabotage;
    this.meeting = state.meeting;
    this.taskProgress = state.taskProgress;

    const seen = new Set();
    state.players.forEach((p) => {
      seen.add(p.id);
      const existing = this.players.get(p.id);
      if (existing) {
        Object.assign(existing, p);
        existing.targetX = p.x;
        existing.targetY = p.y;
      } else {
        this.players.set(p.id, { ...p, renderX: p.x, renderY: p.y, targetX: p.x, targetY: p.y });
      }
    });
    for (const id of this.players.keys()) {
      if (!seen.has(id)) this.players.delete(id);
    }
  }

  applyMovementSnapshot(list) {
    list.forEach((m) => {
      const p = this.players.get(m.id);
      if (!p) return;
      p.targetX = m.x;
      p.targetY = m.y;
      p.alive = m.alive;
    });
  }

  applyPrivateState(state) {
    this.privateState = state;
  }

  // Called every render frame to ease remote (and local, post-correction)
  // positions toward their latest server target.
  step(dtSeconds) {
    const t = Math.min(1, INTERP_SPEED * dtSeconds);
    this.players.forEach((p) => {
      p.renderX += (p.targetX - p.renderX) * t;
      p.renderY += (p.targetY - p.renderY) * t;
    });
  }

  get me() {
    return this.players.get(this.playerId);
  }

  serverNow() {
    return Date.now() + this.serverTimeOffset;
  }
}
