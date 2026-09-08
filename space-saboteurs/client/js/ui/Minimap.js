import { ROOMS, CORRIDORS } from "../game/MapData.js";

const WORLD_W = 2000;
const WORLD_H = 800;
const VISION_RANGE = 340; // other players beyond this are hidden from the minimap

export class Minimap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }

  draw(net, sabotageActive) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const scaleX = w / WORLD_W;
    const scaleY = h / WORLD_H;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(10,13,22,0.85)";
    ctx.fillRect(0, 0, w, h);

    // Reduced information during an electrical-style sabotage: outlines
    // only, no room labels, so the minimap can't be used to cheese vision.
    ctx.strokeStyle = sabotageActive ? "#3a4360" : "#4c597a";
    ctx.lineWidth = 1;
    [...Object.values(ROOMS), ...CORRIDORS].forEach((r) => {
      ctx.strokeRect(r.x * scaleX, r.y * scaleY, r.w * scaleX, r.h * scaleY);
    });

    const me = net.me;
    if (!me) return;

    net.players.forEach((p) => {
      if (!p.connected || !p.alive) return;
      const isSelf = p.id === net.playerId;
      if (!isSelf) {
        const d = Math.hypot(p.renderX - me.renderX, p.renderY - me.renderY);
        if (d > VISION_RANGE) return; // not visible -> not drawn, no cheating
      }
      ctx.beginPath();
      ctx.arc(p.renderX * scaleX, p.renderY * scaleY, isSelf ? 4 : 3, 0, Math.PI * 2);
      ctx.fillStyle = isSelf ? "#ffffff" : p.color;
      ctx.fill();
    });
  }
}
