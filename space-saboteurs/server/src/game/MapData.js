// ============================================================
// SPACE SABOTEURS - AUTHORITATIVE MAP DATA
// Server-side collision, rooms, tasks and spawn geometry.
// ============================================================

const WORLD = {
  width: 2000,
  height: 800,
};

// ------------------------------------------------------------
// ROOMS
// ------------------------------------------------------------

const ROOMS = {
  cafeteria: {
    x: 700,
    y: 80,
    w: 500,
    h: 320,
    label: "Cafeteria",
  },

  reactor: {
    x: 60,
    y: 80,
    w: 320,
    h: 260,
    label: "Reactor",
  },

  electrical: {
    x: 60,
    y: 420,
    w: 300,
    h: 260,
    label: "Electrical",
  },

  medbay: {
    x: 460,
    y: 460,
    w: 260,
    h: 220,
    label: "Medbay",
  },

  security: {
    x: 820,
    y: 460,
    w: 240,
    h: 200,
    label: "Security",
  },

  navigation: {
    x: 1620,
    y: 120,
    w: 300,
    h: 260,
    label: "Navigation",
  },

  communications: {
    x: 1620,
    y: 460,
    w: 300,
    h: 240,
    label: "Communications",
  },

  storage: {
    x: 1180,
    y: 460,
    w: 320,
    h: 260,
    label: "Storage",
  },

  admin: {
    x: 1180,
    y: 80,
    w: 300,
    h: 260,
    label: "Command",
  },
};

// ------------------------------------------------------------
// CORRIDORS
// ------------------------------------------------------------

const CORRIDORS = [
  {
    id: "corridor_reactor_cafeteria",
    x: 380,
    y: 180,
    w: 320,
    h: 100,
  },

  {
    id: "corridor_reactor_electrical",
    x: 360,
    y: 340,
    w: 60,
    h: 180,
  },

  {
    id: "corridor_electrical_medbay",
    x: 360,
    y: 480,
    w: 100,
    h: 100,
  },

  {
    id: "corridor_medbay_security",
    x: 720,
    y: 480,
    w: 100,
    h: 100,
  },

  {
    id: "corridor_cafeteria_admin",
    x: 900,
    y: 200,
    w: 280,
    h: 80,
  },

  {
    id: "corridor_admin_navigation",
    x: 1480,
    y: 160,
    w: 140,
    h: 100,
  },

  {
    id: "corridor_security_storage",
    x: 1060,
    y: 500,
    w: 120,
    h: 100,
  },

  {
    id: "corridor_storage_comms",
    x: 1500,
    y: 500,
    w: 120,
    h: 100,
  },

  {
    id: "corridor_admin_storage",
    x: 1320,
    y: 340,
    w: 60,
    h: 140,
  },
];

// ------------------------------------------------------------
// OBSTACLES
// These are authoritative collision objects.
// ------------------------------------------------------------

const OBSTACLES = [
  // Cafeteria tables
  {
    id: "caf_table_1",
    x: 790,
    y: 155,
    w: 115,
    h: 55,
    type: "table",
  },

  {
    id: "caf_table_2",
    x: 940,
    y: 155,
    w: 115,
    h: 55,
    type: "table",
  },

  {
    id: "caf_table_3",
    x: 790,
    y: 285,
    w: 115,
    h: 55,
    type: "table",
  },

  {
    id: "caf_table_4",
    x: 940,
    y: 285,
    w: 115,
    h: 55,
    type: "table",
  },

  // Reactor
  {
    id: "reactor_core",
    x: 155,
    y: 145,
    w: 110,
    h: 110,
    type: "reactor",
  },

  {
    id: "reactor_console",
    x: 285,
    y: 170,
    w: 55,
    h: 75,
    type: "console",
  },

  // Electrical
  {
    id: "electrical_panel_1",
    x: 100,
    y: 465,
    w: 65,
    h: 85,
    type: "panel",
  },

  {
    id: "electrical_panel_2",
    x: 250,
    y: 465,
    w: 65,
    h: 85,
    type: "panel",
  },

  {
    id: "electrical_generator",
    x: 125,
    y: 590,
    w: 150,
    h: 50,
    type: "generator",
  },

  // Medbay
  {
    id: "med_scanner",
    x: 540,
    y: 520,
    w: 100,
    h: 70,
    type: "scanner",
  },

  // Security
  {
    id: "security_console",
    x: 865,
    y: 500,
    w: 150,
    h: 55,
    type: "console",
  },

  // Admin
  {
    id: "admin_console_1",
    x: 1220,
    y: 130,
    w: 90,
    h: 55,
    type: "console",
  },

  {
    id: "admin_console_2",
    x: 1350,
    y: 130,
    w: 90,
    h: 55,
    type: "console",
  },

  // Storage
  {
    id: "storage_crate_1",
    x: 1215,
    y: 510,
    w: 70,
    h: 70,
    type: "crate",
  },

  {
    id: "storage_crate_2",
    x: 1300,
    y: 510,
    w: 70,
    h: 70,
    type: "crate",
  },

  {
    id: "storage_crate_3",
    x: 1215,
    y: 610,
    w: 70,
    h: 70,
    type: "crate",
  },

  // Navigation
  {
    id: "navigation_console",
    x: 1700,
    y: 160,
    w: 120,
    h: 65,
    type: "navigation",
  },

  // Communications
  {
    id: "communications_console",
    x: 1690,
    y: 510,
    w: 130,
    h: 60,
    type: "communications",
  },
];

