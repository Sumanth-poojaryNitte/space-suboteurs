import { WORLD, ROOMS, CORRIDORS, DOORS } from "../game/MapData.js";

const DEFAULT_WORLD = {
  width: 2000,
  height: 800,
};

export class Minimap {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;

    this.width = options.width || 230;
    this.height = options.height || 110;

    this.world = options.world || WORLD || DEFAULT_WORLD;
    this.rooms = options.rooms || ROOMS || {};
    this.playerId = options.playerId || null;
    this.corridors = options.corridors || CORRIDORS || [];
    this.doors = options.doors || DOORS || [];

    this.visible = true;
    this.padding = 8;

    this.roomColors = {
      cafeteria: "#273746",
      reactor: "#512e5f",
      electrical: "#7d6608",
      medbay: "#145a32",
      security: "#154360",
      navigation: "#1b4f72",
      communications: "#784212",
      storage: "#4d5656",
      admin: "#7b241c",
    };

    this.resize();
  }

  setWorld(world) {
    if (
      world &&
      Number.isFinite(world.width) &&
      Number.isFinite(world.height)
    ) {
      this.world = world;
    }
  }

  setRooms(rooms) {
    this.rooms = rooms || {};
  }

  setPlayerId(playerId) {
    this.playerId = playerId;
  }

  resize() {
    if (!this.canvas || !this.ctx) return;

    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);

    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );
  }

  toggle() {
    this.visible = !this.visible;

    if (this.canvas) {
      this.canvas.style.display =
        this.visible ? "block" : "none";
    }
  }

  worldToMap(x, y) {
    const worldWidth =
      Number(this.world?.width) || DEFAULT_WORLD.width;

    const worldHeight =
      Number(this.world?.height) || DEFAULT_WORLD.height;

    const usableWidth =
      this.width - this.padding * 2;

    const usableHeight =
      this.height - this.padding * 2;

    return {
      x:
        this.padding +
        (Number(x) / worldWidth) * usableWidth,

      y:
        this.padding +
        (Number(y) / worldHeight) * usableHeight,
    };
  }

  roomToMap(room) {
    if (!room) {
      return {
        x: 0,
        y: 0,
        w: 0,
        h: 0,
      };
    }

    const p = this.worldToMap(
      room.x,
      room.y
    );

    const worldWidth =
      Number(this.world?.width) || DEFAULT_WORLD.width;

    const worldHeight =
      Number(this.world?.height) || DEFAULT_WORLD.height;

    return {
      x: p.x,
      y: p.y,

      w:
        (Number(room.w) / worldWidth) *
        (this.width - this.padding * 2),

      h:
        (Number(room.h) / worldHeight) *
        (this.height - this.padding * 2),
    };
  }

  drawBackground() {
    const ctx = this.ctx;

    if (!ctx) return;

    ctx.save();

    const gradient = ctx.createLinearGradient(
      0,
      0,
      0,
      this.height
    );

    gradient.addColorStop(
      0,
      "#08111d"
    );

    gradient.addColorStop(
      1,
      "#03070d"
    );

    ctx.fillStyle = gradient;

    ctx.fillRect(
      0,
      0,
      this.width,
      this.height
    );

    ctx.restore();
  }

  drawGrid() {
    const ctx = this.ctx;

    if (!ctx) return;

    ctx.save();

    ctx.strokeStyle =
      "rgba(90, 150, 190, 0.08)";

    ctx.lineWidth = 1;

    const gridSize = 16;

    for (
      let x = this.padding;
      x < this.width - this.padding;
      x += gridSize
    ) {
      ctx.beginPath();

      ctx.moveTo(
        x,
        this.padding
      );

      ctx.lineTo(
        x,
        this.height - this.padding
      );

      ctx.stroke();
    }

    for (
      let y = this.padding;
      y < this.height - this.padding;
      y += gridSize
    ) {
      ctx.beginPath();

      ctx.moveTo(
        this.padding,
        y
      );

      ctx.lineTo(
        this.width - this.padding,
        y
      );

      ctx.stroke();
    }

    ctx.restore();
  }

  drawRooms() {
    const ctx = this.ctx;

    if (!ctx) return;

    Object.entries(this.rooms || {}).forEach(
      ([name, room]) => {
        if (
          !room ||
          !Number.isFinite(Number(room.x)) ||
          !Number.isFinite(Number(room.y)) ||
          !Number.isFinite(Number(room.w)) ||
          !Number.isFinite(Number(room.h))
        ) {
          return;
        }

        const r = this.roomToMap(room);

        const fill =
          this.roomColors[name] ||
          "#263238";

        ctx.save();

        ctx.fillStyle = fill;
        ctx.globalAlpha = 0.92;

        ctx.fillRect(
          r.x,
          r.y,
          r.w,
          r.h
        );

        ctx.strokeStyle =
          "rgba(150, 220, 255, 0.42)";

        ctx.lineWidth = 1;

        ctx.strokeRect(
          r.x,
          r.y,
          r.w,
          r.h
        );

        ctx.fillStyle =
          "rgba(255,255,255,0.65)";

        ctx.font =
          "bold 7px Arial";

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const label =
          name
            .replace(/_/g, " ")
            .toUpperCase();

        if (
          r.w > 24 &&
          r.h > 12
        ) {
          ctx.fillText(
            label,
            r.x + r.w / 2,
            r.y + r.h / 2
          );
        }

        ctx.restore();
      }
    );
  }

  drawCorridors(corridors) {
    if (!Array.isArray(corridors)) {
      return;
    }

    const ctx = this.ctx;

    if (!ctx) return;

    ctx.save();

    corridors.forEach(
      (corridor) => {
        if (!corridor) return;

        const r =
          this.roomToMap(corridor);

        ctx.fillStyle =
          "#111d27";

        ctx.fillRect(
          r.x,
          r.y,
          r.w,
          r.h
        );

        ctx.strokeStyle =
          "rgba(100,170,200,0.2)";

        ctx.strokeRect(
          r.x,
          r.y,
          r.w,
          r.h
        );
      }
    );

    ctx.restore();
  }

  drawDoors(doors) {
    if (!Array.isArray(doors)) {
      return;
    }

    const ctx = this.ctx;

    if (!ctx) return;

    ctx.save();

    doors.forEach(
      (door) => {
        if (!door) return;

        const r =
          this.roomToMap(door);

        ctx.fillStyle =
          "#9aa7b2";

        ctx.fillRect(
          r.x,
          r.y,
          Math.max(2, r.w),
          Math.max(2, r.h)
        );
      }
    );

    ctx.restore();
  }

  drawBodies(bodies) {
    if (!Array.isArray(bodies)) {
      return;
    }

    const ctx = this.ctx;

    if (!ctx) return;

    ctx.save();

    bodies.forEach(
      (body) => {
        if (!body) return;

        const p =
          this.worldToMap(
            body.x,
            body.y
          );

        ctx.fillStyle =
          "#ff4757";

        ctx.beginPath();

        ctx.arc(
          p.x,
          p.y,
          2.5,
          0,
          Math.PI * 2
        );

        ctx.fill();

        ctx.strokeStyle =
          "rgba(255,70,80,0.8)";

        ctx.lineWidth = 1;

        ctx.stroke();
      }
    );

    ctx.restore();
  }

  drawSabotage(sabotage) {
    if (!sabotage) return;

    const ctx = this.ctx;

    if (!ctx) return;

    ctx.save();

    const rooms =
      Array.isArray(
        sabotage.fixRoomsNeeded
      )
        ? sabotage.fixRoomsNeeded
        : [];

    rooms.forEach(
      (roomName) => {
        const room =
          this.rooms?.[roomName];

        if (!room) return;

        const r =
          this.roomToMap(room);

        const fixed =
          Array.isArray(
            sabotage.fixedRooms
          ) &&
          sabotage.fixedRooms.includes(
            roomName
          );

        ctx.strokeStyle = fixed
          ? "rgba(60,220,120,0.75)"
          : "rgba(255,70,70,0.9)";

        ctx.lineWidth = 2;

        ctx.strokeRect(
          r.x - 1,
          r.y - 1,
          r.w + 2,
          r.h + 2
        );
      }
    );

    ctx.restore();
  }

  drawPlayers(players) {
    if (!Array.isArray(players)) {
      return;
    }

    const ctx = this.ctx;

    if (!ctx) return;

    players.forEach(
      (player) => {
        if (!player) return;

        if (player.connected === false) {
          return;
        }

        const p =
          this.worldToMap(
            player.x,
            player.y
          );

        const isSelf =
          player.id === this.playerId;

        const radius =
          isSelf ? 3.5 : 2.7;

        ctx.save();

        if (!player.alive) {
          ctx.fillStyle =
            "rgba(120,120,120,0.5)";

          ctx.beginPath();

          ctx.arc(
            p.x,
            p.y,
            radius,
            0,
            Math.PI * 2
          );

          ctx.fill();

          ctx.restore();

          return;
        }

        if (isSelf) {
          ctx.shadowColor =
            "#ffffff";

          ctx.shadowBlur = 7;
        }

        ctx.fillStyle =
          player.color ||
          "#4dabf7";

        ctx.beginPath();

        ctx.arc(
          p.x,
          p.y,
          radius,
          0,
          Math.PI * 2
        );

        ctx.fill();

        ctx.strokeStyle =
          isSelf
            ? "#ffffff"
            : "rgba(255,255,255,0.5)";

        ctx.lineWidth =
          isSelf ? 1.2 : 0.7;

        ctx.stroke();

        ctx.restore();
      }
    );
  }

  drawPlayerArrow(player) {
    if (!player) return;

    const ctx = this.ctx;

    if (!ctx) return;

    const p =
      this.worldToMap(
        player.x,
        player.y
      );

    const dx =
      Number(player.input?.x) || 0;

    const dy =
      Number(player.input?.y) || 0;

    const length =
      Math.hypot(
        dx,
        dy
      );

    if (length < 0.05) {
      return;
    }

    const nx = dx / length;
    const ny = dy / length;

    const size = 7;

    const tip = {
      x: p.x + nx * size,
      y: p.y + ny * size,
    };

    const left = {
      x:
        p.x -
        nx * size * 0.4 -
        ny * size * 0.55,

      y:
        p.y -
        ny * size * 0.4 +
        nx * size * 0.55,
    };

    const right = {
      x:
        p.x -
        nx * size * 0.4 +
        ny * size * 0.55,

      y:
        p.y -
        ny * size * 0.4 -
        nx * size * 0.55,
    };

    ctx.save();

    ctx.fillStyle =
      "#ffffff";

    ctx.globalAlpha = 0.85;

    ctx.beginPath();

    ctx.moveTo(
      tip.x,
      tip.y
    );

    ctx.lineTo(
      left.x,
      left.y
    );

    ctx.lineTo(
      right.x,
      right.y
    );

    ctx.closePath();

    ctx.fill();

    ctx.restore();
  }

  drawFrame() {
    const ctx = this.ctx;

    if (!ctx) return;

    ctx.save();

    ctx.strokeStyle =
      "rgba(100,190,230,0.7)";

    ctx.lineWidth = 1.5;

    ctx.strokeRect(
      1,
      1,
      this.width - 2,
      this.height - 2
    );

    ctx.strokeStyle =
      "rgba(255,255,255,0.08)";

    ctx.strokeRect(
      this.padding,
      this.padding,
      this.width -
        this.padding * 2,
      this.height -
        this.padding * 2
    );

    ctx.restore();
  }

  drawLabel() {
    const ctx = this.ctx;

    if (!ctx) return;

    ctx.save();

    ctx.fillStyle =
      "rgba(0,0,0,0.55)";

    ctx.fillRect(
      8,
      8,
      67,
      13
    );

    ctx.fillStyle =
      "#d9f5ff";

    ctx.font =
      "bold 7px Arial";

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    ctx.fillText(
      "NEBULA STATION",
      12,
      14.5
    );

    ctx.restore();
  }

  draw(net, electricalSabotage = false) {
    if (!net) return;

    let players = [];

    if (net.players instanceof Map) {
      players =
        Array.from(
          net.players.values()
        );
    } else if (
      Array.isArray(net.players)
    ) {
      players = net.players;
    }

    this.playerId =
      net.playerId ||
      this.playerId;

    this.world =
      WORLD ||
      DEFAULT_WORLD;

    this.rooms =
      ROOMS ||
      {};

    this.corridors =
      CORRIDORS ||
      [];

    this.doors =
      DOORS ||
      [];

    const sabotage =
      electricalSabotage
        ? {
            fixRoomsNeeded: [
              "electrical",
            ],
            fixedRooms: [],
          }
        : net.sabotage ||
          null;

    this.render({
      players,
      bodies:
        Array.isArray(net.bodies)
          ? net.bodies
          : [],

      sabotage,

      corridors:
        this.corridors,

      doors:
        this.doors,

      localPlayer:
        net.me || null,
    });
  }

  render({
    players = [],
    bodies = [],
    sabotage = null,
    corridors = [],
    doors = [],
    localPlayer = null,
  } = {}) {
    if (
      !this.canvas ||
      !this.ctx
    ) {
      return;
    }

    if (!this.visible) {
      return;
    }

    this.ctx.clearRect(
      0,
      0,
      this.width,
      this.height
    );

    this.drawBackground();

    this.drawGrid();

    this.drawCorridors(
      corridors
    );

    this.drawRooms();

    this.drawDoors(
      doors
    );

    this.drawSabotage(
      sabotage
    );

    this.drawBodies(
      bodies
    );

    this.drawPlayers(
      players
    );

    if (localPlayer) {
      this.drawPlayerArrow(
        localPlayer
      );
    }

    this.drawLabel();

    this.drawFrame();
  }

  update(data = {}) {
    this.render(data);
  }
}

export default Minimap;