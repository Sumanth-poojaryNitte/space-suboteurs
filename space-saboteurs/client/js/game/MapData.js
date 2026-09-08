// Mirrors server/src/game/MapData.js. This copy is for RENDERING ONLY —
// the server is the source of truth for collision and positions. If you
// change room layout, update both files together.

export const WORLD = { width: 2000, height: 800 };

export const ROOMS = {
  cafeteria: { x: 700, y: 80, w: 500, h: 320, label: "Cafeteria" },
  reactor: { x: 60, y: 80, w: 320, h: 260, label: "Reactor" },
  electrical: { x: 60, y: 420, w: 300, h: 260, label: "Electrical" },
  medbay: { x: 460, y: 460, w: 260, h: 220, label: "Medbay" },
  security: { x: 820, y: 460, w: 240, h: 200, label: "Security" },
  navigation: { x: 1620, y: 120, w: 300, h: 260, label: "Navigation" },
  communications: { x: 1620, y: 460, w: 300, h: 240, label: "Comms" },
  storage: { x: 1180, y: 460, w: 320, h: 260, label: "Storage" },
  admin: { x: 1180, y: 80, w: 300, h: 260, label: "Admin" },
};

export const CORRIDORS = [
  { x: 380, y: 180, w: 320, h: 100 },
  { x: 360, y: 340, w: 60, h: 180 },
  { x: 360, y: 480, w: 100, h: 100 },
  { x: 720, y: 480, w: 100, h: 100 },
  { x: 900, y: 200, w: 280, h: 80 },
  { x: 1480, y: 160, w: 140, h: 100 },
  { x: 1060, y: 500, w: 120, h: 100 },
  { x: 1500, y: 500, w: 120, h: 100 },
  { x: 1320, y: 340, w: 60, h: 140 },
];

export const TASKS = [
  { id: "reactor_calibrate", room: "reactor", x: 180, y: 200, type: "hold", duration: 3000, label: "Calibrate Reactor" },
  { id: "electrical_wires", room: "electrical", x: 180, y: 540, type: "sequence", duration: 2500, label: "Fix Wiring" },
  { id: "medbay_scan", room: "medbay", x: 580, y: 560, type: "hold", duration: 4000, label: "Submit Scan" },
  { id: "security_cams", room: "security", x: 930, y: 550, type: "hold", duration: 2000, label: "Review Cameras" },
  { id: "navigation_chart", room: "navigation", x: 1760, y: 220, type: "sequence", duration: 2500, label: "Chart Course" },
  { id: "comms_array", room: "communications", x: 1760, y: 560, type: "hold", duration: 3000, label: "Align Array" },
  { id: "storage_fuel", room: "storage", x: 1330, y: 560, type: "hold", duration: 2500, label: "Transfer Fuel" },
  { id: "admin_swipe", room: "admin", x: 1320, y: 180, type: "hold", duration: 1500, label: "Swipe Card" },
];

export const SABOTAGE_ROOMS = {
  oxygen: ["cafeteria", "electrical"],
  reactor: ["reactor"],
  electrical: ["electrical"],
  communications: ["communications"],
  doors: [],
};

export function roomAt(x, y) {
  for (const [name, r] of Object.entries(ROOMS)) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return name;
  }
  return null;
}
