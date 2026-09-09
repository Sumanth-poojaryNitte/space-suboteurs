import {
  WORLD,
  ROOMS,
  CORRIDORS,
  TASKS,
  roomAt,
} from "./MapData.js";

const PLAYER_RADIUS = 16;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;

    if (!this.canvas) {
      throw new Error("Renderer: game canvas not found.");
    }

    this.ctx = this.canvas.getContext("2d");

    if (!this.ctx) {
      throw new Error("Renderer: Canvas 2D context unavailable.");
    }

    this.camera = {
      x: WORLD.width / 2,
      y: WORLD.height / 2,
      targetX: WORLD.width / 2,
      targetY: WORLD.height / 2,
    };

    this.viewW = 0;
    this.viewH = 0;

    this.lastTime = performance.now();

    this.resize();

    window.addEventListener("resize", () => {
      this.resize();
    });
  }

  // ============================================================
  // CANVAS
  // ============================================================

  resize() {
    if (!this.canvas || !this.ctx) return;

    const rect = this.canvas.getBoundingClientRect();

    const width =
      rect.width ||
      window.innerWidth ||
      1280;

    const height =
      rect.height ||
      window.innerHeight ||
      720;

    const dpr =
      Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width =
      Math.max(1, Math.floor(width * dpr));

    this.canvas.height =
      Math.max(1, Math.floor(height * dpr));

    this.canvas.style.width =
      `${width}px`;

    this.canvas.style.height =
      `${height}px`;

    this.ctx.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );

    this.viewW = width;
    this.viewH = height;
  }

  // ============================================================
  // CAMERA
  // ============================================================

  centerCameraOn(x, y) {
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return;
    }

    this.camera.targetX = x;
    this.camera.targetY = y;

    /*
     * Keep the camera inside the actual map.
     * This prevents the player from disappearing when
     * reaching the edges.
     */

    const halfW =
      this.viewW / 2;

    const halfH =
      this.viewH / 2;

    const minX =
      halfW;

    const maxX =
      Math.max(
        halfW,
        WORLD.width - halfW
      );

    const minY =
      halfH;

    const maxY =
      Math.max(
        halfH,
        WORLD.height - halfH
      );

    const targetX =
      Math.max(
        minX,
        Math.min(maxX, x)
      );

    const targetY =
      Math.max(
        minY,
        Math.min(maxY, y)
      );

    this.camera.targetX =
      targetX;

    this.camera.targetY =
      targetY;

    const smooth = 0.12;

    this.camera.x +=
      (this.camera.targetX -
        this.camera.x) *
      smooth;

    this.camera.y +=
      (this.camera.targetY -
        this.camera.y) *
      smooth;
  }

  updateCamera(player) {
    if (!player) return;

    const x =
      Number.isFinite(player.renderX)
        ? player.renderX
        : player.x;

    const y =
      Number.isFinite(player.renderY)
        ? player.renderY
        : player.y;

    this.centerCameraOn(x, y);
  }

  // ============================================================
  // COORDINATE CONVERSION
  // ============================================================

  worldToScreen(x, y) {
    return {
      x:
        x -
        this.camera.x +
        this.viewW / 2,

      y:
        y -
        this.camera.y +
        this.viewH / 2,
    };
  }

  screenToWorld(x, y) {
    return {
      x:
        x -
        this.viewW / 2 +
        this.camera.x,

      y:
        y -
        this.viewH / 2 +
        this.camera.y,
    };
  }

  // ============================================================
  // MAIN DRAW
  // ============================================================

  draw(net, localTasks = [], showRoles = false) {
    const now =
      performance.now();

    const dt =
      Math.min(
        now - this.lastTime,
        50
      ) / 1000;

    this.lastTime = now;

    this.clear();

    if (!net) {
      return;
    }

    const me =
      net.me;

    if (me) {
      this.updateCamera(me);
    }

    const ctx =
      this.ctx;

    ctx.save();

    /*
     * Convert world coordinates into
     * screen coordinates.
     */
    ctx.translate(
      this.viewW / 2,
      this.viewH / 2
    );

    ctx.translate(
      -this.camera.x,
      -this.camera.y
    );

    // ----------------------------------------------------------
    // DRAW ORDER
    // ----------------------------------------------------------

    this.drawSpaceBackground();

    this.drawStationHull();

    this.drawCorridors();

    this.drawRooms();

    this.drawRoomDetails();

    this.drawDoors(
      net.sabotage
    );

    this.drawObstacles();

    this.drawTasks(
      localTasks
    );

    this.drawBodies(
      net.bodies || []
    );

    this.drawPlayers(
      net
    );

    this.drawStationDetails();

    ctx.restore();

    this.drawVignette();

    if (net.sabotage) {
      this.drawSabotageOverlay(
        net.sabotage
      );
    }
  }

  // ============================================================
  // CLEAR
  // ============================================================

  clear() {
    const ctx =
      this.ctx;

    ctx.setTransform(
      window.devicePixelRatio > 1
        ? Math.min(
            window.devicePixelRatio,
            2
          )
        : 1,
      0,
      0,
      window.devicePixelRatio > 1
        ? Math.min(
            window.devicePixelRatio,
            2
          )
        : 1,
      0,
      0
    );

    ctx.clearRect(
      0,
      0,
      this.viewW,
      this.viewH
    );

    const gradient =
      ctx.createLinearGradient(
        0,
        0,
        0,
        this.viewH
      );

    gradient.addColorStop(
      0,
      "#02040a"
    );

    gradient.addColorStop(
      0.5,
      "#070c15"
    );

    gradient.addColorStop(
      1,
      "#010208"
    );

    ctx.fillStyle =
      gradient;

    ctx.fillRect(
      0,
      0,
      this.viewW,
      this.viewH
    );
  }

  // ============================================================
  // SPACE BACKGROUND
  // ============================================================

  drawSpaceBackground() {
    const ctx =
      this.ctx;

    /*
     * Large space background.
     */
    ctx.fillStyle =
      "#01030a";

    ctx.fillRect(
      -500,
      -500,
      WORLD.width + 1000,
      WORLD.height + 1000
    );

    /*
     * Stars.
     */
    for (let i = 0; i < 180; i++) {
      const x =
        (i * 137.53) %
        WORLD.width;

      const y =
        (i * 71.17) %
        WORLD.height;

      const radius =
        0.5 +
        ((i * 17) % 10) /
          10;

      ctx.globalAlpha =
        0.25 +
        ((i * 13) % 50) /
          100;

      ctx.fillStyle =
        "#dbeafe";

      ctx.beginPath();

      ctx.arc(
        x,
        y,
        radius,
        0,
        Math.PI * 2
      );

      ctx.fill();
    }

    ctx.globalAlpha = 1;

    /*
     * Nebula glow.
     */
    const nebula =
      ctx.createRadialGradient(
        1000,
        400,
        50,
        1000,
        400,
        1000
      );

    nebula.addColorStop(
      0,
      "rgba(30,90,150,0.18)"
    );

    nebula.addColorStop(
      1,
      "rgba(0,0,0,0)"
    );

    ctx.fillStyle =
      nebula;

    ctx.fillRect(
      0,
      0,
      WORLD.width,
      WORLD.height
    );
  }

  // ============================================================
  // STATION OUTER HULL
  // ============================================================

  drawStationHull() {
    const ctx =
      this.ctx;

    /*
     * Outer playable area.
     */
    ctx.save();

    ctx.fillStyle =
      "#0b111c";

    ctx.strokeStyle =
      "#41506d";

    ctx.lineWidth = 10;

    ctx.beginPath();

    ctx.roundRect(
      30,
      30,
      WORLD.width - 60,
      WORLD.height - 60,
      35
    );

    ctx.fill();

    ctx.stroke();

    /*
     * Inner hull.
     */
    ctx.strokeStyle =
      "rgba(100,150,200,0.25)";

    ctx.lineWidth = 3;

    ctx.beginPath();

    ctx.roundRect(
      45,
      45,
      WORLD.width - 90,
      WORLD.height - 90,
      28
    );

    ctx.stroke();

    ctx.restore();
  }

  // ============================================================
  // CORRIDORS
  // ============================================================

  drawCorridors() {
    const ctx =
      this.ctx;

    CORRIDORS.forEach(
      (c) => {
        ctx.save();

        /*
         * Corridor floor.
         */
        ctx.fillStyle =
          "#202938";

        ctx.fillRect(
          c.x,
          c.y,
          c.w,
          c.h
        );

        /*
         * Corridor inner floor.
         */
        ctx.fillStyle =
          "#171f2d";

        ctx.fillRect(
          c.x + 5,
          c.y + 5,
          Math.max(0, c.w - 10),
          Math.max(0, c.h - 10)
        );

        /*
         * Edge lighting.
         */
        ctx.strokeStyle =
          "#44536e";

        ctx.lineWidth = 3;

        ctx.strokeRect(
          c.x,
          c.y,
          c.w,
          c.h
        );

        /*
         * Floor panels.
         */
        ctx.strokeStyle =
          "rgba(120,150,180,0.15)";

        ctx.lineWidth = 1;

        const horizontal =
          c.w >= c.h;

        if (horizontal) {
          for (
            let x = c.x + 25;
            x < c.x + c.w;
            x += 50
          ) {
            ctx.beginPath();

            ctx.moveTo(
              x,
              c.y + 5
            );

            ctx.lineTo(
              x,
              c.y + c.h - 5
            );

            ctx.stroke();
          }
        } else {
          for (
            let y = c.y + 25;
            y < c.y + c.h;
            y += 50
          ) {
            ctx.beginPath();

            ctx.moveTo(
              c.x + 5,
              y
            );

            ctx.lineTo(
              c.x + c.w - 5,
              y
            );

            ctx.stroke();
          }
        }

        ctx.restore();
      }
    );
  }

  // ============================================================
  // ROOMS
  // ============================================================

  drawRooms() {
    const ctx =
      this.ctx;

    const roomStyles = {
      cafeteria: "#26384b",
      reactor: "#342943",
      electrical: "#3a3521",
      medbay: "#213b3c",
      security: "#26334a",
      navigation: "#243c50",
      communications: "#303344",
      storage: "#34322c",
      admin: "#30394a",
    };

    Object.entries(
      ROOMS
    ).forEach(
      ([name, r]) => {
        ctx.save();

        const baseColor =
          roomStyles[name] ||
          "#263142";

        /*
         * Room floor.
         */
        ctx.fillStyle =
          baseColor;

        ctx.fillRect(
          r.x,
          r.y,
          r.w,
          r.h
        );

        /*
         * Inner floor.
         */
        ctx.fillStyle =
          "rgba(10,16,25,0.22)";

        ctx.fillRect(
          r.x + 7,
          r.y + 7,
          Math.max(
            0,
            r.w - 14
          ),
          Math.max(
            0,
            r.h - 14
          )
        );

        /*
         * Room border.
         */
        ctx.strokeStyle =
          "#5a6985";

        ctx.lineWidth = 4;

        ctx.strokeRect(
          r.x,
          r.y,
          r.w,
          r.h
        );

        /*
         * Inner border.
         */
        ctx.strokeStyle =
          "rgba(150,180,210,0.18)";

        ctx.lineWidth = 1;

        ctx.strokeRect(
          r.x + 9,
          r.y + 9,
          Math.max(
            0,
            r.w - 18
          ),
          Math.max(
            0,
            r.h - 18
          )
        );

        /*
         * Room header.
         */
        ctx.fillStyle =
          "rgba(5,9,16,0.48)";

        ctx.fillRect(
          r.x,
          r.y,
          r.w,
          34
        );

        /*
         * Room name.
         */
        ctx.fillStyle =
          "#dbe7f5";

        ctx.font =
          "bold 14px 'Segoe UI', Arial, sans-serif";

        ctx.textAlign =
          "left";

        ctx.textBaseline =
          "middle";

        ctx.fillText(
          String(r.label || name).toUpperCase(),
          r.x + 12,
          r.y + 17
        );

        ctx.restore();
      }
    );
  }

  // ============================================================
  // ROOM DETAILS
  // ============================================================

  drawRoomDetails() {
    const ctx =
      this.ctx;

    /*
     * Cafeteria tables.
     */
    const cafeteria =
      ROOMS.cafeteria;

    if (cafeteria) {
      const tables = [
        {
          x: 790,
          y: 155,
          w: 115,
          h: 55,
        },
        {
          x: 940,
          y: 155,
          w: 115,
          h: 55,
        },
        {
          x: 790,
          y: 285,
          w: 115,
          h: 55,
        },
        {
          x: 940,
          y: 285,
          w: 115,
          h: 55,
        },
      ];

      tables.forEach(
        (table) => {
          this.drawTable(
            table.x,
            table.y,
            table.w,
            table.h
          );
        }
      );
    }

    /*
     * Reactor core.
     */
    const reactor =
      ROOMS.reactor;

    if (reactor) {
      ctx.save();

      ctx.fillStyle =
        "#111827";

      ctx.beginPath();

      ctx.arc(
        210,
        200,
        58,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.strokeStyle =
        "#8b5cf6";

      ctx.lineWidth = 5;

      ctx.stroke();

      ctx.strokeStyle =
        "rgba(168,85,247,0.35)";

      ctx.lineWidth = 12;

      ctx.stroke();

      ctx.fillStyle =
        "#c084fc";

      ctx.beginPath();

      ctx.arc(
        210,
        200,
        18,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.restore();

      this.drawConsole(
        300,
        175,
        "#9b87c8"
      );
    }

    /*
     * Electrical panels.
     */
    this.drawConsole(
      110,
      480,
      "#e0a93a"
    );

    this.drawConsole(
      260,
      480,
      "#e0a93a"
    );

    /*
     * Electrical generator.
     */
    ctx.save();

    ctx.fillStyle =
      "#252b34";

    ctx.strokeStyle =
      "#6b7280";

    ctx.lineWidth = 3;

    ctx.fillRect(
      125,
      590,
      150,
      50
    );

    ctx.strokeRect(
      125,
      590,
      150,
      50
    );

    ctx.fillStyle =
      "#eab308";

    ctx.fillRect(
      140,
      605,
      30,
      8
    );

    ctx.fillRect(
      185,
      605,
      30,
      8
    );

    ctx.fillRect(
      230,
      605,
      30,
      8
    );

    ctx.restore();

    /*
     * Medbay scanner.
     */
    ctx.save();

    ctx.fillStyle =
      "#b9c5d6";

    ctx.fillRect(
      540,
      535,
      85,
      45
    );

    ctx.strokeStyle =
      "#6f8198";

    ctx.lineWidth = 3;

    ctx.strokeRect(
      540,
      535,
      85,
      45
    );

    ctx.fillStyle =
      "rgba(80,200,220,0.4)";

    ctx.fillRect(
      550,
      545,
      65,
      20
    );

    ctx.restore();

    /*
     * Security monitors.
     */
    this.drawMonitor(
      875,
      510
    );

    this.drawMonitor(
      930,
      510
    );

    this.drawMonitor(
      985,
      510
    );

    /*
     * Navigation console.
     */
    this.drawConsole(
      1730,
      180,
      "#4fc3f7"
    );

    /*
     * Communications array.
     */
    ctx.save();

    ctx.strokeStyle =
      "#64748b";

    ctx.lineWidth = 5;

    ctx.beginPath();

    ctx.arc(
      1760,
      575,
      45,
      0,
      Math.PI * 2
    );

    ctx.stroke();

    ctx.strokeStyle =
      "#38bdf8";

    ctx.lineWidth = 2;

    ctx.beginPath();

    ctx.moveTo(
      1760,
      530
    );

    ctx.lineTo(
      1760,
      620
    );

    ctx.moveTo(
      1715,
      575
    );

    ctx.lineTo(
      1805,
      575
    );

    ctx.stroke();

    ctx.restore();

    /*
     * Storage crates.
     */
    const crates = [
      [1210, 520],
      [1280, 520],
      [1350, 520],
      [1210, 600],
      [1280, 600],
      [1350, 600],
    ];

    crates.forEach(
      ([x, y]) => {
        this.drawCrate(
          x,
          y
        );
      }
    );

    /*
     * Admin desk.
     */
    ctx.save();

    ctx.fillStyle =
      "#202936";

    ctx.strokeStyle =
      "#64748b";

    ctx.lineWidth = 3;

    ctx.fillRect(
      1250,
      145,
      150,
      50
    );

    ctx.strokeRect(
      1250,
      145,
      150,
      50
    );

    ctx.fillStyle =
      "#60a5fa";

    ctx.fillRect(
      1290,
      158,
      70,
      20
    );

    ctx.restore();
  }

  // ============================================================
  // TABLE
  // ============================================================

  drawTable(x, y, w, h) {
    const ctx =
      this.ctx;

    ctx.save();

    ctx.fillStyle =
      "#34495e";

    ctx.strokeStyle =
      "#718096";

    ctx.lineWidth = 3;

    ctx.beginPath();

    ctx.roundRect(
      x,
      y,
      w,
      h,
      12
    );

    ctx.fill();

    ctx.stroke();

    ctx.fillStyle =
      "#1e293b";

    ctx.beginPath();

    ctx.arc(
      x + w / 2,
      y + h / 2,
      Math.min(w, h) * 0.22,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.restore();
  }

  // ============================================================
  // CONSOLE
  // ============================================================

  drawConsole(x, y, glow) {
    const ctx =
      this.ctx;

    ctx.save();

    ctx.fillStyle =
      "#1b2430";

    ctx.strokeStyle =
      "#596b82";

    ctx.lineWidth = 3;

    ctx.fillRect(
      x,
      y,
      55,
      75
    );

    ctx.strokeRect(
      x,
      y,
      55,
      75
    );

    ctx.fillStyle =
      glow;

    ctx.fillRect(
      x + 10,
      y + 12,
      35,
      24
    );

    ctx.fillStyle =
      "#101720";

    ctx.fillRect(
      x + 8,
      y + 48,
      39,
      10
    );

    ctx.restore();
  }

  // ============================================================
  // MONITOR
  // ============================================================

  drawMonitor(x, y) {
    const ctx =
      this.ctx;

    ctx.save();

    ctx.fillStyle =
      "#111827";

    ctx.strokeStyle =
      "#64748b";

    ctx.lineWidth = 2;

    ctx.fillRect(
      x,
      y,
      45,
      35
    );

    ctx.strokeRect(
      x,
      y,
      45,
      35
    );

    ctx.fillStyle =
      "#2563eb";

    ctx.fillRect(
      x + 6,
      y + 6,
      33,
      22
    );

    ctx.fillStyle =
      "#6b7280";

    ctx.fillRect(
      x + 18,
      y + 35,
      10,
      10
    );

    ctx.restore();
  }

  // ============================================================
  // CRATE
  // ============================================================

  drawCrate(x, y) {
    const ctx =
      this.ctx;

    ctx.save();

    ctx.fillStyle =
      "#4b5563";

    ctx.strokeStyle =
      "#9ca3af";

    ctx.lineWidth = 2;

    ctx.fillRect(
      x,
      y,
      45,
      45
    );

    ctx.strokeRect(
      x,
      y,
      45,
      45
    );

    ctx.strokeStyle =
      "#6b7280";

    ctx.beginPath();

    ctx.moveTo(
      x,
      y
    );

    ctx.lineTo(
      x + 45,
      y + 45
    );

    ctx.moveTo(
      x + 45,
      y
    );

    ctx.lineTo(
      x,
      y + 45
    );

    ctx.stroke();

    ctx.restore();
  }

  // ============================================================
  // DOORS
  // ============================================================

  drawDoors(sabotage) {
    const ctx =
      this.ctx;

    /*
     * Door positions are based on
     * the connections between rooms.
     */

    const doors = [
      {
        x: 690,
        y: 205,
        w: 20,
        h: 50,
        vertical: true,
      },

      {
        x: 375,
        y: 300,
        w: 45,
        h: 20,
        vertical: false,
      },

      {
        x: 350,
        y: 410,
        w: 20,
        h: 45,
        vertical: true,
      },

      {
        x: 445,
        y: 500,
        w: 25,
        h: 45,
        vertical: true,
      },

      {
        x: 710,
        y: 500,
        w: 25,
        h: 45,
        vertical: true,
      },

      {
        x: 890,
        y: 230,
        w: 25,
        h: 20,
        vertical: false,
      },

      {
        x: 1470,
        y: 190,
        w: 25,
        h: 45,
        vertical: true,
      },

      {
        x: 1050,
        y: 525,
        w: 25,
        h: 45,
        vertical: true,
      },

      {
        x: 1490,
        y: 525,
        w: 25,
        h: 45,
        vertical: true,
      },

      {
        x: 1310,
        y: 390,
        w: 25,
        h: 45,
        vertical: true,
      },
    ];

    doors.forEach(
      (door) => {
        ctx.save();

        const blocked =
          sabotage &&
          sabotage.type === "doors";

        ctx.fillStyle =
          blocked
            ? "#dc2626"
            : "#94a3b8";

        ctx.strokeStyle =
          blocked
            ? "#ef4444"
            : "#cbd5e1";

        ctx.lineWidth = 2;

        ctx.fillRect(
          door.x,
          door.y,
          door.w,
          door.h
        );

        ctx.strokeRect(
          door.x,
          door.y,
          door.w,
          door.h
        );

        ctx.restore();
      }
    );
  }

  // ============================================================
  // OBSTACLES
  // ============================================================

  drawObstacles() {
    /*
     * The current client MapData does not export
     * obstacle data, so we draw the known map
     * obstacles directly here.
     */

    const obstacles = [
      {
        x: 790,
        y: 155,
        w: 115,
        h: 55,
        type: "table",
      },

      {
        x: 940,
        y: 155,
        w: 115,
        h: 55,
        type: "table",
      },

      {
        x: 790,
        y: 285,
        w: 115,
        h: 55,
        type: "table",
      },

      {
        x: 940,
        y: 285,
        w: 115,
        h: 55,
        type: "table",
      },

      {
        x: 155,
        y: 145,
        w: 110,
        h: 110,
        type: "reactor",
      },

      {
        x: 285,
        y: 170,
        w: 55,
        h: 75,
        type: "console",
      },

      {
        x: 100,
        y: 465,
        w: 65,
        h: 85,
        type: "panel",
      },

      {
        x: 250,
        y: 465,
        w: 65,
        h: 85,
        type: "panel",
      },

      {
        x: 125,
        y: 590,
        w: 150,
        h: 50,
        type: "generator",
      },

      {
        x: 540,
        y: 535,
        w: 85,
        h: 45,
        type: "scanner",
      },
    ];

    obstacles.forEach(
      (o) => {
        /*
         * Main decorative objects have already
         * been drawn in drawRoomDetails().
         *
         * This function adds subtle shadows so
         * they don't appear flat.
         */

        const ctx =
          this.ctx;

        ctx.save();

        ctx.fillStyle =
          "rgba(0,0,0,0.18)";

        ctx.fillRect(
          o.x + 5,
          o.y + 6,
          o.w,
          o.h
        );

        ctx.restore();
      }
    );
  }

  // ============================================================
  // TASKS
  // ============================================================

  drawTasks(localTasks = []) {
    if (
      !Array.isArray(localTasks) ||
      localTasks.length === 0
    ) {
      return;
    }

    const ctx =
      this.ctx;

    const assignedIds =
      new Set(
        localTasks.map(
          (task) => task.id
        )
      );

    TASKS
      .filter(
        (task) =>
          assignedIds.has(task.id)
      )
      .forEach(
        (task) => {
          const localTask =
            localTasks.find(
              (t) =>
                t.id === task.id
            );

          const done =
            !!(
              localTask &&
              localTask.completed
            );

          ctx.save();

          /*
           * Glow.
           */
          if (!done) {
            ctx.shadowColor =
              "#facc15";

            ctx.shadowBlur = 14;
          }

          ctx.beginPath();

          ctx.arc(
            task.x,
            task.y,
            10,
            0,
            Math.PI * 2
          );

          ctx.fillStyle =
            done
              ? "#22c55e"
              : "#facc15";

          ctx.fill();

          ctx.shadowBlur = 0;

          ctx.strokeStyle =
            "#020617";

          ctx.lineWidth = 2;

          ctx.stroke();

          /*
           * Task symbol.
           */
          ctx.fillStyle =
            "#111827";

          ctx.font =
            "bold 10px Arial";

          ctx.textAlign =
            "center";

          ctx.textBaseline =
            "middle";

          ctx.fillText(
            done ? "✓" : "!",
            task.x,
            task.y
          );

          /*
           * Label.
           */
          if (!done) {
            ctx.fillStyle =
              "#f8fafc";

            ctx.font =
              "11px 'Segoe UI', Arial";

            ctx.textAlign =
              "left";

            ctx.textBaseline =
              "middle";

            ctx.fillText(
              task.label,
              task.x + 17,
              task.y
            );
          }

          ctx.restore();
        }
      );
  }

  // ============================================================
  // BODIES
  // ============================================================

  drawBodies(bodies = []) {
    if (
      !Array.isArray(bodies)
    ) {
      return;
    }

    const ctx =
      this.ctx;

    bodies.forEach(
      (body) => {
        if (!body) return;

        const x =
          Number.isFinite(body.x)
            ? body.x
            : 0;

        const y =
          Number.isFinite(body.y)
            ? body.y
            : 0;

        ctx.save();

        ctx.translate(
          x,
          y
        );

        /*
         * Body shadow.
         */
        ctx.fillStyle =
          "rgba(0,0,0,0.35)";

        ctx.beginPath();

        ctx.ellipse(
          2,
          5,
          23,
          13,
          0,
          0,
          Math.PI * 2
        );

        ctx.fill();

        /*
         * Body.
         */
        ctx.fillStyle =
          "#b91c1c";

        ctx.beginPath();

        ctx.ellipse(
          0,
          0,
          20,
          12,
          0,
          0,
          Math.PI * 2
        );

        ctx.fill();

        ctx.strokeStyle =
          "#450a0a";

        ctx.lineWidth = 2;

        ctx.stroke();

        /*
         * Bone.
         */
        ctx.strokeStyle =
          "#f8fafc";

        ctx.lineWidth = 4;

        ctx.beginPath();

        ctx.moveTo(
          -5,
          -7
        );

        ctx.lineTo(
          7,
          7
        );

        ctx.moveTo(
          7,
          -7
        );

        ctx.lineTo(
          -5,
          7
        );

        ctx.stroke();

        /*
         * Body label.
         */
        ctx.fillStyle =
          "#f8fafc";

        ctx.font =
          "11px 'Segoe UI', Arial";

        ctx.textAlign =
          "left";

        ctx.textBaseline =
          "middle";

        ctx.fillText(
          `${body.victimName || "Unknown"}'s body`,
          25,
          -10
        );

        ctx.restore();
      }
    );
  }

  // ============================================================
  // PLAYERS
  // ============================================================

  drawPlayers(net) {
    if (!net) return;

    let players = [];

    /*
     * IMPORTANT:
     * NetworkState.players is a Map.
     *
     * This handles both Map and Array so
     * the renderer never crashes.
     */

    if (
      net.players instanceof Map
    ) {
      players =
        Array.from(
          net.players.values()
        );
    } else if (
      Array.isArray(net.players)
    ) {
      players =
        net.players;
    } else if (
      net.players &&
      typeof net.players === "object"
    ) {
      players =
        Object.values(
          net.players
        );
    }

    for (
      const player of players
    ) {
      if (!player) continue;

      if (
        player.connected === false
      ) {
        continue;
      }

      if (
        player.alive === false
      ) {
        this.drawGhost(
          player
        );

        continue;
      }

      this.drawPlayer(
        player,
        net
      );
    }
  }

  // ============================================================
  // PLAYER
  // ============================================================

  drawPlayer(player, net) {
    const ctx =
      this.ctx;

    const x =
      Number.isFinite(player.renderX)
        ? player.renderX
        : player.x;

    const y =
      Number.isFinite(player.renderY)
        ? player.renderY
        : player.y;

    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return;
    }

    const isLocal =
      player.id === net.playerId;

    ctx.save();

    ctx.translate(
      x,
      y
    );

    /*
     * Shadow.
     */
    ctx.fillStyle =
      "rgba(0,0,0,0.35)";

    ctx.beginPath();

    ctx.ellipse(
      0,
      10,
      18,
      7,
      0,
      0,
      Math.PI * 2
    );

    ctx.fill();

    /*
     * Local-player glow.
     */
    if (isLocal) {
      ctx.shadowColor =
        "#ffffff";

      ctx.shadowBlur = 12;
    }

    /*
     * Character body.
     */
    ctx.fillStyle =
      player.color ||
      "#38bdf8";

    ctx.beginPath();

    ctx.roundRect(
      -15,
      -16,
      30,
      34,
      9
    );

    ctx.fill();

    ctx.shadowBlur = 0;

    /*
     * Body outline.
     */
    ctx.strokeStyle =
      "#0b1220";

    ctx.lineWidth = 3;

    ctx.stroke();

    /*
     * Backpack.
     */
    ctx.fillStyle =
      player.color ||
      "#38bdf8";

    ctx.fillRect(
      -21,
      -8,
      7,
      17
    );

    /*
     * Visor.
     */
    const visor =
      ctx.createLinearGradient(
        -7,
        -12,
        9,
        0
      );

    visor.addColorStop(
      0,
      "#dff8ff"
    );

    visor.addColorStop(
      0.45,
      "#8ed8ef"
    );

    visor.addColorStop(
      1,
      "#286783"
    );

    ctx.fillStyle =
      visor;

    ctx.beginPath();

    ctx.roundRect(
      -7,
      -11,
      17,
      10,
      5
    );

    ctx.fill();

    ctx.strokeStyle =
      "#17384b";

    ctx.lineWidth = 1.5;

    ctx.stroke();

    /*
     * Small helmet highlight.
     */
    ctx.fillStyle =
      "rgba(255,255,255,0.55)";

    ctx.beginPath();

    ctx.ellipse(
      4,
      -7,
      3,
      1.5,
      -0.3,
      0,
      Math.PI * 2
    );

    ctx.fill();

    /*
     * Player name.
     */
    ctx.fillStyle =
      "#ffffff";

    ctx.font =
      "bold 12px 'Segoe UI', Arial";

    ctx.textAlign =
      "center";

    ctx.textBaseline =
      "alphabetic";

    ctx.fillText(
      player.name ||
        "Player",
      0,
      -25
    );

    /*
     * Local player marker.
     */
    if (isLocal) {
      ctx.strokeStyle =
        "rgba(255,255,255,0.9)";

      ctx.lineWidth = 2;

      ctx.beginPath();

      ctx.arc(
        0,
        0,
        23,
        0,
        Math.PI * 2
      );

      ctx.stroke();
    }

    ctx.restore();
  }

  // ============================================================
  // GHOST
  // ============================================================

  drawGhost(player) {
    const ctx =
      this.ctx;

    const x =
      Number.isFinite(player.renderX)
        ? player.renderX
        : player.x;

    const y =
      Number.isFinite(player.renderY)
        ? player.renderY
        : player.y;

    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return;
    }

    ctx.save();

    ctx.translate(
      x,
      y
    );

    ctx.globalAlpha =
      0.42;

    ctx.fillStyle =
      player.color ||
      "#94a3b8";

    ctx.beginPath();

    ctx.arc(
      0,
      0,
      PLAYER_RADIUS,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.globalAlpha = 1;

    ctx.fillStyle =
      "#ffffff";

    ctx.font =
      "11px 'Segoe UI', Arial";

    ctx.textAlign =
      "center";

    ctx.fillText(
      `${player.name || "Player"} (ghost)`,
      0,
      -24
    );

    ctx.restore();
  }

  // ============================================================
  // STATION DETAILS
  // ============================================================

  drawStationDetails() {
    const ctx =
      this.ctx;

    /*
     * Floor lights.
     */
    const lights = [
      [500, 220],
      [650, 220],
      [1250, 220],
      [1400, 220],
      [1550, 220],
      [500, 540],
      [750, 540],
      [1100, 550],
      [1450, 550],
      [1550, 550],
    ];

    ctx.save();

    lights.forEach(
      ([x, y]) => {
        ctx.fillStyle =
          "rgba(100,190,255,0.55)";

        ctx.fillRect(
          x,
          y,
          18,
          3
        );
      }
    );

    /*
     * Small navigation markings.
     */
    ctx.strokeStyle =
      "rgba(100,150,190,0.25)";

    ctx.lineWidth = 2;

    for (
      let x = 60;
      x < WORLD.width - 60;
      x += 100
    ) {
      ctx.beginPath();

      ctx.moveTo(
        x,
        WORLD.height - 48
      );

      ctx.lineTo(
        x + 45,
        WORLD.height - 48
      );

      ctx.stroke();
    }

    ctx.restore();
  }

  // ============================================================
  // VIGNETTE
  // ============================================================

  drawVignette() {
    const ctx =
      this.ctx;

    const gradient =
      ctx.createRadialGradient(
        this.viewW / 2,
        this.viewH / 2,
        Math.min(
          this.viewW,
          this.viewH
        ) * 0.25,

        this.viewW / 2,
        this.viewH / 2,
        Math.max(
          this.viewW,
          this.viewH
        ) * 0.75
      );

    gradient.addColorStop(
      0,
      "rgba(0,0,0,0)"
    );

    gradient.addColorStop(
      1,
      "rgba(0,0,0,0.48)"
    );

    ctx.fillStyle =
      gradient;

    ctx.fillRect(
      0,
      0,
      this.viewW,
      this.viewH
    );
  }

  // ============================================================
  // SABOTAGE OVERLAY
  // ============================================================

  drawSabotageOverlay(
    sabotage
  ) {
    if (!sabotage) {
      return;
    }

    const ctx =
      this.ctx;

    if (
      sabotage.type !==
      "electrical"
    ) {
      return;
    }

    ctx.save();

    /*
     * Don't completely cover the map.
     * The map must remain visible.
     */
    ctx.fillStyle =
      "rgba(20,0,0,0.12)";

    ctx.fillRect(
      0,
      0,
      this.viewW,
      this.viewH
    );

    /*
     * Red warning border.
     */
    ctx.strokeStyle =
      "rgba(239,68,68,0.55)";

    ctx.lineWidth = 4;

    ctx.strokeRect(
      2,
      2,
      this.viewW - 4,
      this.viewH - 4
    );

    ctx.restore();
  }

  // ============================================================
  // INTERACTION
  // ============================================================

  nearestInteractable(
    worldX,
    worldY,
    localTasks,
    bodies,
    range
  ) {
    let nearest =
      null;

    let nearestDistance =
      Number.isFinite(range)
        ? range
        : 70;

    const tasks =
      Array.isArray(localTasks)
        ? localTasks
        : [];

    const assignedIds =
      new Set(
        tasks.map(
          (task) => task.id
        )
      );

    TASKS
      .filter(
        (task) =>
          assignedIds.has(task.id)
      )
      .forEach(
        (task) => {
          const localTask =
            tasks.find(
              (t) =>
                t.id === task.id
            );

          if (
            localTask &&
            localTask.completed
          ) {
            return;
          }

          const distance =
            Math.hypot(
              task.x - worldX,
              task.y - worldY
            );

          if (
            distance <
            nearestDistance
          ) {
            nearestDistance =
              distance;

            nearest = {
              type: "task",
              task,
            };
          }
        }
      );

    if (
      Array.isArray(bodies)
    ) {
      bodies.forEach(
        (body) => {
          if (!body) return;

          const distance =
            Math.hypot(
              body.x - worldX,
              body.y - worldY
            );

          if (
            distance <
            nearestDistance
          ) {
            nearestDistance =
              distance;

            nearest = {
              type: "body",
              body,
            };
          }
        }
      );
    }

    return nearest;
  }
}

export {
  ROOMS,
  roomAt,
};