// ------------------------------------------------------------
// DOORS
// ------------------------------------------------------------

const DOORS = [
  {
    id: "door_reactor",
    x: 380,
    y: 214,
    w: 24,
    h: 32,
    orientation: "vertical",
    roomA: "reactor",
    roomB: "corridor",
  },

  {
    id: "door_cafeteria_w",
    x: 690,
    y: 214,
    w: 24,
    h: 32,
    orientation: "vertical",
    roomA: "cafeteria",
    roomB: "corridor",
  },

  {
    id: "door_cafeteria_e",
    x: 1168,
    y: 214,
    w: 24,
    h: 32,
    orientation: "vertical",
    roomA: "cafeteria",
    roomB: "corridor",
  },

  {
    id: "door_admin",
    x: 1470,
    y: 194,
    w: 24,
    h: 32,
    orientation: "vertical",
    roomA: "admin",
    roomB: "corridor",
  },

  {
    id: "door_nav",
    x: 1610,
    y: 194,
    w: 24,
    h: 32,
    orientation: "vertical",
    roomA: "navigation",
    roomB: "corridor",
  },

  {
    id: "door_medbay",
    x: 560,
    y: 448,
    w: 34,
    h: 24,
    orientation: "horizontal",
    roomA: "medbay",
    roomB: "corridor",
  },

  {
    id: "door_security",
    x: 900,
    y: 448,
    w: 34,
    h: 24,
    orientation: "horizontal",
    roomA: "security",
    roomB: "corridor",
  },

  {
    id: "door_storage",
    x: 1320,
    y: 448,
    w: 24,
    h: 32,
    orientation: "vertical",
    roomA: "storage",
    roomB: "corridor",
  },

  {
    id: "door_comms",
    x: 1610,
    y: 540,
    w: 24,
    h: 32,
    orientation: "vertical",
    roomA: "communications",
    roomB: "corridor",
  },
];

// ------------------------------------------------------------
// PLAYER SPAWN POINTS
// ------------------------------------------------------------

const SPAWN_POINTS = [
  {
    x: 950,
    y: 240,
  },

  {
    x: 900,
    y: 200,
  },

  {
    x: 1000,
    y: 200,
  },

  {
    x: 950,
    y: 280,
  },

  {
    x: 900,
    y: 300,
  },

  {
    x: 1000,
    y: 300,
  },

  {
    x: 850,
    y: 240,
  },

  {
    x: 1050,
    y: 240,
  },

  {
    x: 850,
    y: 300,
  },

  {
    x: 1050,
    y: 300,
  },
];

// ------------------------------------------------------------
// TASK DEFINITIONS
// ------------------------------------------------------------

