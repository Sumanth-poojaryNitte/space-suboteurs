import { Vec2Smoother, applyDeadZone, clampVec } from "./GestureSmoothing.js";

// Landmark indices (MediaPipe Hands, 21 points per hand)
const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_TIP = 8;
const INDEX_PIP = 6;
const MIDDLE_TIP = 12;
const MIDDLE_PIP = 10;
const MIDDLE_MCP = 9; // used as a stable "palm center" point
const RING_TIP = 16;
const RING_PIP = 14;
const PINKY_TIP = 20;
const PINKY_PIP = 18;

const LOST_HAND_TIMEOUT_MS = 350; // grace period before we force movement to 0
const AMPLIFICATION = 3.2; // how much normalized hand travel maps to full-speed input

export class GestureController {
  constructor() {
    this.smoother = new Vec2Smoother(0.4);
    this.neutral = { x: 0.5, y: 0.5 };
    this.calibrated = false;
    this.currentGesture = "NONE";
    this.movement = { x: 0, y: 0 };
    this.confidence = 0;
  }

  calibrate(landmarks) {
    if (!landmarks) return false;
    const p = landmarks[MIDDLE_MCP];
    this.neutral = { x: p.x, y: p.y };
    this.smoother.reset();
    this.calibrated = true;
    return true;
  }

  // Called once per HandTracker result. Returns { movement:{x,y}, gesture, handDetected, confidence }.
  update(result) {
    if (!this.calibrated) {
      return { movement: { x: 0, y: 0 }, gesture: "NONE", handDetected: false, confidence: 0 };
    }

    const lostHand = !result.detected || result.msSinceLastSeen > LOST_HAND_TIMEOUT_MS;
    if (lostHand) {
      // Decay smoothly to a stop rather than freezing or snapping.
      const eased = this.smoother.push(0, 0);
      this.movement = clampVec(eased.x, eased.y, 1);
      this.currentGesture = "NONE";
      this.confidence = 0;
      return { movement: this.movement, gesture: this.currentGesture, handDetected: false, confidence: 0 };
    }

    const landmarks = result.landmarks;
    const palm = landmarks[MIDDLE_MCP];

    // Raw offset from the calibrated neutral point. Video is mirrored via
    // CSS for a natural selfie view, so moving the hand right in real life
    // already reads as +x here.
    const rawX = (palm.x - this.neutral.x) * AMPLIFICATION;
    const rawY = (palm.y - this.neutral.y) * AMPLIFICATION;

    const smoothed = this.smoother.push(rawX, rawY);
    const deadZoned = applyDeadZone(smoothed.x, smoothed.y, 0.1);
    this.movement = clampVec(deadZoned.x, deadZoned.y, 1);

    this.currentGesture = classifyGesture(landmarks);
    this.confidence = result.handedness ? result.handedness.score : 0.8;

    return {
      movement: this.movement,
      gesture: this.currentGesture,
      handDetected: true,
      confidence: this.confidence,
    };
  }
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function classifyGesture(landmarks) {
  const wrist = landmarks[WRIST];
  const thumbTip = landmarks[THUMB_TIP];
  const indexTip = landmarks[INDEX_TIP];

  // Pinch: thumb tip and index tip close together.
  if (dist(thumbTip, indexTip) < 0.06) return "PINCH";

  // Curl heuristic: for each finger, compare tip-to-wrist distance against
  // pip-to-wrist distance. A curled finger's tip is NOT farther out than
  // its own knuckle.
  const fingers = [
    [INDEX_TIP, INDEX_PIP],
    [MIDDLE_TIP, MIDDLE_PIP],
    [RING_TIP, RING_PIP],
    [PINKY_TIP, PINKY_PIP],
  ];
  const extendedCount = fingers.filter(([tip, pip]) => dist(landmarks[tip], wrist) > dist(landmarks[pip], wrist)).length;

  if (extendedCount >= 3) return "OPEN_PALM";
  if (extendedCount === 0) return "FIST";
  return "PARTIAL";
}
