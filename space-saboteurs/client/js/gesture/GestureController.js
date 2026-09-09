import { Vec2Smoother, applyDeadZone, clampVec } from "./GestureSmoothing.js";

// Landmark indices (MediaPipe Hands, 21 points per hand)
const WRIST = 0;

const THUMB_TIP = 4;

const INDEX_TIP = 8;
const INDEX_PIP = 6;

const MIDDLE_TIP = 12;
const MIDDLE_PIP = 10;
const MIDDLE_MCP = 9;

const RING_TIP = 16;
const RING_PIP = 14;

const PINKY_TIP = 20;
const PINKY_PIP = 18;


// ---------------------------------------------------------
// MOVEMENT SETTINGS
// ---------------------------------------------------------

const LOST_HAND_TIMEOUT_MS = 350;

// Increased for faster hand movement.
const AMPLIFICATION_X = 1.35;
const AMPLIFICATION_Y = 1.35;

// Smaller dead zone makes small hand movements responsive.
const DEAD_ZONE = 0.08;


// ---------------------------------------------------------
// GESTURE CONTROLLER
// ---------------------------------------------------------

export class GestureController {

  constructor() {

    // Higher smoothing response = faster reaction.
    this.smoother = new Vec2Smoother(0.35);

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

      const eased =
        this.smoother.push(0, 0);

      this.movement =
        clampVec(
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
    // GET LANDMARKS
    // -----------------------------------------------------

    const landmarks =
      result.landmarks;

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


    const palm =
      landmarks[MIDDLE_MCP];


    // -----------------------------------------------------
    // CALCULATE MOVEMENT
    // -----------------------------------------------------

    // Camera X is mirrored.
    const handDeltaX =
      this.neutral.x - palm.x;

    // Y direction.
    const handDeltaY =
      palm.y - this.neutral.y;


    // Increased amplification.
    let rawX =
      handDeltaX * AMPLIFICATION_X;

    let rawY =
      handDeltaY * AMPLIFICATION_Y;


    // -----------------------------------------------------
    // DEAD ZONE
    // -----------------------------------------------------

    const deadZoned =
      applyDeadZone(
        rawX,
        rawY,
        DEAD_ZONE
      );


    // -----------------------------------------------------
    // SMOOTHING
    // -----------------------------------------------------

    const smoothed =
      this.smoother.push(
        deadZoned.x,
        deadZoned.y
      );


    // -----------------------------------------------------
    // CLAMP
    // -----------------------------------------------------

    this.movement =
      clampVec(
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
    // RETURN
    // -----------------------------------------------------

    return {

      movement:
        this.movement,

      gesture:
        this.currentGesture,

      handDetected:
        true,

      confidence:
        this.confidence
    };
  }
}


// ---------------------------------------------------------
// DISTANCE BETWEEN LANDMARKS
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