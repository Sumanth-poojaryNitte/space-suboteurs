// ============================================================
// SPACE SABOTEURS - AUTHORITATIVE MAP DATA
// Server-side collision, rooms, corridors, tasks and geometry.
// ============================================================

const WORLD = {
  width: 2000,
  height: 800,
};

// ============================================================
// ROOMS
// ============================================================

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

// ============================================================
// CORRIDORS
//
// IMPORTANT:
//
// Corridors intentionally overlap the room boundaries.
// This gives the player's collision circle enough space to
// pass through doorways instead of getting stuck at the edge
// where two rectangles only touch.
//
// The overlap is approximately 30-40 world units.
// ============================================================

const CORRIDORS = [
  // Reactor <-> Cafeteria
  {
    id: "corridor_reactor_cafeteria",
    x: 350,
    y: 175,
    w: 380,
    h: 110,
    type: "horizontal",
  },

  // Reactor <-> Electrical
  {
    id: "corridor_reactor_electrical",
    x: 345,
    y: 315,
    w: 80,
    h: 215,
    type: "vertical",
  },

  // Electrical <-> Medbay
  {
    id: "corridor_electrical_medbay",
    x: 330,
    y: 475,
    w: 165,
    h: 110,
    type: "horizontal",
  },

  // Medbay <-> Security
  {
    id: "corridor_medbay_security",
    x: 700,
    y: 475,
    w: 155,
    h: 110,
    type: "horizontal",
  },

  // Cafeteria <-> Admin
  {
    id: "corridor_cafeteria_admin",
    x: 895,
    y: 190,
    w: 325,
    h: 100,
    type: "horizontal",
  },

  // Admin <-> Navigation
  {
    id: "corridor_admin_navigation",
    x: 1450,
    y: 150,
    w: 205,
    h: 120,
    type: "horizontal",
  },

  // Security <-> Storage
  {
    id: "corridor_security_storage",
    x: 1045,
    y: 485,
    w: 165,
    h: 115,
    type: "horizontal",
  },

  // Storage <-> Communications
  {
    id: "corridor_storage_comms",
    x: 1485,
    y: 485,
    w: 170,
    h: 115,
    type: "horizontal",
  },

  // Admin <-> Storage
  {
    id: "corridor_admin_storage",
    x: 1300,
    y: 315,
    w: 100,
    h: 175,
    type: "vertical",
  },
];

// ============================================================
// OBSTACLES
// ============================================================

