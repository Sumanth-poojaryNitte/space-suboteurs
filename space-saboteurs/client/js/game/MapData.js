// ============================================================
// SPACE SABOTEURS - REALISTIC MAP DATA
// Client-side rendering data.
// Server MapData.js must use the same room/corridor geometry.
// ============================================================

export const WORLD = {
  width: 2000,
  height: 800,
};

// ------------------------------------------------------------
// ROOMS
// ------------------------------------------------------------

export const ROOMS = {
  cafeteria: {
    x: 700,
    y: 80,
    w: 500,
    h: 320,
    label: "Cafeteria",
    theme: "cafeteria",
  },

  reactor: {
    x: 60,
    y: 80,
    w: 320,
    h: 260,
    label: "Reactor",
    theme: "reactor",
  },

  electrical: {
    x: 60,
    y: 420,
    w: 300,
    h: 260,
    label: "Electrical",
    theme: "electrical",
  },

  medbay: {
    x: 460,
    y: 460,
    w: 260,
    h: 220,
    label: "Medbay",
    theme: "medical",
  },

  security: {
    x: 820,
    y: 460,
    w: 240,
    h: 200,
    label: "Security",
    theme: "security",
  },

  navigation: {
    x: 1620,
    y: 120,
    w: 300,
    h: 260,
    label: "Navigation",
    theme: "navigation",
  },

  communications: {
    x: 1620,
    y: 460,
    w: 300,
    h: 240,
    label: "Communications",
    theme: "communications",
  },

  storage: {
    x: 1180,
    y: 460,
    w: 320,
    h: 260,
    label: "Storage",
    theme: "storage",
  },

  admin: {
    x: 1180,
    y: 80,
    w: 300,
    h: 260,
    label: "Command",
    theme: "admin",
  },
};

// ------------------------------------------------------------
// CORRIDORS
// ------------------------------------------------------------

export const CORRIDORS = [
  {
    id: "corridor_reactor_cafeteria",
    x: 380,
    y: 180,
    w: 320,
    h: 100,
    type: "horizontal",
  },

  {
    id: "corridor_reactor_electrical",
    x: 360,
    y: 340,
    w: 60,
    h: 180,
    type: "vertical",
  },

  {
    id: "corridor_electrical_medbay",
    x: 360,
    y: 480,
    w: 100,
    h: 100,
    type: "horizontal",
  },

  {
    id: "corridor_medbay_security",
    x: 720,
    y: 480,
    w: 100,
    h: 100,
    type: "horizontal",
  },

  {
    id: "corridor_cafeteria_admin",
    x: 900,
    y: 200,
    w: 280,
    h: 80,
    type: "horizontal",
  },

  {
    id: "corridor_admin_navigation",
    x: 1480,
    y: 160,
    w: 140,
    h: 100,
    type: "horizontal",
  },

  {
    id: "corridor_security_storage",
    x: 1060,
    y: 500,
    w: 120,
    h: 100,
    type: "horizontal",
  },

  {
    id: "corridor_storage_comms",
    x: 1500,
    y: 500,
    w: 120,
    h: 100,
    type: "horizontal",
  },

  {
    id: "corridor_admin_storage",
    x: 1320,
    y: 340,
    w: 60,
    h: 140,
    type: "vertical",
  },
];

// ------------------------------------------------------------
// DOORS
// ------------------------------------------------------------

