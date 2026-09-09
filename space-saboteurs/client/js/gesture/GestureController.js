import { Vec2Smoother, applyDeadZone, clampVec } from "./GestureSmoothing.js";

// Landmark indices (MediaPipe Hands, 21 points per hand)
const WRIST = 0;

const THUMB_TIP = 4;

const INDEX_TIP = 8;
const INDEX_PIP = 6;

const MIDDLE_TIP = 12;
const MIDDLE_PIP = 10;
const MIDDLE_MCP = 9; // stable palm-center reference

const RING_TIP = 16;
const RING_PIP = 14;

const PINKY_TIP = 20;
const PINKY_PIP = 18;


// ---------------------------------------------------------
// MOVEMENT SETTINGS
// ---------------------------------------------------------

// How long we allow the hand to disappear before stopping.
const LOST_HAND_TIMEOUT_MS = 350;

// Lower values = slower / less sensitive.
// Reduced from 1.15 to 0.85 for more controlled movement.
const AMPLIFICATION_X = 0.85;
const AMPLIFICATION_Y = 0.85;

// Dead zone around calibrated hand position.
// Increased from 0.12 to 0.15 to reduce accidental movement.
const DEAD_ZONE = 0.15;


// ---------------------------------------------------------
// GESTURE CONTROLLER
// ---------------------------------------------------------

export class GestureController {

  constructor() {

    // Smoothing factor.
    // Lower = smoother/slower
    // Higher = faster/more responsive
    // Reduced from 0.25 to 0.18 for steadier movement.
    this.smoother = new Vec2Smoother(0.18);

    // Neutral hand position captured during calibration.
    this.neutral = {
      x: 0.5,
      y: 0.5
    };

    this.calibrated = false;

    this.currentGesture = "NONE";

    this.movement = {
      x: 0,
      y: 0
    };

    this.confidence = 0;
  }


  // -------------------------------------------------------
  // CALIBRATION
  // -------------------------------------------------------

  calibrate(landmarks) {

    if (!landmarks || !landmarks[MIDDLE_MCP]) {
      return false;
    }

    const p = landmarks[MIDDLE_MCP];

    this.neutral = {
      x: p.x,
      y: p.y
    };

    // Start movement from zero after calibration.
    this.smoother.reset();

    this.movement = {
      x: 0,
      y: 0
    };

    this.calibrated = true;

    return true;
  }


  // -------------------------------------------------------
  // UPDATE
  // -------------------------------------------------------

  update(result) {

    // Not calibrated yet.
    if (!this.calibrated) {

      return {
        movement: {
          x: 0,
          y: 0
        },

        gesture: "NONE",

        handDetected: false,

        confidence: 0
      };
    }


    // -----------------------------------------------------
    // CHECK WHETHER HAND IS LOST
    // -----------------------------------------------------

    const lostHand =
      !result ||
      !result.detected ||
      result.msSinceLastSeen > LOST_HAND_TIMEOUT_MS;


    if (lostHand) {

      // Smoothly return to zero.
      const eased = this.smoother.push(0, 0);

      this.movement = clampVec(
        eased.x,
        eased.y,
        1
      );

      this.currentGesture = "NONE";

      this.confidence = 0;

      return {
        movement: this.movement,

        gesture: this.currentGesture,

        handDetected: false,

        confidence: 0
      };
    }


    // -----------------------------------------------------
    // GET PALM POSITION
    // -----------------------------------------------------

    const landmarks = result.landmarks;

    if (
      !landmarks ||
      !landmarks[MIDDLE_MCP]
    ) {

      return {
        movement: {
          x: 0,
          y: 0
        },

        gesture: "NONE",

        handDetected: false,

        confidence: 0
      };
    }


    const palm = landmarks[MIDDLE_MCP];


    // -----------------------------------------------------
    // CALCULATE HAND MOVEMENT
    // -----------------------------------------------------

    /*
      IMPORTANT:

      MediaPipe X:

        0 = left side of camera
        1 = right side of camera

      Because the camera preview is mirrored for selfie view,
      we invert X here.

      Therefore:

        Move hand LEFT  -> player LEFT
        Move hand RIGHT -> player RIGHT
    */

    const handDeltaX =
      this.neutral.x - palm.x;


    /*
      Y does not need mirroring.

        Move hand UP   -> player UP
        Move hand DOWN -> player DOWN
    */

    const handDeltaY =
      palm.y - this.neutral.y;


    // Apply reduced sensitivity.
    let rawX =
      handDeltaX * AMPLIFICATION_X;

    let rawY =
      handDeltaY * AMPLIFICATION_Y;


    // -----------------------------------------------------
    // DEAD ZONE
    // -----------------------------------------------------

    const deadZoned = applyDeadZone(
      rawX,
      rawY,
      DEAD_ZONE
    );


    // -----------------------------------------------------
    // SMOOTHING
    // -----------------------------------------------------

    const smoothed = this.smoother.push(
      deadZoned.x,
      deadZoned.y
    );


    // -----------------------------------------------------
    // CLAMP MOVEMENT
    // -----------------------------------------------------

    this.movement = clampVec(
      smoothed.x,
      smoothed.y,
      1
    );


    // -----------------------------------------------------
    // GESTURE DETECTION
    // -----------------------------------------------------

    this.currentGesture =
      classifyGesture(landmarks);


    // -----------------------------------------------------
    // CONFIDENCE
    // -----------------------------------------------------

    this.confidence =
      result.handedness
        ? result.handedness.score
        : 0.8;


    // -----------------------------------------------------
    // RETURN RESULT
    // -----------------------------------------------------

    return {

      movement: this.movement,

      gesture: this.currentGesture,

      handDetected: true,

      confidence: this.confidence
    };
  }
}


// ---------------------------------------------------------
// DISTANCE BETWEEN TWO LANDMARKS
// ---------------------------------------------------------

function dist(a, b) {

  return Math.hypot(
    a.x - b.x,
    a.y - b.y
  );
}


// ---------------------------------------------------------
// GESTURE CLASSIFICATION
// ---------------------------------------------------------

function classifyGesture(landmarks) {

  const wrist =
    landmarks[WRIST];

  const thumbTip =
    landmarks[THUMB_TIP];

  const indexTip =
    landmarks[INDEX_TIP];


  // -------------------------------------------------------
  // PINCH
  // -------------------------------------------------------

  if (
    dist(
      thumbTip,
      indexTip
    ) < 0.06
  ) {

    return "PINCH";
  }


  // -------------------------------------------------------
  // FINGER EXTENSION
  // -------------------------------------------------------

  const fingers = [

    [
      INDEX_TIP,
      INDEX_PIP
    ],

    [
      MIDDLE_TIP,
      MIDDLE_PIP
    ],

    [
      RING_TIP,
      RING_PIP
    ],

    [
      PINKY_TIP,
      PINKY_PIP
    ]

  ];


  const extendedCount =
    fingers.filter(
      ([tip, pip]) => {

        return (
          dist(
            landmarks[tip],
            wrist
          ) >

          dist(
            landmarks[pip],
            wrist
          )
        );

      }
    ).length;


  // -------------------------------------------------------
  // OPEN PALM
  // -------------------------------------------------------

  if (
    extendedCount >= 3
  ) {

    return "OPEN_PALM";
  }


  // -------------------------------------------------------
  // FIST
  // -------------------------------------------------------

  if (
    extendedCount === 0
  ) {

    return "FIST";
  }


  // -------------------------------------------------------
  // PARTIAL
  // -------------------------------------------------------

  return "PARTIAL";
}