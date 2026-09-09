// js/gesture/HandTracker.js
//
// Handles:
// 1. Webcam permission and stream
// 2. MediaPipe Hands initialization
// 3. Hand landmark detection
// 4. Sending camera frames to MediaPipe
// 5. Returning detection results to main.js
// 6. Proper cleanup when camera control is stopped

export class HandTracker {
  constructor({ videoEl, onResults, onError }) {
    this.videoEl = videoEl;
    this.onResults = onResults;
    this.onError = onError;

    this.hands = null;
    this.camera = null;
    this.stream = null;

    this.running = false;
    this.starting = false;

    this.lastHandSeenAt = 0;
    this.lastFrameSentAt = 0;

    this.targetFPS = 20;
  }

  // =========================================================
  // START
  // =========================================================

  async start() {
    if (this.running) {
      console.log("[HandTracker] Already running.");
      return;
    }

    if (this.starting) {
      console.log("[HandTracker] Start already in progress.");
      return;
    }

    this.starting = true;

    console.log("[HandTracker] Starting...");

    try {
      // -----------------------------------------------------
      // 1. Check video element
      // -----------------------------------------------------

      if (!this.videoEl) {
        throw this.createError(
          "CAMERA_VIDEO_ELEMENT_MISSING",
          "Camera video element was not found."
        );
      }

      // -----------------------------------------------------
      // 2. Check browser camera support
      // -----------------------------------------------------

      if (
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== "function"
      ) {
        throw this.createError(
          "CAMERA_UNSUPPORTED",
          "This browser does not support camera access."
        );
      }

      // -----------------------------------------------------
      // 3. Check secure context
      // -----------------------------------------------------

      //
      // Camera normally requires:
      // - HTTPS
      // - OR localhost
      //
      if (!window.isSecureContext) {
        console.warn(
          "[HandTracker] Page is not running in a secure context."
        );

        throw this.createError(
          "CAMERA_SECURITY_ERROR",
          "Camera requires HTTPS or localhost."
        );
      }

      // -----------------------------------------------------
      // 4. Check MediaPipe Hands
      // -----------------------------------------------------

      if (typeof window.Hands === "undefined") {
        console.error(
          "[HandTracker] MediaPipe Hands is not loaded."
        );

        throw this.createError(
          "MEDIAPIPE_HANDS_NOT_LOADED",
          "MediaPipe Hands library is not loaded."
        );
      }

      // -----------------------------------------------------
      // 5. Check MediaPipe Camera
      // -----------------------------------------------------

      if (typeof window.Camera === "undefined") {
        console.error(
          "[HandTracker] MediaPipe Camera utility is not loaded."
        );

        throw this.createError(
          "MEDIAPIPE_CAMERA_NOT_LOADED",
          "MediaPipe Camera utility is not loaded."
        );
      }

      // -----------------------------------------------------
      // 6. Request webcam
      // -----------------------------------------------------

      let stream;

      try {
        console.log(
          "[HandTracker] Requesting camera permission..."
        );

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: {
              ideal: 640
            },
            height: {
              ideal: 480
            },
            facingMode: "user"
          },
          audio: false
        });

