import { ROOMS, CORRIDORS, TASKS, roomAt } from "./MapData.js";

const PLAYER_RADIUS = 16;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.camera = { x: 0, y: 0 };
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewW = rect.width;
    this.viewH = rect.height;
  }

  centerCameraOn(x, y) {
    this.camera.x = x - this.viewW / 2;
    this.camera.y = y - this.viewH / 2;
  }

  worldToScreen(x, y) {
    return { x: x - this.camera.x, y: y - this.camera.y };
  }

  draw(net, localTasks, showRoles) {
    const ctx = this.ctx;
    ctx.fillStyle = "#05070d";
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    ctx.save();
    ctx.translate(-this.camera.x, -this.camera.y);

    this.drawCorridors();
    this.drawRooms();
    this.drawTasks(localTasks);
    this.drawBodies(net.bodies);
    this.drawPlayers(net);

    ctx.restore();
  }

  drawCorridors() {
    const ctx = this.ctx;
    ctx.fillStyle = "#161b28";
    CORRIDORS.forEach((c) => ctx.fillRect(c.x, c.y, c.w, c.h));
  }

  drawRooms() {
    const ctx = this.ctx;
    Object.values(ROOMS).forEach((r) => {
      ctx.fillStyle = "#1c2333";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = "#39435c";
      ctx.lineWidth = 3;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = "#6d7a9c";
      ctx.font = "13px 'Segoe UI', sans-serif";
      ctx.fillText(r.label.toUpperCase(), r.x + 10, r.y + 20);
    });
  }

  drawTasks(localTasks) {
    if (!localTasks || localTasks.length === 0) return;
    const ctx = this.ctx;
    const assignedIds = new Set(localTasks.map((t) => t.id));
    TASKS.filter((t) => assignedIds.has(t.id)).forEach((t) => {
      const done = localTasks.find((lt) => lt.id === t.id)?.completed;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = done ? "#2ecc71" : "#f1c40f";
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (!done) {
        ctx.fillStyle = "#e8ecf7";
        ctx.font = "11px 'Segoe UI', sans-serif";
        ctx.fillText(t.label, t.x + 14, t.y + 4);
      }
    });
  }

  drawBodies(bodies) {
    const ctx = this.ctx;
    bodies.forEach((b) => {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.fillStyle = "#c0392b";
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e8ecf7";
      ctx.font = "11px 'Segoe UI', sans-serif";
      ctx.fillText(`${b.victimName}'s body`, 14, -8);
      ctx.restore();
    });
  }

  drawPlayers(net) {
    const ctx = this.ctx;
    net.players.forEach((p) => {
      if (!p.connected) return;
      if (!p.alive) {
        this.drawGhost(p);
        return;
      }
      ctx.save();
      ctx.translate(p.renderX, p.renderY);
      ctx.beginPath();
      ctx.arc(0, 0, PLAYER_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.strokeStyle = "#0b0e16";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#e8ecf7";
      ctx.font = "bold 12px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.name, 0, -PLAYER_RADIUS - 8);
      ctx.textAlign = "left";
      ctx.restore();
    });
  }

  drawGhost(p) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.translate(p.renderX, p.renderY);
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.fillStyle = "#e8ecf7";
    ctx.font = "12px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${p.name} (ghost)`, 0, -PLAYER_RADIUS - 8);
    ctx.textAlign = "left";
    ctx.restore();
  }

  nearestInteractable(worldX, worldY, localTasks, bodies, range) {
    let best = null;
    let bestDist = range;
    const assignedIds = new Set((localTasks || []).map((t) => t.id));
    TASKS.filter((t) => assignedIds.has(t.id)).forEach((t) => {
      const done = localTasks.find((lt) => lt.id === t.id)?.completed;
      if (done) return;
      const d = Math.hypot(t.x - worldX, t.y - worldY);
      if (d < bestDist) {
        bestDist = d;
        best = { type: "task", task: t };
      }
    });
    bodies.forEach((b) => {
      const d = Math.hypot(b.x - worldX, b.y - worldY);
      if (d < bestDist) {
        bestDist = d;
        best = { type: "body", body: b };
      }
    });
    return best;
  }
}

export { ROOMS, roomAt };