export const DOORS = [
  {
    id: "door_reactor_cafeteria",
    x: 690,
    y: 210,
    w: 30,
    h: 70,
    orientation: "vertical",
    rooms: ["reactor", "cafeteria"],
  },

  {
    id: "door_reactor_electrical",
    x: 350,
    y: 335,
    w: 30,
    h: 45,
    orientation: "horizontal",
    rooms: ["reactor", "electrical"],
  },

  {
    id: "door_electrical_medbay",
    x: 440,
    y: 500,
    w: 40,
    h: 30,
    orientation: "horizontal",
    rooms: ["electrical", "medbay"],
  },

  {
    id: "door_medbay_security",
    x: 710,
    y: 500,
    w: 40,
    h: 30,
    orientation: "horizontal",
    rooms: ["medbay", "security"],
  },

  {
    id: "door_cafeteria_admin",
    x: 1165,
    y: 190,
    w: 35,
    h: 70,
    orientation: "vertical",
    rooms: ["cafeteria", "admin"],
  },

  {
    id: "door_admin_navigation",
    x: 1470,
    y: 175,
    w: 35,
    h: 70,
    orientation: "vertical",
    rooms: ["admin", "navigation"],
  },

  {
    id: "door_security_storage",
    x: 1050,
    y: 510,
    w: 35,
    h: 70,
    orientation: "vertical",
    rooms: ["security", "storage"],
  },

  {
    id: "door_storage_comms",
    x: 1490,
    y: 510,
    w: 35,
    h: 70,
    orientation: "vertical",
    rooms: ["storage", "communications"],
  },

  {
    id: "door_admin_storage",
    x: 1310,
    y: 330,
    w: 40,
    h: 35,
    orientation: "horizontal",
    rooms: ["admin", "storage"],
  },
];

// ------------------------------------------------------------
// WALL SEGMENTS
// Used only for realistic client rendering.
// Gameplay collision remains controlled by server geometry.
// ------------------------------------------------------------

export const WALLS = [
  // Reactor
  { x: 60, y: 80, w: 320, h: 14 },
  { x: 60, y: 326, w: 290, h: 14 },
  { x: 60, y: 80, w: 14, h: 260 },
  { x: 366, y: 80, w: 14, h: 100 },
  { x: 366, y: 280, w: 14, h: 60 },

  // Electrical
  { x: 60, y: 420, w: 300, h: 14 },
  { x: 60, y: 666, w: 300, h: 14 },
  { x: 60, y: 420, w: 14, h: 260 },
  { x: 346, y: 420, w: 14, h: 60 },
  { x: 346, y: 580, w: 14, h: 100 },

  // Medbay
  { x: 460, y: 460, w: 260, h: 14 },
  { x: 460, y: 666, w: 260, h: 14 },
  { x: 460, y: 460, w: 14, h: 20 },
  { x: 460, y: 560, w: 14, h: 120 },
  { x: 706, y: 460, w: 14, h: 20 },
  { x: 706, y: 560, w: 14, h: 120 },

  // Security
  { x: 820, y: 460, w: 240, h: 14 },
  { x: 820, y: 646, w: 240, h: 14 },
  { x: 820, y: 460, w: 14, h: 200 },
  { x: 1046, y: 460, w: 14, h: 200 },

  // Cafeteria
  { x: 700, y: 80, w: 500, h: 14 },
  { x: 700, y: 386, w: 500, h: 14 },
  { x: 700, y: 80, w: 14, h: 100 },
  { x: 700, y: 280, w: 14, h: 120 },
  { x: 1186, y: 80, w: 14, h: 100 },
  { x: 1186, y: 280, w: 14, h: 120 },

  // Admin
  { x: 1180, y: 80, w: 300, h: 14 },
  { x: 1180, y: 326, w: 130, h: 14 },
  { x: 1350, y: 326, w: 130, h: 14 },
  { x: 1180, y: 80, w: 14, h: 260 },
  { x: 1466, y: 80, w: 14, h: 80 },
  { x: 1466, y: 260, w: 14, h: 80 },

  // Navigation
  { x: 1620, y: 120, w: 300, h: 14 },
  { x: 1620, y: 366, w: 300, h: 14 },
  { x: 1620, y: 120, w: 14, h: 260 },
  { x: 1906, y: 120, w: 14, h: 260 },

  // Storage
  { x: 1180, y: 460, w: 320, h: 14 },
  { x: 1180, y: 706, w: 320, h: 14 },
  { x: 1180, y: 460, w: 14, h: 260 },
  { x: 1486, y: 460, w: 14, h: 40 },
  { x: 1486, y: 600, w: 14, h: 120 },

  // Communications
  { x: 1620, y: 460, w: 300, h: 14 },
  { x: 1620, y: 686, w: 300, h: 14 },
  { x: 1620, y: 460, w: 14, h: 240 },
  { x: 1906, y: 460, w: 14, h: 240 },
];

// ------------------------------------------------------------
// DECORATIVE / COLLISION-SAFE OBSTACLES
// ------------------------------------------------------------

