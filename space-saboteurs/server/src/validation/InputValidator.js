// Central place for anti-cheat / validation constants and helpers.
// Every gameplay action from a client passes through here before it's
// allowed to change GameState.

const MAX_PLAYER_SPEED = 260; // world units per second
const KILL_RANGE = 90;
const REPORT_RANGE = 140;
const TASK_RANGE = 70;
const KILL_COOLDOWN_MS = 20000;
const MAX_PLAYERS = 10;
const MIN_PLAYERS_TO_START = 4;

function clampMovementVector(x, y) {
  let vx = Number(x);
  let vy = Number(y);
  if (!Number.isFinite(vx)) vx = 0;
  if (!Number.isFinite(vy)) vy = 0;
  vx = Math.max(-1, Math.min(1, vx));
  vy = Math.max(-1, Math.min(1, vy));
  const mag = Math.hypot(vx, vy);
  if (mag > 1) {
    vx /= mag;
    vy /= mag;
  }
  return { x: vx, y: vy };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isValidRoomCode(code) {
  return typeof code === "string" && /^[A-Z0-9]{6}$/.test(code);
}

function isValidName(name) {
  return typeof name === "string" && name.trim().length >= 1 && name.trim().length <= 16;
}

module.exports = {
  MAX_PLAYER_SPEED,
  KILL_RANGE,
  REPORT_RANGE,
  TASK_RANGE,
  KILL_COOLDOWN_MS,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  clampMovementVector,
  distance,
  isValidRoomCode,
  isValidName,
};
