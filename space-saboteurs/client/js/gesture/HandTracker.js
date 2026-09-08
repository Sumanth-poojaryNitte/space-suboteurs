// Wraps MediaPipe Hands (loaded from CDN in index.html as window.Hands /
// window.Camera). Everything here runs locally in the browser: the webcam
// frames never leave this module, and never get sent to the game server.
// Only the derived landmark positions are read by GestureController, which
// in turn only sends a small movement vector over the network.

export class HandTracker {
  constructor({ videoEl, onResults, onError }) {
    this.videoEl = videoEl;
    this.onResults = onResults;
    this.onError = onError;
    this.hands = null;
    this.camera = null;
    this.running = false;
    this.lastHandSeenAt = 0;
  }

  async start() {
    if (typeof window.Hands === "undefined" || typeof window.Camera === "undefined") {
      throw new Error("MediaPipe Hands failed to load. Check your network connection.");
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 360 }, audio: false });
    } catch (err) {
      throw new Error("CAMERA_PERMISSION_DENIED");
    }
    this.videoEl.srcObject = stream;
    await this.videoEl.play();

    this.hands = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0, // lighter model, better for real-time game loop
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5,
    });
    this.hands.onResults((results) => {
      const hasHand = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;
      if (hasHand) this.lastHandSeenAt = performance.now();
      this.onResults({
        detected: hasHand,
        landmarks: hasHand ? results.multiHandLandmarks[0] : null,
        handedness: hasHand ? results.multiHandedness[0] : null,
        msSinceLastSeen: performance.now() - this.lastHandSeenAt,
      });
    });

    // Process camera frames at a capped rate so gesture tracking never
    // steals the frame budget from the 60fps game render loop.
    const targetIntervalMs = 1000 / 24;
    let lastSend = 0;
    this.camera = new window.Camera(this.videoEl, {
      onFrame: async () => {
        const now = performance.now();
        if (now - lastSend < targetIntervalMs) return;
        lastSend = now;
        await this.hands.send({ image: this.videoEl });
      },
      width: 480,
      height: 360,
    });
    this.camera.start();
    this.running = true;
  }

  stop() {
    this.running = false;
    if (this.camera) this.camera.stop();
    if (this.videoEl && this.videoEl.srcObject) {
      this.videoEl.srcObject.getTracks().forEach((t) => t.stop());
      this.videoEl.srcObject = null;
    }
  }
}