export const OBSTACLES = [
  // Cafeteria tables
  { id: "caf_table_1", x: 790, y: 155, w: 115, h: 55, type: "table" },
  { id: "caf_table_2", x: 940, y: 155, w: 115, h: 55, type: "table" },
  { id: "caf_table_3", x: 790, y: 285, w: 115, h: 55, type: "table" },
  { id: "caf_table_4", x: 940, y: 285, w: 115, h: 55, type: "table" },

  // Reactor machinery
  { id: "reactor_core", x: 155, y: 145, w: 110, h: 110, type: "reactor" },
  { id: "reactor_console", x: 285, y: 170, w: 55, h: 75, type: "console" },

  // Electrical equipment
  { id: "electrical_panel_1", x: 100, y: 465, w: 65, h: 85, type: "panel" },
  { id: "electrical_panel_2", x: 250, y: 465, w: 65, h: 85, type: "panel" },
  { id: "electrical_generator", x: 125, y: 590, w: 150, h: 50, type: "generator" },

  // Medbay
  { id: "med_scanner", x: 540, y: 520, w: 100, h: 70, type: "scanner" },

  // Security consoles
  { id: "security_console", x: 865, y: 500, w: 150, h: 55, type: "console" },

  // Admin consoles
  { id: "admin_console_1", x: 1220, y: 130, w: 90, h: 55, type: "console" },
  { id: "admin_console_2", x: 1350, y: 130, w: 90, h: 55, type: "console" },

  // Storage crates
  { id: "storage_crates_1", x: 1215, y: 510, w: 70, h: 70, type: "crate" },
  { id: "storage_crates_2", x: 1300, y: 510, w: 70, h: 70, type: "crate" },
  { id: "storage_crates_3", x: 1215, y: 610, w: 70, h: 70, type: "crate" },

  // Navigation console
  { id: "nav_console", x: 1700, y: 160, w: 120, h: 65, type: "navigation" },

  // Communications
  { id: "communications_console", x: 1690, y: 510, w: 130, h: 60, type: "communications" },
];

// ------------------------------------------------------------
// CEILING LIGHTS
// ------------------------------------------------------------

export const LIGHTS = [
  { x: 120, y: 115, radius: 80, color: "cyan", intensity: 0.65 },
  { x: 300, y: 115, radius: 80, color: "cyan", intensity: 0.55 },

  { x: 470, y: 230, radius: 75, color: "white", intensity: 0.45 },

  { x: 780, y: 115, radius: 90, color: "white", intensity: 0.7 },
  { x: 950, y: 115, radius: 90, color: "white", intensity: 0.7 },
  { x: 1120, y: 115, radius: 75, color: "white", intensity: 0.6 },

  { x: 1250, y: 115, radius: 80, color: "blue", intensity: 0.55 },
  { x: 1400, y: 115, radius: 80, color: "blue", intensity: 0.55 },

  { x: 1680, y: 155, radius: 75, color: "blue", intensity: 0.65 },
  { x: 1840, y: 155, radius: 75, color: "blue", intensity: 0.65 },

  { x: 105, y: 445, radius: 70, color: "yellow", intensity: 0.45 },
  { x: 285, y: 445, radius: 70, color: "yellow", intensity: 0.45 },

  { x: 510, y: 485, radius: 70, color: "cyan", intensity: 0.65 },
  { x: 675, y: 485, radius: 70, color: "cyan", intensity: 0.55 },

  { x: 865, y: 485, radius: 70, color: "blue", intensity: 0.55 },
  { x: 1010, y: 485, radius: 70, color: "blue", intensity: 0.5 },

  { x: 1220, y: 485, radius: 75, color: "orange", intensity: 0.5 },
  { x: 1400, y: 485, radius: 75, color: "orange", intensity: 0.5 },

  { x: 1680, y: 485, radius: 75, color: "purple", intensity: 0.55 },
  { x: 1850, y: 485, radius: 75, color: "purple", intensity: 0.55 },
];

// ------------------------------------------------------------
// ROOM ACCENT COLORS
// ------------------------------------------------------------

