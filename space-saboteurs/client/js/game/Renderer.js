import {
  WORLD,
  ROOMS,
  CORRIDORS,
  TASKS,
  roomAt,
} from "./MapData.js";

const PLAYER_RADIUS = 16;

// Slightly larger client interaction tolerance.
// Server remains authoritative.
const DEFAULT_INTERACTION_RANGE = 105;

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

    // ==========================================================
    // VISUAL EFFECT STATE
    // ==========================================================

    this.visualTime = 0;

    this.stars = [];
    this.spaceDust = [];

    this.createStars();
    this.createSpaceDust();

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

    const rect =
      this.canvas.getBoundingClientRect();

    const width =
      rect.width ||
      window.innerWidth ||
      1280;

    const height =
      rect.height ||
      window.innerHeight ||
      720;

    const dpr =
      Math.min(
        window.devicePixelRatio || 1,
        2
      );

    this.canvas.width =
      Math.max(
        1,
        Math.floor(width * dpr)
      );

    this.canvas.height =
      Math.max(
        1,
        Math.floor(height * dpr)
      );

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
  // STAR GENERATION
  // ============================================================

  createStars() {
    this.stars = [];

    /*
     * More stars than the original version.
     *
     * The positions are deterministic so the background
     * does not randomly jump every time the game redraws.
     */
    for (let i = 0; i < 360; i++) {
      const x =
        (
          i * 173.731 +
          47.13
        ) %
        WORLD.width;

      const y =
        (
          i * 91.417 +
          29.71
        ) %
        WORLD.height;

      const size =
        i % 17 === 0
          ? 2.1
          : i % 7 === 0
          ? 1.45
          : 0.55 +
            ((i * 13) % 100) /
              180;

      this.stars.push({
        x,
        y,
        size,

        baseAlpha:
          0.25 +
          ((i * 29) % 65) /
            100,

        twinkleSpeed:
          0.7 +
          ((i * 17) % 100) /
            80,

        twinkleOffset:
          ((i * 43) % 100) /
          10,

        depth:
          0.25 +
          ((i * 19) % 70) /
            100,
      });
    }
  }

  // ============================================================
  // SPACE DUST
  // ============================================================

  createSpaceDust() {
    this.spaceDust = [];

    for (let i = 0; i < 90; i++) {
      this.spaceDust.push({
        x:
          (i * 137.31) %
          WORLD.width,

        y:
          (i * 73.19) %
          WORLD.height,

        size:
          0.4 +
          ((i * 11) % 100) /
            180,

        alpha:
          0.04 +
          ((i * 7) % 30) /
            100,

        depth:
          0.15 +
          ((i * 23) % 80) /
            100,
      });
    }
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

    this.centerCameraOn(
      x,
      y
    );
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

  draw(
    net,
    localTasks = [],
    showRoles = false
  ) {
    const now =
      performance.now();

    const dt =
      Math.min(
        now - this.lastTime,
        50
      ) / 1000;

    this.lastTime = now;

    this.visualTime += dt;

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

    ctx.translate(
      this.viewW / 2,
      this.viewH / 2
    );

    ctx.translate(
      -this.camera.x,
      -this.camera.y
    );

    // ==========================================================
    // SPACE
    // ==========================================================

    this.drawSpaceBackground();

    // ==========================================================
    // SHIP
    // ==========================================================

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

    // ==========================================================
    // SCREEN SPACE LIGHTING
    // ==========================================================

    this.drawFlashlight(
      net
    );

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

    const dpr =
      Math.min(
        window.devicePixelRatio || 1,
        2
      );

    ctx.setTransform(
      dpr,
      0,
      0,
      dpr,
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
      0.35,
      "#050a14"
    );

    gradient.addColorStop(
      0.65,
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

    // ----------------------------------------------------------
    // Deep space
    // ----------------------------------------------------------

    const background =
      ctx.createRadialGradient(
        WORLD.width * 0.48,
        WORLD.height * 0.45,
        80,

        WORLD.width * 0.48,
        WORLD.height * 0.45,
        WORLD.width * 0.9
      );

    background.addColorStop(
      0,
      "#0b1628"
    );

    background.addColorStop(
      0.38,
      "#050b16"
    );

    background.addColorStop(
      0.72,
      "#02050c"
    );

    background.addColorStop(
      1,
      "#010208"
    );

    ctx.fillStyle =
      background;

    ctx.fillRect(
      -500,
      -500,
      WORLD.width + 1000,
      WORLD.height + 1000
    );

    // ----------------------------------------------------------
    // Nebula
    // ----------------------------------------------------------

    const nebula =
      ctx.createRadialGradient(
        1250,
        300,
        60,

        1250,
        300,
        850
      );

    nebula.addColorStop(
      0,
      "rgba(35,105,175,0.16)"
    );

    nebula.addColorStop(
      0.35,
      "rgba(20,70,140,0.08)"
    );

    nebula.addColorStop(
      0.7,
      "rgba(15,45,100,0.035)"
    );

    nebula.addColorStop(
      1,
      "rgba(0,0,0,0)"
    );

    ctx.fillStyle =
      nebula;

    ctx.fillRect(
      -100,
      -100,
      WORLD.width + 200,
      WORLD.height + 200
    );

    // ----------------------------------------------------------
    // Second subtle nebula
    // ----------------------------------------------------------

    const nebula2 =
      ctx.createRadialGradient(
        300,
        650,
        20,

        300,
        650,
        650
      );

    nebula2.addColorStop(
      0,
      "rgba(80,55,145,0.10)"
    );

    nebula2.addColorStop(
      0.45,
      "rgba(50,40,110,0.04)"
    );

    nebula2.addColorStop(
      1,
      "rgba(0,0,0,0)"
    );

    ctx.fillStyle =
      nebula2;

    ctx.fillRect(
      0,
      0,
      WORLD.width,
      WORLD.height
    );

    // ----------------------------------------------------------
    // Stars
    // ----------------------------------------------------------

    this.stars.forEach(
      (star) => {
        const driftX =
          this.camera.x *
          star.depth *
          0.018;

        const driftY =
          this.camera.y *
          star.depth *
          0.012;

        let x =
          star.x -
          driftX;

        let y =
          star.y -
          driftY;

        // Wrap stars around world edges.
        x =
          ((x % WORLD.width) +
            WORLD.width) %
          WORLD.width;

        y =
          ((y % WORLD.height) +
            WORLD.height) %
          WORLD.height;

        const twinkle =
          Math.sin(
            this.visualTime *
              star.twinkleSpeed +
              star.twinkleOffset
          );

        const alpha =
          Math.max(
            0.08,
            Math.min(
              1,
              star.baseAlpha +
                twinkle * 0.18
            )
          );

        // Star
        ctx.globalAlpha =
          alpha;

        ctx.fillStyle =
          "#e6f4ff";

        ctx.beginPath();

        ctx.arc(
          x,
          y,
          star.size,
          0,
          Math.PI * 2
        );

        ctx.fill();

        // Larger stars get a soft glow.
        if (
          star.size >= 1.4
        ) {
          ctx.globalAlpha =
            alpha * 0.16;

          ctx.beginPath();

          ctx.arc(
            x,
            y,
            star.size * 4,
            0,
            Math.PI * 2
          );

          ctx.fill();
        }

        // Occasional star sparkle.
        if (
          star.size >= 1.8 &&
          twinkle > 0.65
        ) {
          ctx.globalAlpha =
            alpha * 0.55;

          ctx.strokeStyle =
            "#dff7ff";

          ctx.lineWidth = 0.7;

          ctx.beginPath();

          ctx.moveTo(
            x - star.size * 3,
            y
          );

          ctx.lineTo(
            x + star.size * 3,
            y
          );

          ctx.moveTo(
            x,
            y - star.size * 3
          );

          ctx.lineTo(
            x,
            y + star.size * 3
          );

          ctx.stroke();
        }
      }
    );

    ctx.globalAlpha = 1;

    // ----------------------------------------------------------
    // Space dust
    // ----------------------------------------------------------

    this.spaceDust.forEach(
      (particle) => {
        let x =
          particle.x -
          this.camera.x *
            particle.depth *
            0.035;

        let y =
          particle.y -
          this.camera.y *
            particle.depth *
            0.025;

        x =
          ((x % WORLD.width) +
            WORLD.width) %
          WORLD.width;

        y =
          ((y % WORLD.height) +
            WORLD.height) %
          WORLD.height;

        ctx.globalAlpha =
          particle.alpha;

        ctx.fillStyle =
          "#9fb8d0";

        ctx.beginPath();

        ctx.arc(
          x,
          y,
          particle.size,
          0,
          Math.PI * 2
        );

        ctx.fill();
      }
    );

    ctx.globalAlpha = 1;
  }

  // ============================================================
  // STATION OUTER HULL
  // ============================================================

  drawStationHull() {
    const ctx =
      this.ctx;

    ctx.save();

    // Outer shadow
    ctx.shadowColor =
      "rgba(0,0,0,0.75)";

    ctx.shadowBlur = 30;

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

    ctx.shadowBlur = 0;

    // Inner hull line
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

    // Small outer lights
    const lights = [
      [90, 55],
      [250, 55],
      [410, 55],
      [570, 55],
      [730, 55],
      [890, 55],
      [1050, 55],
      [1210, 55],
      [1370, 55],
      [1530, 55],
      [1690, 55],
      [1850, 55],

      [90, WORLD.height - 55],
      [250, WORLD.height - 55],
      [410, WORLD.height - 55],
      [570, WORLD.height - 55],
      [730, WORLD.height - 55],
      [890, WORLD.height - 55],
      [1050, WORLD.height - 55],
      [1210, WORLD.height - 55],
      [1370, WORLD.height - 55],
      [1530, WORLD.height - 55],
      [1690, WORLD.height - 55],
      [1850, WORLD.height - 55],
    ];

    lights.forEach(
      ([x, y], index) => {
        const pulse =
          0.55 +
          Math.sin(
            this.visualTime * 2 +
              index
          ) *
            0.18;

        ctx.fillStyle =
          `rgba(100,190,255,${pulse})`;

        ctx.beginPath();

        ctx.arc(
          x,
          y,
          2,
          0,
          Math.PI * 2
        );

        ctx.fill();
      }
    );

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

        // Corridor shadow
        ctx.shadowColor =
          "rgba(0,0,0,0.5)";

        ctx.shadowBlur = 10;

        ctx.fillStyle =
          "#202938";

        ctx.fillRect(
          c.x,
          c.y,
          c.w,
          c.h
        );

        ctx.shadowBlur = 0;

        // Inner floor
        ctx.fillStyle =
          "#171f2d";

        ctx.fillRect(
          c.x + 5,
          c.y + 5,
          Math.max(
            0,
            c.w - 10
          ),
          Math.max(
            0,
            c.h - 10
          )
        );

        // Border
        ctx.strokeStyle =
          "#44536e";

        ctx.lineWidth = 3;

        ctx.strokeRect(
          c.x,
          c.y,
          c.w,
          c.h
        );

        // Floor panels
        ctx.strokeStyle =
          "rgba(120,150,180,0.15)";

        ctx.lineWidth = 1;

        const horizontal =
          c.w >= c.h;

        if (horizontal) {
          for (
            let x =
              c.x + 25;
            x <
              c.x + c.w;
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
            let y =
              c.y + 25;
            y <
              c.y + c.h;
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

        // Corridor ceiling lights
        const lightCount =
          horizontal
            ? Math.max(
                1,
                Math.floor(
                  c.w / 140
                )
              )
            : Math.max(
                1,
                Math.floor(
                  c.h / 140
                )
              );

        for (
          let i = 0;
          i < lightCount;
          i++
        ) {
          let lx;
          let ly;

          if (horizontal) {
            lx =
              c.x +
              ((i + 1) /
                (lightCount + 1)) *
                c.w;

            ly =
              c.y +
              c.h / 2;
          } else {
            lx =
              c.x +
              c.w / 2;

            ly =
              c.y +
              ((i + 1) /
                (lightCount + 1)) *
                c.h;
          }

          const glow =
            ctx.createRadialGradient(
              lx,
              ly,
              0,
              lx,
              ly,
              35
            );

          glow.addColorStop(
            0,
            "rgba(120,210,255,0.15)"
          );

          glow.addColorStop(
            1,
            "rgba(120,210,255,0)"
          );

          ctx.fillStyle =
            glow;

          ctx.beginPath();

          ctx.arc(
            lx,
            ly,
            35,
            0,
            Math.PI * 2
          );

          ctx.fill();

          ctx.fillStyle =
            "rgba(190,230,255,0.55)";

          ctx.fillRect(
            lx - 7,
            ly - 1,
            14,
            2
          );
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

        // Room shadow
        ctx.shadowColor =
          "rgba(0,0,0,0.45)";

        ctx.shadowBlur = 14;

        ctx.fillStyle =
          baseColor;

        ctx.fillRect(
          r.x,
          r.y,
          r.w,
          r.h
        );

        ctx.shadowBlur = 0;

        // Inner darkness
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

        // Main room border
        ctx.strokeStyle =
          "#5a6985";

        ctx.lineWidth = 4;

        ctx.strokeRect(
          r.x,
          r.y,
          r.w,
          r.h
        );

        // Inner border
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

        // Header
        ctx.fillStyle =
          "rgba(5,9,16,0.48)";

        ctx.fillRect(
          r.x,
          r.y,
          r.w,
          34
        );

        // Room name
        ctx.fillStyle =
          "#dbe7f5";

        ctx.font =
          "bold 14px 'Segoe UI', Arial, sans-serif";

        ctx.textAlign =
          "left";

        ctx.textBaseline =
          "middle";

        ctx.fillText(
          String(
            r.label || name
          ).toUpperCase(),
          r.x + 12,
          r.y + 17
        );

        // Ceiling lights
        this.drawRoomLighting(
          r
        );

        ctx.restore();
      }
    );
  }

  // ============================================================
  // ROOM LIGHTING
  // ============================================================

  drawRoomLighting(room) {
    const ctx =
      this.ctx;

    const count =
      Math.max(
        1,
        Math.floor(
          room.w / 140
        )
      );

    for (
      let i = 0;
      i < count;
      i++
    ) {
      const x =
        room.x +
        ((i + 1) /
          (count + 1)) *
          room.w;

      const y =
        room.y + 11;

      const glow =
        ctx.createRadialGradient(
          x,
          y,
          0,
          x,
          y,
          58
        );

      glow.addColorStop(
        0,
        "rgba(130,215,255,0.14)"
      );

      glow.addColorStop(
        0.45,
        "rgba(100,180,240,0.055)"
      );

      glow.addColorStop(
        1,
        "rgba(0,0,0,0)"
      );

      ctx.fillStyle =
        glow;

      ctx.beginPath();

      ctx.arc(
        x,
        y,
        58,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.fillStyle =
        "rgba(195,230,255,0.6)";

      ctx.fillRect(
        x - 10,
        y - 2,
        20,
        4
      );
    }
  }

  // ============================================================
  // ROOM DETAILS
  // ============================================================

  drawRoomDetails() {
    const ctx =
      this.ctx;

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

    // ==========================================================
    // REACTOR
    // ==========================================================

    const reactor =
      ROOMS.reactor;

    if (reactor) {
      ctx.save();

      // Reactor glow
      const reactorGlow =
        ctx.createRadialGradient(
          210,
          200,
          10,
          210,
          200,
          100
        );

      reactorGlow.addColorStop(
        0,
        "rgba(168,85,247,0.20)"
      );

      reactorGlow.addColorStop(
        1,
        "rgba(168,85,247,0)"
      );

      ctx.fillStyle =
        reactorGlow;

      ctx.beginPath();

      ctx.arc(
        210,
        200,
        100,
        0,
        Math.PI * 2
      );

      ctx.fill();

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

      // Rotating reactor detail
      const angle =
        this.visualTime * 0.5;

      ctx.strokeStyle =
        "rgba(220,180,255,0.65)";

      ctx.lineWidth = 2;

      ctx.beginPath();

      ctx.arc(
        210,
        200,
        42,
        angle,
        angle + 1.2
      );

      ctx.stroke();

      ctx.restore();

      this.drawConsole(
        300,
        175,
        "#9b87c8"
      );
    }

    // ==========================================================
    // ELECTRICAL
    // ==========================================================

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

    // ==========================================================
    // MEDBAY SCANNER
    // ==========================================================

    ctx.save();

    const scannerGlow =
      ctx.createRadialGradient(
        582,
        557,
        2,
        582,
        557,
        70
      );

    scannerGlow.addColorStop(
      0,
      "rgba(45,220,210,0.15)"
    );

    scannerGlow.addColorStop(
      1,
      "rgba(45,220,210,0)"
    );

    ctx.fillStyle =
      scannerGlow;

    ctx.beginPath();

    ctx.arc(
      582,
      557,
      70,
      0,
      Math.PI * 2
    );

    ctx.fill();

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

    // ==========================================================
    // SECURITY
    // ==========================================================

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

    // ==========================================================
    // NAVIGATION
    // ==========================================================

    this.drawConsole(
      1730,
      180,
      "#4fc3f7"
    );

    // ==========================================================
    // COMMUNICATIONS
    // ==========================================================

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

    // Signal pulse
    const signal =
      Math.sin(
        this.visualTime * 3
      );

    ctx.strokeStyle =
      `rgba(56,189,248,${0.35 + signal * 0.12})`;

    ctx.beginPath();

    ctx.arc(
      1760,
      575,
      55 +
        signal * 5,
      0,
      Math.PI * 2
    );

    ctx.stroke();

    ctx.restore();

    // ==========================================================
    // STORAGE CRATES
    // ==========================================================

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

    // ==========================================================
    // ADMIN TERMINAL
    // ==========================================================

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

  drawTable(
    x,
    y,
    w,
    h
  ) {
    const ctx =
      this.ctx;

    ctx.save();

    ctx.shadowColor =
      "rgba(0,0,0,0.45)";

    ctx.shadowBlur = 8;

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

    ctx.shadowBlur = 0;

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

    ctx.strokeStyle =
      "rgba(150,180,210,0.3)";

    ctx.lineWidth = 2;

    ctx.stroke();

    ctx.restore();
  }

  // ============================================================
  // CONSOLE
  // ============================================================

  drawConsole(
    x,
    y,
    glow
  ) {
    const ctx =
      this.ctx;

    ctx.save();

    // Console glow
    const light =
      ctx.createRadialGradient(
        x + 27,
        y + 24,
        2,
        x + 27,
        y + 24,
        55
      );

    light.addColorStop(
      0,
      "rgba(80,190,255,0.12)"
    );

    light.addColorStop(
      1,
      "rgba(80,190,255,0)"
    );

    ctx.fillStyle =
      light;

    ctx.beginPath();

    ctx.arc(
      x + 27,
      y + 24,
      55,
      0,
      Math.PI * 2
    );

    ctx.fill();

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

  drawMonitor(
    x,
    y
  ) {
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

    // Screen scan line
    ctx.strokeStyle =
      "rgba(125,211,252,0.35)";

    ctx.lineWidth = 1;

    const scanY =
      y +
      7 +
      ((this.visualTime * 20) %
        18);

    ctx.beginPath();

    ctx.moveTo(
      x + 7,
      scanY
    );

    ctx.lineTo(
      x + 38,
      scanY
    );

    ctx.stroke();

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

  drawCrate(
    x,
    y
  ) {
    const ctx =
      this.ctx;

    ctx.save();

    ctx.shadowColor =
      "rgba(0,0,0,0.4)";

    ctx.shadowBlur = 7;

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

    ctx.shadowBlur = 0;

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

  drawDoors(
    sabotage
  ) {
    const ctx =
      this.ctx;

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
          sabotage.type ===
            "doors";

        ctx.shadowColor =
          blocked
            ? "rgba(255,30,30,0.55)"
            : "rgba(120,180,255,0.2)";

        ctx.shadowBlur =
          blocked ? 12 : 4;

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

        ctx.shadowBlur = 0;

        // Door center indicator
        ctx.fillStyle =
          blocked
            ? "#fee2e2"
            : "#dbeafe";

        if (
          door.vertical
        ) {
          ctx.fillRect(
            door.x + door.w / 2 - 2,
            door.y + 8,
            4,
            door.h - 16
          );
        } else {
          ctx.fillRect(
            door.x + 8,
            door.y + door.h / 2 - 2,
            door.w - 16,
            4
          );
        }

        ctx.restore();
      }
    );
  }

  // ============================================================
  // OBSTACLES
  // ============================================================

  drawObstacles() {
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
        const ctx =
          this.ctx;

        ctx.save();

        // Shadow underneath object
        ctx.fillStyle =
          "rgba(0,0,0,0.20)";

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

  drawTasks(
    localTasks = []
  ) {
    if (
      !Array.isArray(
        localTasks
      ) ||
      localTasks.length === 0
    ) {
      return;
    }

    const ctx =
      this.ctx;

    const assignedIds =
      new Set(
        localTasks.map(
          (task) =>
            task.id
        )
      );

    TASKS
      .filter(
        (task) =>
          assignedIds.has(
            task.id
          )
      )
      .forEach(
        (task) => {
          const localTask =
            localTasks.find(
              (t) =>
                t.id ===
                task.id
            );

          const done =
            !!(
              localTask &&
              localTask.completed
            );

          ctx.save();

          if (!done) {
            const pulse =
              1 +
              Math.sin(
                this.visualTime * 4
              ) *
                0.12;

            // Task outer glow
            ctx.shadowColor =
              "#facc15";

            ctx.shadowBlur = 18;

            ctx.beginPath();

            ctx.arc(
              task.x,
              task.y,
              10 * pulse,
              0,
              Math.PI * 2
            );

            ctx.fillStyle =
              "#facc15";

            ctx.fill();

            ctx.shadowBlur = 0;
          } else {
            ctx.beginPath();

            ctx.arc(
              task.x,
              task.y,
              10,
              0,
              Math.PI * 2
            );

            ctx.fillStyle =
              "#22c55e";

            ctx.fill();
          }

          ctx.strokeStyle =
            "#020617";

          ctx.lineWidth = 2;

          ctx.stroke();

          ctx.fillStyle =
            "#111827";

          ctx.font =
            "bold 10px Arial";

          ctx.textAlign =
            "center";

          ctx.textBaseline =
            "middle";

          ctx.fillText(
            done
              ? "✓"
              : "!",
            task.x,
            task.y
          );

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

  drawBodies(
    bodies = []
  ) {
    if (
      !Array.isArray(
        bodies
      )
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

        // Body glow
        ctx.shadowColor =
          "rgba(255,40,40,0.45)";

        ctx.shadowBlur = 12;

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

        ctx.shadowBlur = 0;

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

    if (
      net.players instanceof Map
    ) {
      players =
        Array.from(
          net.players.values()
        );
    } else if (
      Array.isArray(
        net.players
      )
    ) {
      players =
        net.players;
    } else if (
      net.players &&
      typeof net.players ===
        "object"
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
        player.connected ===
        false
      ) {
        continue;
      }

      if (
        player.alive ===
        false
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

  drawPlayer(
    player,
    net
  ) {
    const ctx =
      this.ctx;

    const x =
      Number.isFinite(
        player.renderX
      )
        ? player.renderX
        : player.x;

    const y =
      Number.isFinite(
        player.renderY
      )
        ? player.renderY
        : player.y;

    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return;
    }

    const isLocal =
      player.id ===
      net.playerId;

    ctx.save();

    ctx.translate(
      x,
      y
    );

    // Player shadow
    ctx.fillStyle =
      "rgba(0,0,0,0.40)";

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

    // Local player glow
    if (isLocal) {
      ctx.shadowColor =
        "rgba(130,220,255,0.85)";

      ctx.shadowBlur = 18;
    }

    // Body
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

    ctx.strokeStyle =
      "#0b1220";

    ctx.lineWidth = 3;

    ctx.stroke();

    // Backpack
    ctx.fillStyle =
      player.color ||
      "#38bdf8";

    ctx.fillRect(
      -21,
      -8,
      7,
      17
    );

    // Visor
    const visor =
      ctx.createLinearGradient(
        -7,
        -12,
        9,
        0
      );

    visor.addColorStop(
      0,
      "#e9fbff"
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

    // Visor reflection
    ctx.fillStyle =
      "rgba(255,255,255,0.58)";

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

    // Feet
    ctx.fillStyle =
      "#18232d";

    ctx.beginPath();

    ctx.roundRect(
      -11,
      13,
      8,
      7,
      3
    );

    ctx.roundRect(
      3,
      13,
      8,
      7,
      3
    );

    ctx.fill();

    // Name
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

    // Local player selection ring
    if (isLocal) {
      const pulse =
        1 +
        Math.sin(
          this.visualTime * 3
        ) *
          0.06;

      ctx.strokeStyle =
        "rgba(255,255,255,0.85)";

      ctx.lineWidth = 2;

      ctx.beginPath();

      ctx.arc(
        0,
        0,
        23 * pulse,
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

  drawGhost(
    player
  ) {
    const ctx =
      this.ctx;

    const x =
      Number.isFinite(
        player.renderX
      )
        ? player.renderX
        : player.x;

    const y =
      Number.isFinite(
        player.renderY
      )
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

    ctx.shadowColor =
      "rgba(180,230,255,0.5)";

    ctx.shadowBlur = 12;

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

    ctx.shadowBlur = 0;

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
      ([x, y], index) => {
        const pulse =
          0.45 +
          Math.sin(
            this.visualTime * 2 +
              index * 0.8
          ) *
            0.12;

        ctx.fillStyle =
          `rgba(100,190,255,${pulse})`;

        ctx.fillRect(
          x,
          y,
          18,
          3
        );
      }
    );

    // Hull floor strips
    ctx.strokeStyle =
      "rgba(100,150,190,0.25)";

    ctx.lineWidth = 2;

    for (
      let x = 60;
      x <
      WORLD.width - 60;
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
  // FLASHLIGHT / TORCH VISION
  // ============================================================

  drawFlashlight(net) {
    const me =
      net?.me;

    if (!me) {
      return;
    }

    if (
      me.alive === false
    ) {
      return;
    }

    const x =
      Number.isFinite(
        me.renderX
      )
        ? me.renderX
        : me.x;

    const y =
      Number.isFinite(
        me.renderY
      )
        ? me.renderY
        : me.y;

    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return;
    }

    const player =
      this.worldToScreen(
        x,
        y
      );

    const ctx =
      this.ctx;

    /*
     * This is intentionally done as a normal dark overlay
     * rather than destination-out. This prevents the browser
     * page behind the canvas from becoming visible.
     */

    const darkness =
      ctx.createRadialGradient(
        player.x,
        player.y,
        45,

        player.x,
        player.y,
        285
      );

    // Center remains clear.
    darkness.addColorStop(
      0,
      "rgba(0,0,0,0)"
    );

    darkness.addColorStop(
      0.28,
      "rgba(0,0,0,0.04)"
    );

    darkness.addColorStop(
      0.52,
      "rgba(0,0,0,0.20)"
    );

    darkness.addColorStop(
      0.72,
      "rgba(0,0,0,0.48)"
    );

    darkness.addColorStop(
      0.88,
      "rgba(0,0,0,0.68)"
    );

    darkness.addColorStop(
      1,
      "rgba(0,0,0,0.82)"
    );

    ctx.save();

    ctx.fillStyle =
      darkness;

    ctx.fillRect(
      0,
      0,
      this.viewW,
      this.viewH
    );

    ctx.restore();

    /*
     * Soft torch light.
     */

    const torch =
      ctx.createRadialGradient(
        player.x,
        player.y,
        5,

        player.x,
        player.y,
        210
      );

    torch.addColorStop(
      0,
      "rgba(255,255,255,0.13)"
    );

    torch.addColorStop(
      0.20,
      "rgba(220,245,255,0.09)"
    );

    torch.addColorStop(
      0.45,
      "rgba(130,205,255,0.045)"
    );

    torch.addColorStop(
      0.72,
      "rgba(80,150,220,0.018)"
    );

    torch.addColorStop(
      1,
      "rgba(0,0,0,0)"
    );

    ctx.save();

    ctx.globalCompositeOperation =
      "screen";

    ctx.fillStyle =
      torch;

    ctx.beginPath();

    ctx.arc(
      player.x,
      player.y,
      210,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.restore();

    /*
     * Small bright center around the player.
     */

    const centerLight =
      ctx.createRadialGradient(
        player.x,
        player.y,
        0,

        player.x,
        player.y,
        75
      );

    centerLight.addColorStop(
      0,
      "rgba(255,255,255,0.10)"
    );

    centerLight.addColorStop(
      0.55,
      "rgba(180,225,255,0.035)"
    );

    centerLight.addColorStop(
      1,
      "rgba(0,0,0,0)"
    );

    ctx.save();

    ctx.globalCompositeOperation =
      "screen";

    ctx.fillStyle =
      centerLight;

    ctx.beginPath();

    ctx.arc(
      player.x,
      player.y,
      75,
      0,
      Math.PI * 2
    );

    ctx.fill();

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
      0.65,
      "rgba(0,0,0,0.06)"
    );

    gradient.addColorStop(
      0.85,
      "rgba(0,0,0,0.20)"
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

    // ----------------------------------------------------------
    // Electrical sabotage
    // ----------------------------------------------------------

    if (
      sabotage.type ===
      "electrical"
    ) {
      ctx.save();

      const pulse =
        0.04 +
        Math.sin(
          this.visualTime * 5
        ) *
          0.025;

      ctx.fillStyle =
        `rgba(20,0,0,${Math.max(
          0.015,
          pulse
        )})`;

      ctx.fillRect(
        0,
        0,
        this.viewW,
        this.viewH
      );

      ctx.strokeStyle =
        "rgba(239,68,68,0.35)";

      ctx.lineWidth = 3;

      ctx.strokeRect(
        2,
        2,
        this.viewW - 4,
        this.viewH - 4
      );

      ctx.restore();
    }

    // ----------------------------------------------------------
    // Doors sabotage
    // ----------------------------------------------------------

    if (
      sabotage.type ===
      "doors"
    ) {
      ctx.save();

      ctx.strokeStyle =
        "rgba(239,68,68,0.16)";

      ctx.lineWidth = 2;

      ctx.strokeRect(
        5,
        5,
        this.viewW - 10,
        this.viewH - 10
      );

      ctx.restore();
    }
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

    const interactionRange =
      Number.isFinite(range)
        ? Math.max(
            range,
            DEFAULT_INTERACTION_RANGE
          )
        : DEFAULT_INTERACTION_RANGE;

    let nearestDistance =
      interactionRange;

    const tasks =
      Array.isArray(
        localTasks
      )
        ? localTasks
        : [];

    const assignedIds =
      new Set(
        tasks.map(
          (task) =>
            task.id
        )
      );

    // ----------------------------------------------------------
    // TASK INTERACTION
    // ----------------------------------------------------------

    TASKS
      .filter(
        (task) =>
          assignedIds.has(
            task.id
          )
      )
      .forEach(
        (task) => {
          const localTask =
            tasks.find(
              (t) =>
                t.id ===
                task.id
            );

          /*
           * Never show completed tasks.
           */
          if (
            localTask &&
            localTask.completed
          ) {
            return;
          }

          if (
            !Number.isFinite(
              task.x
            ) ||
            !Number.isFinite(
              task.y
            )
          ) {
            return;
          }

          const distance =
            Math.hypot(
              task.x -
                worldX,

              task.y -
                worldY
            );

          /*
           * Task markers represent the interaction
           * area around the actual equipment.
           *
           * The server performs the final validation.
           */
          if (
            distance <=
            nearestDistance
          ) {
            nearestDistance =
              distance;

            nearest = {
              type: "task",
              task,
              distance,
            };
          }
        }
      );

    // ----------------------------------------------------------
    // BODY REPORT INTERACTION
    // ----------------------------------------------------------

    if (
      Array.isArray(
        bodies
      )
    ) {
      bodies.forEach(
        (body) => {
          if (!body) return;

          if (
            !Number.isFinite(
              body.x
            ) ||
            !Number.isFinite(
              body.y
            )
          ) {
            return;
          }

          const distance =
            Math.hypot(
              body.x -
                worldX,

              body.y -
                worldY
            );

          if (
            distance <=
            nearestDistance
          ) {
            nearestDistance =
              distance;

            nearest = {
              type: "body",
              body,
              distance,
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