const TASK_DEFINITIONS = [
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
// SABOTAGE TYPES
// ------------------------------------------------------------

const SABOTAGE_TYPES = {
  oxygen: {
    label: "Oxygen",
    timerMs: 45000,
    fixRooms: [
      "cafeteria",
      "electrical",
    ],
  },

  reactor: {
    label: "Reactor Meltdown",
    timerMs: 40000,
    fixRooms: [
      "reactor",
    ],
  },

  electrical: {
    label: "Lights",
    timerMs: 60000,
    fixRooms: [
      "electrical",
    ],
  },

  communications: {
    label: "Communications",
    timerMs: 60000,
    fixRooms: [
      "communications",
    ],
  },

  doors: {
    label: "Doors",
    timerMs: 15000,
    fixRooms: [],
  },
};

// ------------------------------------------------------------
// GEOMETRY HELPERS
// ------------------------------------------------------------

function pointInRect(
  x,
  y,
  rect
) {
  return (
    x >= rect.x &&
    x <= rect.x + rect.w &&
    y >= rect.y &&
    y <= rect.y + rect.h
  );
}

function roomAt(x, y) {
  for (
    const [name, room] of Object.entries(ROOMS)
  ) {
    if (
      pointInRect(
        x,
        y,
        room
      )
    ) {
      return name;
    }
  }

  return null;
}

// ------------------------------------------------------------
// WALKABLE CHECK
// ------------------------------------------------------------

function walkableAt(
  x,
  y,
  radius = 0
) {
  const playableAreas = [
    ...Object.values(ROOMS),
    ...CORRIDORS,
  ];

  const insidePlayableArea =
    playableAreas.some(
      (rect) =>
        x >= rect.x + radius &&
        x <= rect.x + rect.w - radius &&
        y >= rect.y + radius &&
        y <= rect.y + rect.h - radius
    );

  if (!insidePlayableArea) {
    return false;
  }

  const touchingObstacle =
    OBSTACLES.some(
      (obstacle) =>
        x + radius > obstacle.x &&
        x - radius <
          obstacle.x + obstacle.w &&
        y + radius > obstacle.y &&
        y - radius <
          obstacle.y + obstacle.h
    );

  if (touchingObstacle) {
    return false;
  }

  return true;
}

// ------------------------------------------------------------
// CLAMP PLAYER INTO WALKABLE SPACE
// ------------------------------------------------------------

function clampToWalkable(
  x,
  y,
  radius = 14
) {
  if (
    walkableAt(
      x,
      y,
      radius
    )
  ) {
    return {
      x,
      y,
    };
  }

  const candidates = [];

  const step = 8;

  for (
    let i = 1;
    i <= 14;
    i++
  ) {
    const distance =
      i * step;

    candidates.push(
      {
        x: x - distance,
        y,
      },
      {
        x: x + distance,
        y,
      },
      {
        x,
        y: y - distance,
      },
      {
        x,
        y: y + distance,
      },
      {
        x: x - distance,
        y: y - distance,
      },
      {
        x: x + distance,
        y: y - distance,
      },
      {
        x: x - distance,
        y: y + distance,
      },
      {
        x: x + distance,
        y: y + distance,
      }
    );
  }

  let best = null;

  let bestDistance =
    Infinity;

  for (
    const candidate of candidates
  ) {
    if (
      !walkableAt(
        candidate.x,
        candidate.y,
        radius
      )
    ) {
      continue;
    }

    const distance =
      (candidate.x - x) ** 2 +
      (candidate.y - y) ** 2;

    if (
      distance <
      bestDistance
    ) {
      bestDistance =
        distance;

      best = candidate;
    }
  }

  if (best) {
    return best;
  }

  return {
    x,
    y,
  };
}

// ------------------------------------------------------------
// COLLISION-AWARE MOVEMENT
// Allows sliding along walls/objects.
// ------------------------------------------------------------

function resolvePlayerMovement(
  x,
  y,
  nx,
  ny,
  radius = 14
) {
  let resolvedX = x;
  let resolvedY = y;

  // Horizontal movement

  if (
    walkableAt(
      nx,
      y,
      radius
    )
  ) {
    resolvedX = nx;
  }

  // Vertical movement

  if (
    walkableAt(
      resolvedX,
      ny,
      radius
    )
  ) {
    resolvedY = ny;
  }

  return clampToWalkable(
    resolvedX,
    resolvedY,
    radius
  );
}

// ------------------------------------------------------------
// EXPORTS
// ------------------------------------------------------------

module.exports = {
  WORLD,
  ROOMS,
  CORRIDORS,
  OBSTACLES,
  DOORS,
  SPAWN_POINTS,
  TASK_DEFINITIONS,
  SABOTAGE_TYPES,
  roomAt,
  walkableAt,
  clampToWalkable,
  resolvePlayerMovement,
};