        console.log(
          "[HandTracker] Camera permission granted."
        );
      } catch (err) {
        console.error(
          "[HandTracker] getUserMedia failed:",
          err
        );

        // Some cameras reject the ideal constraints.
        // Try a simpler request before giving up.
        if (err.name === "OverconstrainedError") {
          try {
            console.log(
              "[HandTracker] Retrying with basic camera constraints..."
            );

            stream =
              await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
              });

            console.log(
              "[HandTracker] Camera opened with fallback constraints."
            );
          } catch (fallbackErr) {
            throw this.mapCameraError(fallbackErr);
          }
        } else {
          throw this.mapCameraError(err);
        }
      }

      this.stream = stream;

      // -----------------------------------------------------
      // 7. Attach stream to video
      // -----------------------------------------------------

      this.videoEl.srcObject = this.stream;

      this.videoEl.autoplay = true;
      this.videoEl.muted = true;
      this.videoEl.playsInline = true;

      // Wait until video metadata is available.
      await this.waitForVideo();

      try {
        await this.videoEl.play();

        console.log(
          "[HandTracker] Video playback started."
        );
      } catch (err) {
        console.warn(
          "[HandTracker] video.play() failed:",
          err
        );

        // Browser may start playback automatically shortly after.
        // Do not immediately fail camera tracking here.
      }

      // -----------------------------------------------------
      // 8. Create MediaPipe Hands
      // -----------------------------------------------------

      console.log(
        "[HandTracker] Initializing MediaPipe Hands..."
      );

      this.hands = new window.Hands({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
      });

      // -----------------------------------------------------
      // 9. MediaPipe settings
      // -----------------------------------------------------

      this.hands.setOptions({
        maxNumHands: 1,

        // 0 = fastest
        // 1 = better accuracy
        modelComplexity: 1,

        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.50
      });

      // -----------------------------------------------------
      // 10. MediaPipe results
      // -----------------------------------------------------

      this.hands.onResults((results) => {
        if (!this.running) {
          return;
        }

        const landmarks =
          results &&
          results.multiHandLandmarks &&
          results.multiHandLandmarks.length > 0
            ? results.multiHandLandmarks[0]
            : null;

        const detected = !!landmarks;

        // ---------------------------------------------------
        // Update last-hand-seen time
        // ---------------------------------------------------

        if (detected) {
          this.lastHandSeenAt = performance.now();
        }

        // ---------------------------------------------------
        // Handedness
        // ---------------------------------------------------

        const handedness =
          results &&
          results.multiHandedness &&
          results.multiHandedness.length > 0
            ? results.multiHandedness[0]
            : null;

        // ---------------------------------------------------
        // Send result to main.js
        // ---------------------------------------------------

        const msSinceLastSeen =
          detected || this.lastHandSeenAt === 0
            ? 0
            : performance.now() - this.lastHandSeenAt;

        this.onResults?.({
          detected,
          landmarks,
          handedness,
          msSinceLastSeen
        });
      });

      // -----------------------------------------------------
      // 11. MediaPipe Camera
      // -----------------------------------------------------

      const targetInterval =
        1000 / this.targetFPS;

      this.lastFrameSentAt = 0;

      this.camera = new window.Camera(this.videoEl, {
        width: 640,
        height: 480,

        onFrame: async () => {
          if (!this.running) {
            return;
          }

          if (!this.hands) {
            return;
          }

          // Video must actually have frames.
          if (
            this.videoEl.readyState <
            HTMLMediaElement.HAVE_CURRENT_DATA
          ) {
            return;
          }

          const now = performance.now();

          // Limit MediaPipe processing to approximately 20 FPS.
          if (
            now - this.lastFrameSentAt <
            targetInterval
          ) {
            return;
          }

          this.lastFrameSentAt = now;

          try {
            await this.hands.send({
              image: this.videoEl
            });
          } catch (err) {
            console.error(
              "[HandTracker] MediaPipe frame error:",
              err
            );
          }
        }
      });

      // -----------------------------------------------------
      // 12. Start
      // -----------------------------------------------------

      this.running = true;

      this.camera.start();

      console.log(
        "[HandTracker] Camera + MediaPipe started successfully."
      );

      console.log(
        "[HandTracker] Hand tracking FPS:",
        this.targetFPS
      );
    } catch (error) {
      console.error(
        "[HandTracker] Start failed:",
        error
      );

      // Make sure partially-created resources are cleaned.
      this.cleanupStream();

      this.hands = null;
      this.camera = null;
      this.running = false;

      this.onError?.(error);

      throw error;
    } finally {
      this.starting = false;
    }
  }

  // =========================================================
  // STOP
  // =========================================================

  stop() {
    console.log("[HandTracker] Stopping...");

    this.running = false;
    this.starting = false;

    // -------------------------------------------------------
    // Stop MediaPipe camera
    // -------------------------------------------------------

    if (this.camera) {
      try {
        this.camera.stop();
      } catch (err) {
        console.warn(
          "[HandTracker] Camera stop warning:",
          err
        );
      }

      this.camera = null;
    }

    // -------------------------------------------------------
    // Stop webcam tracks
    // -------------------------------------------------------

    this.cleanupStream();

    // -------------------------------------------------------
    // Clear video
    // -------------------------------------------------------

    if (this.videoEl) {
      try {
        this.videoEl.pause();
      } catch (err) {
        console.warn(err);
      }

      this.videoEl.srcObject = null;
    }

    // -------------------------------------------------------
    // Clear MediaPipe
    // -------------------------------------------------------

    this.hands = null;

    this.lastHandSeenAt = 0;
    this.lastFrameSentAt = 0;

    console.log("[HandTracker] Stopped.");
  }

  // =========================================================
  // CLEANUP STREAM
  // =========================================================

  cleanupStream() {
    if (!this.stream) {
      return;
    }

    try {
      this.stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (err) {
          console.warn(
            "[HandTracker] Track stop warning:",
            err
          );
        }
      });
    } catch (err) {
      console.warn(
        "[HandTracker] Stream cleanup warning:",
        err
      );
    }

    this.stream = null;
  }

  // =========================================================
  // WAIT FOR VIDEO
  // =========================================================

  waitForVideo() {
    return new Promise((resolve, reject) => {
      if (!this.videoEl) {
        reject(
          this.createError(
            "CAMERA_VIDEO_ELEMENT_MISSING",
            "Camera video element is missing."
          )
        );
        return;
      }

      // Already ready.
      if (
        this.videoEl.readyState >=
        HTMLMediaElement.HAVE_METADATA
      ) {
        resolve();
        return;
      }

      let finished = false;

      const cleanup = () => {
        this.videoEl.removeEventListener(
          "loadedmetadata",
          onLoaded
        );

        this.videoEl.removeEventListener(
          "error",
          onError
        );

        clearTimeout(timeout);
      };

      const onLoaded = () => {
        if (finished) {
          return;
        }

        finished = true;
        cleanup();
        resolve();
      };

      const onError = () => {
        if (finished) {
          return;
        }

        finished = true;
        cleanup();

        reject(
          this.createError(
            "CAMERA_VIDEO_ERROR",
            "Camera video could not be initialized."
          )
        );
      };

      const timeout = setTimeout(() => {
        if (finished) {
          return;
        }

        finished = true;
        cleanup();

        // Don't always fail if metadata is delayed.
        // If stream exists, allow MediaPipe to continue.
        if (
          this.videoEl.readyState >=
          HTMLMediaElement.HAVE_CURRENT_DATA
        ) {
          resolve();
        } else {
          reject(
            this.createError(
              "CAMERA_VIDEO_TIMEOUT",
              "Camera video initialization timed out."
            )
          );
        }
      }, 8000);

      this.videoEl.addEventListener(
        "loadedmetadata",
        onLoaded
      );

      this.videoEl.addEventListener(
        "error",
        onError
      );
    });
  }

  // =========================================================
  // CAMERA ERROR MAPPING
  // =========================================================

  mapCameraError(err) {
    let code = "CAMERA_ERROR";

    switch (err?.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        code = "CAMERA_PERMISSION_DENIED";
        break;

      case "NotFoundError":
      case "DevicesNotFoundError":
        code = "CAMERA_NOT_FOUND";
        break;

      case "NotReadableError":
      case "TrackStartError":
        code = "CAMERA_IN_USE";
        break;

      case "SecurityError":
        code = "CAMERA_SECURITY_ERROR";
        break;

      case "AbortError":
        code = "CAMERA_ABORTED";
        break;

      case "OverconstrainedError":
        code = "CAMERA_CONSTRAINT_ERROR";
        break;

      case "TypeError":
        code = "CAMERA_UNSUPPORTED";
        break;

      default:
        code = "CAMERA_ERROR";
    }

    const error = new Error(code);

    error.originalError = err;

    return error;
  }

  // =========================================================
  // CREATE CUSTOM ERROR
  // =========================================================

  createError(code, message) {
    const error = new Error(code);

    error.code = code;
    error.message = code;

    if (message) {
      error.details = message;
    }

    return error;
  }

  // =========================================================
  // GET STREAM
  // =========================================================

  getStream() {
    return this.stream;
  }

  // =========================================================
  // GET VIDEO ELEMENT
  // =========================================================

  getVideoElement() {
    return this.videoEl;
  }

  // =========================================================
  // CHECK RUNNING
  // =========================================================

  isRunning() {
    return this.running;
  }
}