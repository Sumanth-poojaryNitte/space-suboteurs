import {
  WORLD,
  ROOMS,
  CORRIDORS,
  OBSTACLES,
  DOORS,
  TASKS,
  LIGHTS,
  ROOM_THEMES,
} from "./MapData.js";

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");

    this.camera = {
      x: WORLD.width / 2,
      y: WORLD.height / 2,
      targetX: WORLD.width / 2,
      targetY: WORLD.height / 2,
      zoom: 1,
    };

    this.lastTime = performance.now();

    this.particles = [];
    this.stars = [];

    for (let i = 0; i < 180; i++) {
      this.stars.push({
        x: Math.random() * WORLD.width,
        y: Math.random() * WORLD.height,
        r: Math.random() * 1.8 + 0.3,
        alpha: Math.random() * 0.6 + 0.2,
      });
    }

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width =
      Math.floor(window.innerWidth * dpr);

    this.canvas.height =
      Math.floor(window.innerHeight * dpr);

    this.canvas.style.width =
      `${window.innerWidth}px`;

    this.canvas.style.height =
      `${window.innerHeight}px`;

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  worldToScreen(x, y) {
    const width = window.innerWidth;
    const height = window.innerHeight;

    return {
      x:
        (x - this.camera.x) *
          this.camera.zoom +
        width / 2,

      y:
        (y - this.camera.y) *
          this.camera.zoom +
        height / 2,
    };
  }

  screenToWorld(x, y) {
    const width = window.innerWidth;
    const height = window.innerHeight;

    return {
      x:
        (x - width / 2) /
          this.camera.zoom +
        this.camera.x,

      y:
        (y - height / 2) /
          this.camera.zoom +
        this.camera.y,
    };
  }

  updateCamera(player) {
    if (!player) return;

    this.camera.targetX = player.renderX;
    this.camera.targetY = player.renderY;

    const smooth = 0.075;

    this.camera.x +=
      (this.camera.targetX - this.camera.x) *
      smooth;

    this.camera.y +=
      (this.camera.targetY - this.camera.y) *
      smooth;
  }

  clear() {
    const ctx = this.ctx;

    ctx.clearRect(
      0,
      0,
      window.innerWidth,
      window.innerHeight
    );

    const gradient = ctx.createLinearGradient(
      0,
      0,
      0,
      window.innerHeight
    );

    gradient.addColorStop(0, "#050810");
    gradient.addColorStop(1, "#0b101a");

    ctx.fillStyle = gradient;

    ctx.fillRect(
      0,
      0,
      window.innerWidth,
      window.innerHeight
    );
  }

  draw(net, sabotageActive = {}) {
    const now = performance.now();
    const dt =
      Math.min(now - this.lastTime, 50) / 1000;

    this.lastTime = now;

    this.clear();

    if (!net) return;

    this.updateCamera(net.me);

    const ctx = this.ctx;

    ctx.save();

    ctx.translate(
      window.innerWidth / 2,
      window.innerHeight / 2
    );

    ctx.scale(
      this.camera.zoom,
      this.camera.zoom
    );

    ctx.translate(
      -this.camera.x,
      -this.camera.y
    );

    this.drawSpaceBackground();
    this.drawStationHull();
    this.drawCorridors();
    this.drawRooms();
    this.drawRoomDetails();
    this.drawDoors(sabotageActive);
    this.drawObstacles();
    this.drawLights(sabotageActive);
    this.drawTasks(net);
    this.drawBodies(net);

    for (const player of net.players || []) {
      if (!player.connected) continue;

      if (!player.alive) {
        this.drawGhost(player);
        continue;
      }

      this.drawPlayer(player, net);
    }

    this.drawStationDetails();

    ctx.restore();

    this.drawVignette();
    this.drawSabotageOverlay(sabotageActive);
  }

  // ==========================================================
  // SPACE BACKGROUND
  // ==========================================================

  drawSpaceBackground() {
    const ctx = this.ctx;

    ctx.fillStyle = "#02040a";

    ctx.fillRect(
      -500,
      -500,
      WORLD.width + 1000,
      WORLD.height + 1000
    );

    for (const star of this.stars) {
      ctx.globalAlpha = star.alpha;

      ctx.fillStyle = "#dbeafe";

      ctx.beginPath();

      ctx.arc(
        star.x,
        star.y,
        star.r,
        0,
        Math.PI * 2
      );

      ctx.fill();
    }

    ctx.globalAlpha = 1;

    // distant nebula glow

    const nebula = ctx.createRadialGradient(
      1000,
      400,
      50,
      1000,
      400,
      1000
    );

    nebula.addColorStop(
      0,
      "rgba(40,90,140,0.16)"
    );

    nebula.addColorStop(
      1,
      "rgba(0,0,0,0)"
    );

    ctx.fillStyle = nebula;

    ctx.fillRect(
      -100,
      -100,
      WORLD.width + 200,
      WORLD.height + 200
    );
  }

  // ==========================================================
  // STATION OUTER HULL
  // ==========================================================

  drawStationHull() {
    const ctx = this.ctx;

    ctx.save();

    ctx.shadowBlur = 40;
    ctx.shadowColor = "rgba(0,180,255,0.18)";

    const hullGradient =
      ctx.createLinearGradient(
        0,
        0,
        0,
        WORLD.height
      );

    hullGradient.addColorStop(
      0,
      "#1b2736"
    );

    hullGradient.addColorStop(
      0.5,
      "#101a27"
    );

    hullGradient.addColorStop(
      1,
      "#0a111c"
    );

    ctx.fillStyle = hullGradient;

    ctx.beginPath();

    ctx.roundRect(
      25,
      45,
      WORLD.width - 50,
      WORLD.height - 90,
      48
    );

    ctx.fill();

    ctx.shadowBlur = 0;

    ctx.strokeStyle =
      "rgba(105,180,230,0.32)";

    ctx.lineWidth = 8;

    ctx.stroke();

    ctx.strokeStyle =
      "rgba(255,255,255,0.08)";

    ctx.lineWidth = 2;

    ctx.stroke();

    ctx.restore();
  }

  // ==========================================================
  // CORRIDORS
  // ==========================================================

  drawCorridors() {
    const ctx = this.ctx;

    for (const corridor of CORRIDORS) {
      const gradient =
        ctx.createLinearGradient(
          corridor.x,
          corridor.y,
          corridor.x,
          corridor.y + corridor.h
        );

      gradient.addColorStop(
        0,
        "#172331"
      );

      gradient.addColorStop(
        0.5,
        "#0e1824"
      );

      gradient.addColorStop(
        1,
        "#172331"
      );

      ctx.fillStyle = gradient;

      ctx.fillRect(
        corridor.x,
        corridor.y,
        corridor.w,
        corridor.h
      );

      // floor strips

      ctx.strokeStyle =
        "rgba(105,160,190,0.13)";

      ctx.lineWidth = 2;

      if (corridor.type === "horizontal") {
        for (
          let x = corridor.x + 20;
          x < corridor.x + corridor.w;
          x += 45
        ) {
          ctx.beginPath();

          ctx.moveTo(
            x,
            corridor.y + 10
          );

          ctx.lineTo(
            x,
            corridor.y + corridor.h - 10
          );

          ctx.stroke();
        }
      } else {
        for (
          let y = corridor.y + 20;
          y < corridor.y + corridor.h;
          y += 45
        ) {
          ctx.beginPath();

          ctx.moveTo(
            corridor.x + 10,
            y
          );

          ctx.lineTo(
            corridor.x + corridor.w - 10,
            y
          );

          ctx.stroke();
        }
      }

      this.drawHazardStripes(
        corridor.x,
        corridor.y,
        corridor.w,
        corridor.h
      );
    }
  }

  // ==========================================================
  // ROOMS
  // ==========================================================

  drawRooms() {
    const ctx = this.ctx;

    for (const [name, room] of Object.entries(ROOMS)) {
      const theme =
        ROOM_THEMES[name] ||
        ROOM_THEMES.admin;

      const gradient =
        ctx.createLinearGradient(
          room.x,
          room.y,
          room.x,
          room.y + room.h
        );

      gradient.addColorStop(
        0,
        theme.floorAlt
      );

      gradient.addColorStop(
        1,
        theme.floor
      );

      ctx.fillStyle = gradient;

      ctx.beginPath();

      ctx.roundRect(
        room.x,
        room.y,
        room.w,
        room.h,
        18
      );

      ctx.fill();

      // Floor panels

      ctx.strokeStyle =
        "rgba(150,190,220,0.08)";

      ctx.lineWidth = 1;

      const grid = 40;

      for (
        let x = room.x + grid;
        x < room.x + room.w;
        x += grid
      ) {
        ctx.beginPath();

        ctx.moveTo(
          x,
          room.y + 8
        );

        ctx.lineTo(
          x,
          room.y + room.h - 8
        );

        ctx.stroke();
      }

      for (
        let y = room.y + grid;
        y < room.y + room.h;
        y += grid
      ) {
        ctx.beginPath();

        ctx.moveTo(
          room.x + 8,
          y
        );

        ctx.lineTo(
          room.x + room.w - 8,
          y
        );

        ctx.stroke();
      }

      // Room border

      ctx.strokeStyle =
        "rgba(120,170,205,0.28)";

      ctx.lineWidth = 5;

      ctx.strokeRect(
        room.x + 2,
        room.y + 2,
        room.w - 4,
        room.h - 4
      );

      // Inner border

      ctx.strokeStyle =
        `${theme.accent}22`;

      ctx.lineWidth = 2;

      ctx.strokeRect(
        room.x + 10,
        room.y + 10,
        room.w - 20,
        room.h - 20
      );

      this.drawRoomLabel(
        room,
        theme.accent
      );
    }
  }

  drawRoomLabel(room, accent) {
    const ctx = this.ctx;

    ctx.save();

    ctx.font =
      "bold 14px Arial, sans-serif";

    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    ctx.fillStyle =
      "rgba(220,240,255,0.45)";

    ctx.fillText(
      room.label.toUpperCase(),
      room.x + 18,
      room.y + 15
    );

    ctx.fillStyle = accent;

    ctx.fillRect(
      room.x + 18,
      room.y + 34,
      38,
      3
    );

    ctx.restore();
  }

  // ==========================================================
  // ROOM DETAILS
  // ==========================================================

  drawRoomDetails() {
    this.drawCafeteria();
    this.drawReactor();
    this.drawElectrical();
    this.drawMedbay();
    this.drawSecurity();
    this.drawAdmin();
    this.drawNavigation();
    this.drawCommunications();
    this.drawStorage();
  }

  // ==========================================================
  // CAFETERIA
  // ==========================================================

  drawCafeteria() {
    const ctx = this.ctx;

    const tables = [
      [790, 155, 115, 55],
      [940, 155, 115, 55],
      [790, 285, 115, 55],
      [940, 285, 115, 55],
    ];

    for (const [x, y, w, h] of tables) {
      ctx.save();

      ctx.shadowBlur = 14;
      ctx.shadowColor =
        "rgba(0,0,0,0.45)";

      ctx.fillStyle = "#25384b";

      ctx.beginPath();

      ctx.roundRect(
        x,
        y,
        w,
        h,
        15
      );

      ctx.fill();

      ctx.shadowBlur = 0;

      ctx.strokeStyle =
        "#49667d";

      ctx.lineWidth = 3;

      ctx.stroke();

      // tabletop

      ctx.fillStyle =
        "rgba(100,180,220,0.12)";

      ctx.beginPath();

      ctx.ellipse(
        x + w / 2,
        y + h / 2,
        w * 0.36,
        h * 0.3,
        0,
        0,
        Math.PI * 2
      );

      ctx.fill();

      // center light

      ctx.fillStyle =
        "#78d9ff";

      ctx.beginPath();

      ctx.arc(
        x + w / 2,
        y + h / 2,
        4,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.restore();

      // chairs

      this.drawChair(
        x + 12,
        y - 15
      );

      this.drawChair(
        x + w - 25,
        y - 15
      );

      this.drawChair(
        x + 12,
        y + h + 3
      );

      this.drawChair(
        x + w - 25,
        y + h + 3
      );
    }

    // Central emergency table

    ctx.save();

    ctx.fillStyle = "#172634";

    ctx.beginPath();

    ctx.roundRect(
      1100,
      340,
      70,
      35,
      10
    );

    ctx.fill();

    ctx.strokeStyle =
      "#4d7187";

    ctx.stroke();

    ctx.fillStyle =
      "#d94b55";

    ctx.beginPath();

    ctx.arc(
      1135,
      357,
      8,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.restore();
  }

  drawChair(x, y) {
    const ctx = this.ctx;

    ctx.fillStyle = "#364d61";

    ctx.beginPath();

    ctx.roundRect(
      x,
      y,
      18,
      13,
      4
    );

    ctx.fill();
  }

  // ==========================================================
  // REACTOR
  // ==========================================================

  drawReactor() {
    const ctx = this.ctx;

    ctx.save();

    // pipes

    ctx.strokeStyle = "#435262";
    ctx.lineWidth = 13;

    ctx.beginPath();

    ctx.moveTo(90, 120);
    ctx.lineTo(145, 120);
    ctx.lineTo(145, 290);

    ctx.stroke();

    ctx.strokeStyle = "#68798b";
    ctx.lineWidth = 4;

    ctx.stroke();

    // Reactor core

    const glow =
      ctx.createRadialGradient(
        210,
        200,
        15,
        210,
        200,
        100
      );

    glow.addColorStop(
      0,
      "rgba(255,90,100,0.8)"
    );

    glow.addColorStop(
      0.5,
      "rgba(255,60,80,0.18)"
    );

    glow.addColorStop(
      1,
      "rgba(255,60,80,0)"
    );

    ctx.fillStyle = glow;

    ctx.beginPath();

    ctx.arc(
      210,
      200,
      105,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.fillStyle = "#151d28";

    ctx.beginPath();

    ctx.arc(
      210,
      200,
      72,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.strokeStyle =
      "#697a8d";

    ctx.lineWidth = 8;

    ctx.stroke();

    // energy ring

    ctx.strokeStyle =
      "#ff5f61";

    ctx.lineWidth = 5;

    ctx.beginPath();

    ctx.arc(
      210,
      200,
      48,
      0,
      Math.PI * 2
    );

    ctx.stroke();

    ctx.fillStyle =
      "#ff6262";

    ctx.beginPath();

    ctx.arc(
      210,
      200,
      18,
      0,
      Math.PI * 2
    );

    ctx.fill();

    // Reactor bars

    for (let i = 0; i < 5; i++) {
      ctx.fillStyle =
        i % 2 === 0
          ? "#ff555b"
          : "#7b343c";

      ctx.fillRect(
        112 + i * 38,
        308,
        24,
        12
      );
    }

    ctx.restore();
  }

  // ==========================================================
  // ELECTRICAL
  // ==========================================================

  drawElectrical() {
    const ctx = this.ctx;

    const panels = [
      [100, 465],
      [250, 465],
    ];

    for (const [x, y] of panels) {
      ctx.save();

      ctx.fillStyle = "#161b21";

      ctx.beginPath();

      ctx.roundRect(
        x,
        y,
        65,
        85,
        6
      );

      ctx.fill();

      ctx.strokeStyle =
        "#56636e";

      ctx.lineWidth = 3;

      ctx.stroke();

      // panel lights

      for (let i = 0; i < 5; i++) {
        ctx.fillStyle =
          i % 2
            ? "#4ee38a"
            : "#e4bd55";

        ctx.beginPath();

        ctx.arc(
          x + 14,
          y + 15 + i * 12,
          3,
          0,
          Math.PI * 2
        );

        ctx.fill();
      }

      // switches

      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = "#34424e";

        ctx.fillRect(
          x + 30,
          y + 12 + i * 16,
          24,
          8
        );
      }

      ctx.restore();
    }

    // Generator

    ctx.save();

    ctx.fillStyle = "#171d23";

    ctx.beginPath();

    ctx.roundRect(
      125,
      590,
      150,
      50,
      8
    );

    ctx.fill();

    ctx.strokeStyle =
      "#667581";

    ctx.lineWidth = 3;

    ctx.stroke();

    ctx.fillStyle =
      "#ffd166";

    ctx.fillRect(
      140,
      603,
      35,
      20
    );

    ctx.fillStyle =
      "#24323c";

    ctx.fillRect(
      185,
      603,
      75,
      20
    );

    ctx.restore();

    // cables

    ctx.strokeStyle =
      "#596674";

    ctx.lineWidth = 4;

    for (let i = 0; i < 5; i++) {
      ctx.beginPath();

      ctx.moveTo(
        165 + i * 20,
        550
      );

      ctx.bezierCurveTo(
        165 + i * 20,
        565,
        160 + i * 20,
        580,
        165 + i * 20,
        590
      );

      ctx.stroke();
    }
  }

  // ==========================================================
  // MEDBAY
  // ==========================================================

  drawMedbay() {
    const ctx = this.ctx;

    // scanner platform

    ctx.save();

    ctx.fillStyle = "#203b3e";

    ctx.beginPath();

    ctx.roundRect(
      540,
      520,
      100,
      70,
      12
    );

    ctx.fill();

    ctx.strokeStyle =
      "#5ddbc8";

    ctx.lineWidth = 3;

    ctx.stroke();

    ctx.fillStyle =
      "rgba(100,255,230,0.18)";

    ctx.fillRect(
      552,
      530,
      76,
      42
    );

    // scan line

    ctx.strokeStyle =
      "#6affdf";

    ctx.lineWidth = 3;

    ctx.beginPath();

    ctx.moveTo(
      555,
      550
    );

    ctx.lineTo(
      625,
      550
    );

    ctx.stroke();

    ctx.restore();

    // medical beds

    this.drawBed(
      485,
      605,
      65,
      38
    );

    this.drawBed(
      635,
      605,
      65,
      38
    );
  }

  drawBed(x, y, w, h) {
    const ctx = this.ctx;

    ctx.fillStyle = "#cbd5df";

    ctx.beginPath();

    ctx.roundRect(
      x,
      y,
      w,
      h,
      7
    );

    ctx.fill();

    ctx.fillStyle = "#e8f1f5";

    ctx.fillRect(
      x + 5,
      y + 5,
      w - 10,
      h * 0.45
    );

    ctx.fillStyle =
      "#4a6571";

    ctx.fillRect(
      x,
      y + h - 5,
      w,
      5
    );
  }

  // ==========================================================
  // SECURITY
  // ==========================================================

  drawSecurity() {
    const ctx = this.ctx;

    ctx.save();

    ctx.fillStyle = "#101923";

    ctx.beginPath();

    ctx.roundRect(
      865,
      500,
      150,
      55,
      8
    );

    ctx.fill();

    ctx.strokeStyle =
      "#52759a";

    ctx.lineWidth = 3;

    ctx.stroke();

    for (let i = 0; i < 4; i++) {
      const x = 878 + i * 33;

      ctx.fillStyle =
        "rgba(70,160,255,0.22)";

      ctx.fillRect(
        x,
        512,
        25,
        25
      );

      ctx.strokeStyle =
        "#5b9bd5";

      ctx.strokeRect(
        x,
        512,
        25,
        25
      );

      ctx.fillStyle =
        "#69b5ff";

      ctx.beginPath();

      ctx.arc(
        x + 12,
        524,
        4,
        0,
        Math.PI * 2
      );

      ctx.fill();
    }

    ctx.restore();

    // security chair

    ctx.fillStyle = "#33475b";

    ctx.beginPath();

    ctx.arc(
      940,
      590,
      25,
      0,
      Math.PI * 2
    );

    ctx.fill();
  }

  // ==========================================================
  // ADMIN
  // ==========================================================

  drawAdmin() {
    const ctx = this.ctx;

    const consoles = [
      [1220, 130],
      [1350, 130],
    ];

    for (const [x, y] of consoles) {
      ctx.save();

      ctx.fillStyle = "#15202b";

      ctx.beginPath();

      ctx.roundRect(
        x,
        y,
        90,
        55,
        8
      );

      ctx.fill();

      ctx.strokeStyle =
        "#5c7c98";

      ctx.lineWidth = 3;

      ctx.stroke();

      ctx.fillStyle =
        "rgba(80,170,255,0.18)";

      ctx.fillRect(
        x + 12,
        y + 10,
        66,
        26
      );

      ctx.strokeStyle =
        "#5aa9e6";

      ctx.strokeRect(
        x + 12,
        y + 10,
        66,
        26
      );

      ctx.fillStyle =
        "#64d9ff";

      ctx.beginPath();

      ctx.arc(
        x + 18,
        y + 43,
        3,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.restore();
    }

    // command table

    ctx.fillStyle = "#273847";

    ctx.beginPath();

    ctx.roundRect(
      1260,
      245,
      140,
      55,
      12
    );

    ctx.fill();

    ctx.strokeStyle =
      "#587286";

    ctx.lineWidth = 3;

    ctx.stroke();
  }

  // ==========================================================
  // NAVIGATION
  // ==========================================================

  drawNavigation() {
    const ctx = this.ctx;

    ctx.save();

    ctx.fillStyle = "#111b27";

    ctx.beginPath();

    ctx.roundRect(
      1700,
      160,
      120,
      65,
      10
    );

    ctx.fill();

    ctx.strokeStyle =
      "#6385aa";

    ctx.lineWidth = 3;

    ctx.stroke();

    // radar

    ctx.strokeStyle =
      "#66b7ff";

    ctx.lineWidth = 2;

    ctx.beginPath();

    ctx.arc(
      1760,
      192,
      23,
      0,
      Math.PI * 2
    );

    ctx.stroke();

    ctx.beginPath();

    ctx.moveTo(
      1737,
      192
    );

    ctx.lineTo(
      1783,
      192
    );

    ctx.moveTo(
      1760,
      169
    );

    ctx.lineTo(
      1760,
      215
    );

    ctx.stroke();

    ctx.beginPath();

    ctx.moveTo(
      1760,
      192
    );

    ctx.lineTo(
      1778,
      178
    );

    ctx.stroke();

    ctx.fillStyle =
      "#64e5ff";

    ctx.beginPath();

    ctx.arc(
      1778,
      178,
      3,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.restore();
  }

  // ==========================================================
  // COMMUNICATIONS
  // ==========================================================

  drawCommunications() {
    const ctx = this.ctx;

    ctx.save();

    ctx.fillStyle = "#171422";

    ctx.beginPath();

    ctx.roundRect(
      1690,
      510,
      130,
      60,
      8
    );

    ctx.fill();

    ctx.strokeStyle =
      "#8c65b7";

    ctx.lineWidth = 3;

    ctx.stroke();

    // signal bars

    for (let i = 0; i < 5; i++) {
      ctx.fillStyle =
        i < 4
          ? "#c17cff"
          : "#553c6e";

      ctx.fillRect(
        1710 + i * 18,
        550 - i * 7,
        10,
        20 + i * 7
      );
    }

    // antenna

    ctx.strokeStyle =
      "#6d7686";

    ctx.lineWidth = 5;

    ctx.beginPath();

    ctx.moveTo(
      1840,
      610
    );

    ctx.lineTo(
      1840,
      525
    );

    ctx.stroke();

    ctx.strokeStyle =
      "#c47cff";

    ctx.lineWidth = 3;

    ctx.beginPath();

    ctx.arc(
      1840,
      520,
      28,
      -Math.PI * 0.85,
      -Math.PI * 0.15
    );

    ctx.stroke();

    ctx.beginPath();

    ctx.arc(
      1840,
      520,
      16,
      -Math.PI * 0.8,
      -Math.PI * 0.2
    );

    ctx.stroke();

    ctx.restore();
  }

  // ==========================================================
  // STORAGE
  // ==========================================================

  drawStorage() {
    const ctx = this.ctx;

    const crates = [
      [1215, 510],
      [1300, 510],
      [1215, 610],
    ];

    for (const [x, y] of crates) {
      this.drawCrate(x, y);
    }

    // fuel tank

    ctx.save();

    ctx.fillStyle = "#37414a";

    ctx.beginPath();

    ctx.roundRect(
      1390,
      590,
      65,
      85,
      14
    );

    ctx.fill();

    ctx.strokeStyle =
      "#7b8790";

    ctx.lineWidth = 3;

    ctx.stroke();

    ctx.fillStyle =
      "#e3a547";

    ctx.fillRect(
      1402,
      615,
      40,
      10
    );

    ctx.fillRect(
      1402,
      635,
      40,
      10
    );

    ctx.restore();
  }

  drawCrate(x, y) {
    const ctx = this.ctx;

    ctx.save();

    ctx.fillStyle = "#5b4933";

    ctx.beginPath();

    ctx.roundRect(
      x,
      y,
      70,
      70,
      6
    );

    ctx.fill();

    ctx.strokeStyle =
      "#9a7950";

    ctx.lineWidth = 4;

    ctx.stroke();

    ctx.strokeStyle =
      "#2f271d";

    ctx.lineWidth = 5;

    ctx.beginPath();

    ctx.moveTo(
      x + 8,
      y + 8
    );

    ctx.lineTo(
      x + 62,
      y + 62
    );

    ctx.moveTo(
      x + 62,
      y + 8
    );

    ctx.lineTo(
      x + 8,
      y + 62
    );

    ctx.stroke();

    ctx.restore();
  }

  // ==========================================================
  // DOORS
  // ==========================================================

  drawDoors(sabotageActive) {
    const ctx = this.ctx;

    for (const door of DOORS) {
      const closed =
        sabotageActive?.doors === true;

      ctx.save();

      ctx.fillStyle = closed
        ? "#632f3b"
        : "#273847";

      ctx.strokeStyle = closed
        ? "#ff5964"
        : "#7890a4";

      ctx.lineWidth = 3;

      ctx.beginPath();

      ctx.roundRect(
        door.x,
        door.y,
        door.w,
        door.h,
        5
      );

      ctx.fill();
      ctx.stroke();

      if (!closed) {
        ctx.fillStyle =
          "#67d9ff";

        ctx.fillRect(
          door.x + 4,
          door.y + 4,
          Math.max(3, door.w - 8),
          3
        );
      } else {
        ctx.fillStyle =
          "#ff4d5b";

        ctx.beginPath();

        ctx.arc(
          door.x + door.w / 2,
          door.y + door.h / 2,
          4,
          0,
          Math.PI * 2
        );

        ctx.fill();
      }

      ctx.restore();
    }
  }

  // ==========================================================
  // OBSTACLES
  // ==========================================================

  drawObstacles() {
    for (const obstacle of OBSTACLES) {
      switch (obstacle.type) {
        case "table":
          this.drawObstacleTable(obstacle);
          break;

        case "reactor":
          // Reactor already has custom art.
          break;

        case "panel":
          this.drawObstaclePanel(obstacle);
          break;

        case "generator":
          // Generator already has custom art.
          break;

        case "scanner":
          // Scanner already has custom art.
          break;

        case "console":
          this.drawObstacleConsole(obstacle);
          break;

        case "crate":
          // Crates already have custom art.
          break;

        case "navigation":
          // Navigation already has custom art.
          break;

        case "communications":
          // Communications already has custom art.
          break;

        default:
          this.drawGenericObstacle(obstacle);
      }
    }
  }

  drawObstacleTable(o) {
    const ctx = this.ctx;

    ctx.save();

    ctx.shadowBlur = 12;
    ctx.shadowColor =
      "rgba(0,0,0,0.5)";

    ctx.fillStyle = "#263b4d";

    ctx.beginPath();

    ctx.roundRect(
      o.x,
      o.y,
      o.w,
      o.h,
      14
    );

    ctx.fill();

    ctx.shadowBlur = 0;

    ctx.strokeStyle =
      "#536e83";

    ctx.lineWidth = 3;

    ctx.stroke();

    ctx.fillStyle =
      "rgba(100,190,230,0.14)";

    ctx.beginPath();

    ctx.ellipse(
      o.x + o.w / 2,
      o.y + o.h / 2,
      o.w * 0.32,
      o.h * 0.25,
      0,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.restore();
  }

  drawObstaclePanel(o) {
    const ctx = this.ctx;

    ctx.fillStyle = "#1a2027";

    ctx.fillRect(
      o.x,
      o.y,
      o.w,
      o.h
    );

    ctx.strokeStyle =
      "#63717d";

    ctx.lineWidth = 2;

    ctx.strokeRect(
      o.x,
      o.y,
      o.w,
      o.h
    );
  }

  drawObstacleConsole(o) {
    const ctx = this.ctx;

    ctx.save();

    ctx.fillStyle = "#111a24";

    ctx.beginPath();

    ctx.roundRect(
      o.x,
      o.y,
      o.w,
      o.h,
      8
    );

    ctx.fill();

    ctx.strokeStyle =
      "#516d86";

    ctx.lineWidth = 3;

    ctx.stroke();

    ctx.fillStyle =
      "rgba(70,170,255,0.18)";

    ctx.fillRect(
      o.x + 8,
      o.y + 7,
      o.w - 16,
      o.h * 0.42
    );

    ctx.fillStyle =
      "#59c8ff";

    ctx.beginPath();

    ctx.arc(
      o.x + 12,
      o.y + o.h - 10,
      3,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.restore();
  }

  drawGenericObstacle(o) {
    const ctx = this.ctx;

    ctx.fillStyle = "#26323d";

    ctx.fillRect(
      o.x,
      o.y,
      o.w,
      o.h
    );

    ctx.strokeStyle =
      "#536574";

    ctx.strokeRect(
      o.x,
      o.y,
      o.w,
      o.h
    );
  }

  // ==========================================================
  // LIGHTING
  // ==========================================================

  drawLights(sabotageActive) {
    const ctx = this.ctx;

    const electricalOff =
      sabotageActive?.electrical === true ||
      sabotageActive?.lights === true;

    if (electricalOff) return;

    for (const light of LIGHTS) {
      const color =
        light.color === "red"
          ? "255,80,80"
          : light.color === "cyan"
          ? "80,220,255"
          : light.color === "blue"
          ? "80,150,255"
          : light.color === "purple"
          ? "190,110,255"
          : light.color === "orange"
          ? "255,170,70"
          : light.color === "yellow"
          ? "255,220,100"
          : "220,240,255";

      const gradient =
        ctx.createRadialGradient(
          light.x,
          light.y,
          0,
          light.x,
          light.y,
          light.radius
        );

      gradient.addColorStop(
        0,
        `rgba(${color},${light.intensity * 0.18})`
      );

      gradient.addColorStop(
        0.55,
        `rgba(${color},${light.intensity * 0.06})`
      );

      gradient.addColorStop(
        1,
        `rgba(${color},0)`
      );

      ctx.fillStyle = gradient;

      ctx.beginPath();

      ctx.arc(
        light.x,
        light.y,
        light.radius,
        0,
        Math.PI * 2
      );

      ctx.fill();
    }
  }

  // ==========================================================
  // TASKS
  // ==========================================================

  drawTasks(net) {
    if (!net?.privateState?.tasks) {
      return;
    }

    const taskMap = new Map(
      net.privateState.tasks.map(
        (task) => [task.id, task]
      )
    );

    for (const task of TASKS) {
      const state =
        taskMap.get(task.id);

      if (!state || state.completed) {
        continue;
      }

      this.drawTaskMarker(task);
    }
  }

  drawTaskMarker(task) {
    const ctx = this.ctx;

    const pulse =
      1 +
      Math.sin(
        performance.now() / 280
      ) *
        0.12;

    ctx.save();

    ctx.shadowBlur = 18;
    ctx.shadowColor =
      "rgba(255,205,80,0.8)";

    ctx.fillStyle =
      "#ffd45c";

    ctx.beginPath();

    ctx.arc(
      task.x,
      task.y,
      10 * pulse,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.shadowBlur = 0;

    ctx.fillStyle =
      "#4b3a12";

    ctx.font =
      "bold 12px Arial";

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(
      "!",
      task.x,
      task.y
    );

    ctx.restore();
  }

  // ==========================================================
  // PLAYERS
  // ==========================================================

  drawPlayer(player, net) {
    const ctx = this.ctx;

    const x = player.renderX;
    const y = player.renderY;

    const isMe =
      player.id === net.playerId;

    const moving =
      Math.abs(player.vx || 0) +
        Math.abs(player.vy || 0) >
      5;

    const time =
      performance.now() / 110;

    const bob = moving
      ? Math.sin(time) * 2.5
      : 0;

    const legMove = moving
      ? Math.sin(time) * 5
      : 0;

    ctx.save();

    // shadow

    ctx.fillStyle =
      "rgba(0,0,0,0.45)";

    ctx.beginPath();

    ctx.ellipse(
      x,
      y + 18,
      18,
      7,
      0,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.translate(
      x,
      y + bob
    );

    // backpack

    ctx.fillStyle =
      this.adjustColor(
        player.color,
        -35
      );

    ctx.beginPath();

    ctx.roundRect(
      -17,
      -5,
      11,
      27,
      5
    );

    ctx.fill();

    // backpack highlight

    ctx.fillStyle =
      "rgba(255,255,255,0.12)";

    ctx.fillRect(
      -15,
      -1,
      5,
      17
    );

    // legs

    ctx.fillStyle =
      this.adjustColor(
        player.color,
        -45
      );

    ctx.beginPath();

    ctx.roundRect(
      -13 + legMove * 0.35,
      12,
      10,
      14,
      5
    );

    ctx.fill();

    ctx.beginPath();

    ctx.roundRect(
      3 - legMove * 0.35,
      12,
      10,
      14,
      5
    );

    ctx.fill();

    // body

    const bodyGradient =
      ctx.createLinearGradient(
        -12,
        -10,
        12,
        18
      );

    bodyGradient.addColorStop(
      0,
      this.adjustColor(
        player.color,
        25
      )
    );

    bodyGradient.addColorStop(
      0.5,
      player.color
    );

    bodyGradient.addColorStop(
      1,
      this.adjustColor(
        player.color,
        -45
      )
    );

    ctx.fillStyle = bodyGradient;

    ctx.beginPath();

    ctx.roundRect(
      -14,
      -7,
      28,
      28,
      10
    );

    ctx.fill();

    // body outline

    ctx.strokeStyle =
      "rgba(0,0,0,0.55)";

    ctx.lineWidth = 2;

    ctx.stroke();

    // arms

    ctx.fillStyle =
      this.adjustColor(
        player.color,
        -20
      );

    ctx.beginPath();

    ctx.roundRect(
      -20,
      -2,
      9,
      20,
      5
    );

    ctx.fill();

    ctx.beginPath();

    ctx.roundRect(
      11,
      -2,
      9,
      20,
      5
    );

    ctx.fill();

    // helmet

    const helmetGradient =
      ctx.createLinearGradient(
        -16,
        -27,
        16,
        -5
      );

    helmetGradient.addColorStop(
      0,
      this.adjustColor(
        player.color,
        30
      )
    );

    helmetGradient.addColorStop(
      1,
      this.adjustColor(
        player.color,
        -25
      )
    );

    ctx.fillStyle = helmetGradient;

    ctx.beginPath();

    ctx.arc(
      0,
      -13,
      17,
      Math.PI,
      Math.PI * 2
    );

    ctx.lineTo(
      17,
      -7
    );

    ctx.quadraticCurveTo(
      16,
      2,
      0,
      3
    );

    ctx.quadraticCurveTo(
      -16,
      2,
      -17,
      -7
    );

    ctx.closePath();

    ctx.fill();

    ctx.strokeStyle =
      "rgba(0,0,0,0.6)";

    ctx.lineWidth = 2;

    ctx.stroke();

    // visor

    const visorGradient =
      ctx.createLinearGradient(
        -11,
        -17,
        10,
        -5
      );

    visorGradient.addColorStop(
      0,
      "#eaffff"
    );

    visorGradient.addColorStop(
      0.25,
      "#8de6ff"
    );

    visorGradient.addColorStop(
      0.65,
      "#3b86a7"
    );

    visorGradient.addColorStop(
      1,
      "#18394c"
    );

    ctx.fillStyle = visorGradient;

    ctx.beginPath();

    ctx.roundRect(
      -11,
      -17,
      22,
      12,
      6
    );

    ctx.fill();

    ctx.strokeStyle =
      "rgba(255,255,255,0.4)";

    ctx.lineWidth = 1;

    ctx.stroke();

    // visor reflection

    ctx.fillStyle =
      "rgba(255,255,255,0.65)";

    ctx.beginPath();

    ctx.ellipse(
      -4,
      -14,
      5,
      2,
      -0.25,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.restore();

    // player name

    if (isMe || player.name) {
      ctx.save();

      ctx.font =
        "bold 12px Arial, sans-serif";

      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";

      const label =
        player.name ||
        "Player";

      const width =
        ctx.measureText(label).width +
        14;

      ctx.fillStyle =
        "rgba(4,8,14,0.72)";

      ctx.beginPath();

      ctx.roundRect(
        x - width / 2,
        y - 49,
        width,
        17,
        6
      );

      ctx.fill();

      ctx.fillStyle = isMe
        ? "#ffffff"
        : "#d8e7f5";

      ctx.fillText(
        label,
        x,
        y - 36
      );

      ctx.restore();
    }

    if (isMe) {
      ctx.save();

      ctx.strokeStyle =
        "rgba(100,220,255,0.45)";

      ctx.lineWidth = 2;

      ctx.beginPath();

      ctx.arc(
        x,
        y,
        27,
        0,
        Math.PI * 2
      );

      ctx.stroke();

      ctx.restore();
    }
  }

  // ==========================================================
  // DEAD BODY
  // ==========================================================

  drawBodies(net) {
    if (!net?.bodies) return;

    for (const body of net.bodies) {
      if (!body) continue;

      this.drawBody(
        body.x,
        body.y,
        body.color
      );
    }
  }

  drawBody(x, y, color = "#ef4444") {
    const ctx = this.ctx;

    ctx.save();

    ctx.translate(
      x,
      y
    );

    ctx.rotate(-0.15);

    // shadow

    ctx.fillStyle =
      "rgba(0,0,0,0.5)";

    ctx.beginPath();

    ctx.ellipse(
      0,
      7,
      25,
      9,
      0,
      0,
      Math.PI * 2
    );

    ctx.fill();

    // body

    ctx.fillStyle =
      this.adjustColor(
        color,
        -20
      );

    ctx.beginPath();

    ctx.roundRect(
      -18,
      -6,
      36,
      22,
      9
    );

    ctx.fill();

    // bone / cut effect

    ctx.fillStyle =
      "#f5f5f5";

    ctx.fillRect(
      -7,
      -14,
      14,
      9
    );

    ctx.fillStyle =
      "#dfe7ec";

    ctx.beginPath();

    ctx.arc(
      0,
      -14,
      6,
      0,
      Math.PI * 2
    );

    ctx.fill();

    // visor

    ctx.fillStyle =
      "#4e91ad";

    ctx.beginPath();

    ctx.roundRect(
      -10,
      -4,
      20,
      9,
      4
    );

    ctx.fill();

    ctx.restore();
  }

  // ==========================================================
  // GHOST
  // ==========================================================

  drawGhost(player) {
    const ctx = this.ctx;

    const x = player.renderX;
    const y = player.renderY;

    ctx.save();

    ctx.globalAlpha = 0.45;

    ctx.fillStyle =
      "#b7d7ff";

    ctx.beginPath();

    ctx.arc(
      x,
      y - 8,
      16,
      Math.PI,
      Math.PI * 2
    );

    ctx.lineTo(
      x + 16,
      y + 14
    );

    ctx.lineTo(
      x + 8,
      y + 8
    );

    ctx.lineTo(
      x,
      y + 15
    );

    ctx.lineTo(
      x - 8,
      y + 8
    );

    ctx.lineTo(
      x - 16,
      y + 14
    );

    ctx.closePath();

    ctx.fill();

    ctx.fillStyle =
      "#76b9e8";

    ctx.beginPath();

    ctx.roundRect(
      x - 10,
      y - 13,
      20,
      10,
      5
    );

    ctx.fill();

    ctx.restore();
  }

  // ==========================================================
  // STATION DETAILS
  // ==========================================================

  drawStationDetails() {
    const ctx = this.ctx;

    // pipes around station

    ctx.save();

    ctx.strokeStyle =
      "rgba(100,140,165,0.38)";

    ctx.lineWidth = 5;

    const pipes = [
      [
        [400, 120],
        [650, 120],
        [650, 150],
      ],

      [
        [400, 640],
        [430, 640],
        [430, 610],
      ],

      [
        [1070, 420],
        [1070, 450],
        [1150, 450],
      ],

      [
        [1520, 300],
        [1560, 300],
        [1560, 400],
      ],
    ];

    for (const pipe of pipes) {
      ctx.beginPath();

      ctx.moveTo(
        pipe[0][0],
        pipe[0][1]
      );

      for (let i = 1; i < pipe.length; i++) {
        ctx.lineTo(
          pipe[i][0],
          pipe[i][1]
        );
      }

      ctx.stroke();
    }

    // warning lights

    const warningLights = [
      [395, 195],
      [1170, 195],
      [1510, 195],
      [1080, 540],
      [1515, 540],
    ];

    for (const [x, y] of warningLights) {
      ctx.fillStyle =
        "#e05259";

      ctx.beginPath();

      ctx.arc(
        x,
        y,
        4,
        0,
        Math.PI * 2
      );

      ctx.fill();
    }

    ctx.restore();
  }

  drawHazardStripes(x, y, w, h) {
    const ctx = this.ctx;

    ctx.save();

    ctx.beginPath();

    ctx.rect(
      x,
      y,
      w,
      h
    );

    ctx.clip();

    ctx.strokeStyle =
      "rgba(242,190,70,0.18)";

    ctx.lineWidth = 4;

    for (
      let i = -h;
      i < w + h;
      i += 18
    ) {
      ctx.beginPath();

      ctx.moveTo(
        x + i,
        y
      );

      ctx.lineTo(
        x + i - h,
        y + h
      );

      ctx.stroke();
    }

    ctx.restore();
  }

  // ==========================================================
  // VIGNETTE
  // ==========================================================

  drawVignette() {
    const ctx = this.ctx;

    const width =
      window.innerWidth;

    const height =
      window.innerHeight;

    const gradient =
      ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.25,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.72
      );

    gradient.addColorStop(
      0,
      "rgba(0,0,0,0)"
    );

    gradient.addColorStop(
      1,
      "rgba(0,0,0,0.58)"
    );

    ctx.fillStyle = gradient;

    ctx.fillRect(
      0,
      0,
      width,
      height
    );
  }

  // ==========================================================
  // SABOTAGE OVERLAY
  // ==========================================================

  drawSabotageOverlay(sabotageActive) {
    if (!sabotageActive) return;

    const active =
      sabotageActive.electrical ||
      sabotageActive.lights ||
      sabotageActive.reactor ||
      sabotageActive.oxygen;

    if (!active) return;

    const ctx = this.ctx;

    const width =
      window.innerWidth;

    const height =
      window.innerHeight;

    ctx.save();

    if (
      sabotageActive.reactor ||
      sabotageActive.oxygen
    ) {
      ctx.fillStyle =
        "rgba(255,45,55,0.035)";

      ctx.fillRect(
        0,
        0,
        width,
        height
      );
    }

    if (
      sabotageActive.electrical ||
      sabotageActive.lights
    ) {
      const gradient =
        ctx.createRadialGradient(
          width / 2,
          height / 2,
          70,
          width / 2,
          height / 2,
          430
        );

      gradient.addColorStop(
        0,
        "rgba(0,0,0,0)"
      );

      gradient.addColorStop(
        0.5,
        "rgba(0,0,0,0.45)"
      );

      gradient.addColorStop(
        1,
        "rgba(0,0,0,0.88)"
      );

      ctx.fillStyle = gradient;

      ctx.fillRect(
        0,
        0,
        width,
        height
      );
    }

    ctx.restore();
  }

  // ==========================================================
  // INTERACTION
  // ==========================================================

  nearestInteractable(
    player,
    net,
    range = 70
  ) {
    if (!player) return null;

    let closest = null;
    let closestDistance = range;

    for (const task of TASKS) {
      const dx =
        task.x - player.renderX;

      const dy =
        task.y - player.renderY;

      const distance =
        Math.hypot(dx, dy);

      if (distance < closestDistance) {
        closestDistance = distance;

        closest = {
          type: "task",
          id: task.id,
          task,
          distance,
        };
      }
    }

    return closest;
  }

  // ==========================================================
  // COLOR HELPER
  // ==========================================================

  adjustColor(color, amount) {
    if (!color) {
      return "#64748b";
    }

    let hex = color;

    if (hex.startsWith("#")) {
      hex = hex.slice(1);
    }

    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }

    const num =
      parseInt(hex, 16);

    if (Number.isNaN(num)) {
      return color;
    }

    let r =
      (num >> 16) + amount;

    let g =
      ((num >> 8) & 0xff) + amount;

    let b =
      (num & 0xff) + amount;

    r = Math.max(
      0,
      Math.min(255, r)
    );

    g = Math.max(
      0,
      Math.min(255, g)
    );

    b = Math.max(
      0,
      Math.min(255, b)
    );

    return (
      "#" +
      [r, g, b]
        .map((value) =>
          Math.round(value)
            .toString(16)
            .padStart(2, "0")
        )
        .join("")
    );
  }
}

export { ROOMS };