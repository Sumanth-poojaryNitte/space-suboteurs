// Nebula Station map layout.
// Coordinates are in world units. Rooms are axis-aligned rectangles used for
// collision, visibility ("which room am I in") and task/kill/report ranges.

const ROOMS = {
  cafeteria: { x: 700, y: 80, w: 500, h: 320 },
  reactor: { x: 60, y: 80, w: 320, h: 260 },
  electrical: { x: 60, y: 420, w: 300, h: 260 },
  medbay: { x: 460, y: 460, w: 260, h: 220 },
  security: { x: 820, y: 460, w: 240, h: 200 },
  navigation: { x: 1620, y: 120, w: 300, h: 260 },
  communications: { x: 1620, y: 460, w: 300, h: 240 },
  storage: { x: 1180, y: 460, w: 320, h: 260 },
  admin: { x: 1180, y: 80, w: 300, h: 260 },
};

// Corridors are just wider rectangles connecting rooms so movement isn't
// blocked between them. Collision is intentionally simple (AABB) for a v1.
const CORRIDORS = [
  { x: 380, y: 180, w: 320, h: 100 }, // reactor -> cafeteria
  { x: 360, y: 340, w: 60, h: 180 }, // reactor -> electrical
  { x: 360, y: 480, w: 100, h: 100 }, // electrical -> medbay
  { x: 720, y: 480, w: 100, h: 100 }, // medbay -> security
  { x: 900, y: 200, w: 280, h: 80 }, // cafeteria -> admin
  { x: 1480, y: 160, w: 140, h: 100 }, // admin -> navigation
  { x: 1060, y: 500, w: 120, h: 100 }, // security -> storage
  { x: 1500, y: 500, w: 120, h: 100 }, // storage -> communications
  { x: 1320, y: 340, w: 60, h: 140 }, // admin -> storage
];

const SPAWN_POINTS = [
  { x: 950, y: 240 },
  { x: 900, y: 200 },
  { x: 1000, y: 200 },
  { x: 950, y: 280 },
  { x: 900, y: 300 },
  { x: 1000, y: 300 },
  { x: 850, y: 240 },
  { x: 1050, y: 240 },
  { x: 850, y: 300 },
  { x: 1050, y: 300 },
];

// Tasks: id, room, position, type (used by client mini-game), duration (ms
// of "hold to complete" the server requires before marking done).
const TASK_DEFINITIONS = [
  { id: "reactor_calibrate", room: "reactor", x: 180, y: 200, type: "hold", duration: 3000, label: "Calibrate Reactor" },
  { id: "electrical_wires", room: "electrical", x: 180, y: 540, type: "sequence", duration: 2500, label: "Fix Wiring" },
  { id: "medbay_scan", room: "medbay", x: 580, y: 560, type: "hold", duration: 4000, label: "Submit Scan" },
  { id: "security_cams", room: "security", x: 930, y: 550, type: "hold", duration: 2000, label: "Review Cameras" },
  { id: "navigation_chart", room: "navigation", x: 1760, y: 220, type: "sequence", duration: 2500, label: "Chart Course" },
  { id: "comms_array", room: "communications", x: 1760, y: 560, type: "hold", duration: 3000, label: "Align Array" },
  { id: "storage_fuel", room: "storage", x: 1330, y: 560, type: "hold", duration: 2500, label: "Transfer Fuel" },
  { id: "admin_swipe", room: "admin", x: 1320, y: 180, type: "hold", duration: 1500, label: "Swipe Card" },
];

const SABOTAGE_TYPES = {
  oxygen: { label: "Oxygen", timerMs: 45000, fixRooms: ["cafeteria", "electrical"] },
  reactor: { label: "Reactor Meltdown", timerMs: 40000, fixRooms: ["reactor"] },
  electrical: { label: "Lights", timerMs: 60000, fixRooms: ["electrical"] },
  communications: { label: "Communications", timerMs: 60000, fixRooms: ["communications"] },
  doors: { label: "Doors", timerMs: 15000, fixRooms: [] },
};

function roomAt(x, y) {
  for (const [name, r] of Object.entries(ROOMS)) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return name;
  }
  return null;
}

function clampToWalkable(x, y) {
  // If the point isn't inside any room or corridor, push it back toward the
  // nearest known walkable rectangle center. Simple but effective for v1.
  const rects = [...Object.values(ROOMS), ...CORRIDORS];
  for (const r of rects) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      return { x, y };
    }
  }
  // Not walkable — clamp to nearest rect edge.
  let best = null;
  let bestDist = Infinity;
  for (const r of rects) {
    const cx = Math.max(r.x, Math.min(x, r.x + r.w));
    const cy = Math.max(r.y, Math.min(y, r.y + r.h));
    const d = (cx - x) ** 2 + (cy - y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = { x: cx, y: cy };
    }
  }
  return best || { x, y };
}

module.exports = {
  ROOMS,
  CORRIDORS,
  SPAWN_POINTS,
  TASK_DEFINITIONS,
  SABOTAGE_TYPES,
  roomAt,
  clampToWalkable,
};
