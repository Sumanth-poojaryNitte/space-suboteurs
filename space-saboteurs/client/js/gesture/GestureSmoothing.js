// Simple exponential moving average smoother, used to tame MediaPipe's
// frame-to-frame jitter before it becomes a movement input.

export class ExponentialSmoother {
  constructor(alpha = 0.35) {
    this.alpha = alpha; // 0..1, higher = less smoothing / more responsive
    this.value = null;
  }

  reset() {
    this.value = null;
  }

  push(sample) {
    if (this.value === null) {
      this.value = sample;
    } else {
      this.value = this.value + this.alpha * (sample - this.value);
    }
    return this.value;
  }
}

export class Vec2Smoother {
  constructor(alpha = 0.35) {
    this.sx = new ExponentialSmoother(alpha);
    this.sy = new ExponentialSmoother(alpha);
  }

  reset() {
    this.sx.reset();
    this.sy.reset();
  }

  push(x, y) {
    return { x: this.sx.push(x), y: this.sy.push(y) };
  }
}

export function applyDeadZone(x, y, deadZone = 0.08) {
  const mag = Math.hypot(x, y);
  if (mag < deadZone) return { x: 0, y: 0 };
  // Rescale so output still reaches 1.0 at the edge of range instead of
  // leaving a "dead gap" right past the threshold.
  const scale = (mag - deadZone) / (1 - deadZone) / mag;
  return { x: x * scale, y: y * scale };
}

export function clampVec(x, y, max = 1) {
  const mag = Math.hypot(x, y);
  if (mag <= max) return { x, y };
  return { x: (x / mag) * max, y: (y / mag) * max };
}