export const ROOM_THEMES = {
  cafeteria: {
    floor: "#182331",
    floorAlt: "#1d2a3a",
    accent: "#55d6ff",
  },

  reactor: {
    floor: "#211b29",
    floorAlt: "#2a202f",
    accent: "#ff5f56",
  },

  electrical: {
    floor: "#25251d",
    floorAlt: "#2e2d23",
    accent: "#ffd166",
  },

  medbay: {
    floor: "#172b2d",
    floorAlt: "#1d3538",
    accent: "#55f5d0",
  },

  security: {
    floor: "#17202e",
    floorAlt: "#1d2939",
    accent: "#65a9ff",
  },

  navigation: {
    floor: "#18202d",
    floorAlt: "#202b3b",
    accent: "#7aa7ff",
  },

  communications: {
    floor: "#21192b",
    floorAlt: "#2b2037",
    accent: "#c77dff",
  },

  storage: {
    floor: "#28231b",
    floorAlt: "#302a20",
    accent: "#f0a64b",
  },

  admin: {
    floor: "#1b2430",
    floorAlt: "#23303e",
    accent: "#70b7ff",
  },
};

// ------------------------------------------------------------
// TASKS
// ------------------------------------------------------------

export const TASKS = [
  {
    id: "reactor_calibrate",
    room: "reactor",
    x: 180,
    y: 200,
    type: "hold",
    duration: 3000,
    label: "Calibrate Reactor",
  },

  {
    id: "electrical_wires",
    room: "electrical",
    x: 180,
    y: 540,
    type: "sequence",
    duration: 2500,
    label: "Fix Wiring",
  },

  {
    id: "medbay_scan",
    room: "medbay",
    x: 580,
    y: 560,
    type: "hold",
    duration: 4000,
    label: "Submit Scan",
  },

  {
    id: "security_cams",
    room: "security",
    x: 930,
    y: 550,
    type: "hold",
    duration: 2000,
    label: "Review Cameras",
  },

  {
    id: "navigation_chart",
    room: "navigation",
    x: 1760,
    y: 220,
    type: "sequence",
    duration: 2500,
    label: "Chart Course",
  },

  {
    id: "comms_array",
    room: "communications",
    x: 1760,
    y: 560,
    type: "hold",
    duration: 3000,
    label: "Align Array",
  },

  {
    id: "storage_fuel",
    room: "storage",
    x: 1330,
    y: 560,
    type: "hold",
    duration: 2500,
    label: "Transfer Fuel",
  },

  {
    id: "admin_swipe",
    room: "admin",
    x: 1320,
    y: 180,
    type: "hold",
    duration: 1500,
    label: "Swipe Card",
  },
];

// ------------------------------------------------------------
// SABOTAGE
// ------------------------------------------------------------

export const SABOTAGE_ROOMS = {
  oxygen: ["cafeteria", "electrical"],
  reactor: ["reactor"],
  electrical: ["electrical"],
  communications: ["communications"],
  doors: [],
};

// ------------------------------------------------------------
// SPAWN POINTS
// ------------------------------------------------------------

export const SPAWN_POINTS = [
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

// ------------------------------------------------------------
// ROOM DETECTION
// ------------------------------------------------------------

export function roomAt(x, y) {
  for (const [name, room] of Object.entries(ROOMS)) {
    if (
      x >= room.x &&
      x <= room.x + room.w &&
      y >= room.y &&
      y <= room.y + room.h
    ) {
      return name;
    }
  }

  return null;
}

// ------------------------------------------------------------
// WALKABLE AREA HELPER
// Client-side helper only.
// Server remains authoritative for collision.
// ------------------------------------------------------------

export function isWalkable(x, y) {
  const rectangles = [
    ...Object.values(ROOMS),
    ...CORRIDORS,
  ];

  return rectangles.some(
    (r) =>
      x >= r.x &&
      x <= r.x + r.w &&
      y >= r.y &&
      y <= r.y + r.h
  );
}

// ------------------------------------------------------------
// NEAREST ROOM
// ------------------------------------------------------------

export function nearestRoom(x, y) {
  let nearest = null;
  let nearestDistance = Infinity;

  for (const [name, room] of Object.entries(ROOMS)) {
    const centerX = room.x + room.w / 2;
    const centerY = room.y + room.h / 2;

    const distance = Math.hypot(
      x - centerX,
      y - centerY
    );

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = name;
    }
  }

  return nearest;
}