const OBSTACLES = [
  // Cafeteria
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

// ============================================================
// DOORS
//
// Doors are primarily used by the renderer/game UI.
// Collision is handled by the connected room/corridor
// geometry above.
// ============================================================

const DOORS = [
  {
    id: "door_reactor",
    x: 370,
    y: 210,
    w: 35,
    h: 40,
    orientation: "vertical",
    roomA: "reactor",
    roomB: "corridor_reactor_cafeteria",
  },

  {
    id: "door_cafeteria_w",
    x: 690,
    y: 210,
    w: 35,
    h: 40,
    orientation: "vertical",
    roomA: "cafeteria",
    roomB: "corridor_reactor_cafeteria",
  },

  {
    id: "door_cafeteria_admin",
    x: 1165,
    y: 210,
    w: 35,
    h: 40,
    orientation: "vertical",
    roomA: "cafeteria",
    roomB: "corridor_cafeteria_admin",
  },

  {
    id: "door_admin_navigation",
    x: 1465,
    y: 190,
    w: 40,
    h: 40,
    orientation: "vertical",
    roomA: "admin",
    roomB: "corridor_admin_navigation",
  },

  {
    id: "door_navigation",
    x: 1605,
    y: 190,
    w: 35,
    h: 40,
    orientation: "vertical",
    roomA: "navigation",
    roomB: "corridor_admin_navigation",
  },

  {
    id: "door_reactor_electrical",
    x: 350,
    y: 325,
    w: 40,
    h: 35,
    orientation: "horizontal",
    roomA: "reactor",
    roomB: "corridor_reactor_electrical",
  },

  {
    id: "door_electrical_medbay",
    x: 445,
    y: 495,
    w: 40,
    h: 35,
    orientation: "horizontal",
    roomA: "electrical",
    roomB: "corridor_electrical_medbay",
  },

  {
    id: "door_medbay_security",
    x: 705,
    y: 495,
    w: 40,
    h: 35,
    orientation: "horizontal",
    roomA: "medbay",
    roomB: "corridor_medbay_security",
  },

  {
    id: "door_security_storage",
    x: 1045,
    y: 515,
    w: 40,
    h: 35,
    orientation: "vertical",
    roomA: "security",
    roomB: "corridor_security_storage",
  },

  {
    id: "door_storage_comms",
    x: 1485,
    y: 515,
    w: 40,
    h: 35,
    orientation: "vertical",
    roomA: "storage",
    roomB: "corridor_storage_comms",
  },

  {
    id: "door_admin_storage",
    x: 1325,
    y: 330,
    w: 45,
    h: 35,
    orientation: "horizontal",
    roomA: "admin",
    roomB: "corridor_admin_storage",
  },
];

// ============================================================
// SPAWN POINTS
// ============================================================

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

// ============================================================
// TASK DEFINITIONS
// ============================================================

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

// ============================================================
// SABOTAGE TYPES
// ============================================================

const SABOTAGE_TYPES = {
  oxygen: {
    label: "Oxygen",
    timerMs: 45000,
    fixRooms: ["cafeteria", "electrical"],
  },

  reactor: {
    label: "Reactor Meltdown",
    timerMs: 40000,
    fixRooms: ["reactor"],
  },

  electrical: {
    label: "Lights",
    timerMs: 60000,
    fixRooms: ["electrical"],
  },

  communications: {
    label: "Communications",
    timerMs: 60000,
    fixRooms: ["communications"],
  },

  doors: {
    label: "Doors",
    timerMs: 15000,
    fixRooms: [],
  },
};

// ============================================================
// GEOMETRY HELPERS
// ============================================================

function pointInRect(x, y, rect) {
  return (
    x >= rect.x &&
    x <= rect.x + rect.w &&
    y >= rect.y &&
    y <= rect.y + rect.h
  );
}

// Checks whether the entire player circle fits inside a rectangle.
function rectContainsCircle(rect, x, y, radius) {
  return (
    x - radius >= rect.x &&
    x + radius <= rect.x + rect.w &&
    y - radius >= rect.y &&
    y + radius <= rect.y + rect.h
  );
}

// Checks whether a circle intersects a rectangle.
function circleIntersectsRect(x, y, radius, rect) {
  const closestX = Math.max(
    rect.x,
    Math.min(x, rect.x + rect.w)
  );

  const closestY = Math.max(
    rect.y,
    Math.min(y, rect.y + rect.h)
  );

  const dx = x - closestX;
  const dy = y - closestY;

  return (
    dx * dx + dy * dy <
    radius * radius
  );
}

// ============================================================
// ROOM LOOKUP
// ============================================================

function roomAt(x, y) {
  for (const [name, room] of Object.entries(ROOMS)) {
    if (pointInRect(x, y, room)) {
      return name;
    }
  }

  return null;
}

// ============================================================
// ALL WALKABLE AREAS
// ============================================================

function getWalkableAreas() {
  return [
    ...Object.values(ROOMS),
    ...CORRIDORS,
  ];
}

// ============================================================
// WALKABLE CHECK
//
// A position is walkable when:
//
// 1. The complete player circle is inside at least one
//    room/corridor area.
//
// 2. The player circle does not collide with an obstacle.
//
// Because corridors overlap room boundaries, players can
// smoothly transition between connected areas.
// ============================================================

function walkableAt(x, y, radius = 14) {
  const playableAreas =
    getWalkableAreas();

  const insidePlayableArea =
    playableAreas.some((rect) =>
      rectContainsCircle(
        rect,
        x,
        y,
        radius
      )
    );

  if (!insidePlayableArea) {
    return false;
  }

  // Prevent walking through station obstacles.
  for (const obstacle of OBSTACLES) {
    if (
      circleIntersectsRect(
        x,
        y,
        radius,
        obstacle
      )
    ) {
      return false;
    }
  }

  return true;
}

// ============================================================
// CLAMP TO WALKABLE
//
// Used when a player somehow starts or ends up in an invalid
// location. Searches nearby for the closest valid location.
// ============================================================

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

  const maxDistance = 180;
  const step = 4;

  let best = null;
  let bestDistance = Infinity;

  for (
    let distance = step;
    distance <= maxDistance;
    distance += step
  ) {
    const candidates = [
      { x: x - distance, y },
      { x: x + distance, y },
      { x, y: y - distance },
      { x, y: y + distance },

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
      },
    ];

    for (const candidate of candidates) {
      if (
        !walkableAt(
          candidate.x,
          candidate.y,
          radius
        )
      ) {
        continue;
      }

      const dx =
        candidate.x - x;

      const dy =
        candidate.y - y;

      const distanceSquared =
        dx * dx +
        dy * dy;

      if (
        distanceSquared <
        bestDistance
      ) {
        bestDistance =
          distanceSquared;

        best = candidate;
      }
    }

    if (best) {
      break;
    }
  }

  // Fall back to a valid spawn.
  if (!best) {
    for (const spawn of SPAWN_POINTS) {
      if (
        walkableAt(
          spawn.x,
          spawn.y,
          radius
        )
      ) {
        return {
          x: spawn.x,
          y: spawn.y,
        };
      }
    }
  }

  // Final safety fallback.
  return {
    x: Math.max(
      radius,
      Math.min(
        WORLD.width - radius,
        x
      )
    ),

    y: Math.max(
      radius,
      Math.min(
        WORLD.height - radius,
        y
      )
    ),
  };
}

// ============================================================
// MOVEMENT RESOLUTION
//
// The player moves one axis at a time.
//
// This means:
//
// - Walls block the player.
// - Obstacles block the player.
// - The player can slide along walls.
// - Diagonal movement does not get stuck as easily.
// - Room/corridor transitions remain possible.
// ============================================================

function resolvePlayerMovement(
  x,
  y,
  nx,
  ny,
  radius = 14
) {
  // Keep the requested destination inside the world.
  nx = Math.max(
    radius,
    Math.min(
      WORLD.width - radius,
      nx
    )
  );

  ny = Math.max(
    radius,
    Math.min(
      WORLD.height - radius,
      ny
    )
  );

  let resolvedX = x;
  let resolvedY = y;

  // ----------------------------------------------------------
  // X AXIS
  // ----------------------------------------------------------

  if (
    walkableAt(
      nx,
      y,
      radius
    )
  ) {
    resolvedX = nx;
  }

  // ----------------------------------------------------------
  // Y AXIS
  // ----------------------------------------------------------

  if (
    walkableAt(
      resolvedX,
      ny,
      radius
    )
  ) {
    resolvedY = ny;
  }

  // ----------------------------------------------------------
  // FINAL VALIDATION
  // ----------------------------------------------------------

  if (
    walkableAt(
      resolvedX,
      resolvedY,
      radius
    )
  ) {
    return {
      x: resolvedX,
      y: resolvedY,
    };
  }

  // If the calculated position is invalid,
  // search for the closest valid point.
  return clampToWalkable(
    resolvedX,
    resolvedY,
    radius
  );
}

// ============================================================
// EXPORTS
// ============================================================

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