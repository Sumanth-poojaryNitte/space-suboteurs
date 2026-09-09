import { SocketClient } from "./network/SocketClient.js";
import { NetworkState } from "./network/NetworkState.js";
import { HandTracker } from "./gesture/HandTracker.js";
import { GestureController } from "./gesture/GestureController.js";
import { Renderer } from "./game/Renderer.js";
import { Minimap } from "./ui/Minimap.js";
import { SABOTAGE_ROOMS, roomAt } from "./game/MapData.js";
import { AudioManager } from "./audio/AudioManager.js";

// =====================================================================
// SPACE SABOTEURS - MAIN
// =====================================================================
//
// Camera pipeline:
//
// Webcam
//   ↓
// HandTracker
//   ↓
// MediaPipe landmarks
//   ↓
// GestureController
//   ↓
// currentMovement
//   ↓
// player_input
//   ↓
// multiplayer server
//
// IMPORTANT:
// HandTracker receives ONE permanent onResults callback.
// We do NOT replace handTracker.onResults after start().
//
// AUDIO:
// Background music starts when the actual game screen starts.
// Kill sound plays when a player_killed event is received.
// Meeting buzzer starts when a meeting starts.
// Meeting buzzer loops until the meeting closes.
// =====================================================================


// =====================================================================
// SETUP
// =====================================================================

const GAME_SERVER_URL =
  (window.__ENV__ && window.__ENV__.GAME_SERVER_URL) ||
  "http://localhost:3001";

const socketClient = new SocketClient(GAME_SERVER_URL);
const net = new NetworkState();

const canvas = document.getElementById("game-canvas");
const renderer = new Renderer(canvas);

const minimap = new Minimap(
  document.getElementById("minimap-canvas")
);


// ---------------------------------------------------------------------
// AUDIO
// ---------------------------------------------------------------------

const audioManager = new AudioManager();


// =====================================================================
// GESTURE / CAMERA STATE
// =====================================================================

let handTracker = null;
let gestureController = new GestureController();

let usingKeyboard = false;

let currentMovement = {
  x: 0,
  y: 0,
};

let calibrationLandmarks = null;

let calibrationStarted = false;
let gameScreenEntered = false;

let calibrationCanvas = null;
let gameHandCanvas = null;


// =====================================================================
// GAME STATE
// =====================================================================

let pendingRoomName = "";
let pendingAction = null;
let joinRoomCode = "";

let latestVoteTarget = null;

let fps = 0;
let frameCount = 0;
let fpsTimer = performance.now();
let lastFrameTime = performance.now();

let movementIntervalStarted = false;
let pingIntervalStarted = false;
let gameLoopStarted = false;
let socketEventsWired = false;
let rendererResizeAttached = false;

let lastObservedPhase = null;


// =====================================================================
// CAMERA RESULT STATE
// =====================================================================

let latestHandResult = null;


// =====================================================================
// HELPERS
// =====================================================================

const el = (id) => document.getElementById(id);

function hasElement(id) {
  return !!document.getElementById(id);
}


// =====================================================================
// SCREEN MANAGEMENT
// =====================================================================

function showScreen(id) {
  document
    .querySelectorAll(".screen")
    .forEach((screen) => {
      screen.classList.remove("active");
    });

  const screen = el(id);

  if (screen) {
    screen.classList.add("active");
  }
}

function showModal(id, show) {
  const modal = el(id);

  if (!modal) {
    return;
  }

  modal.style.display = show ? "flex" : "none";
}


// =====================================================================
// MENU
// =====================================================================

if (el("btn-create-game")) {
  el("btn-create-game").onclick = () => {
    pendingAction = "create";

    if (el("modal-name-title")) {
      el("modal-name-title").textContent =
        "Create Game";
    }

    showModal("modal-name", true);
  };
}


if (el("btn-join-game")) {
  el("btn-join-game").onclick = () => {
    showModal("modal-join", true);
  };
}


if (el("btn-join-cancel")) {
  el("btn-join-cancel").onclick = () => {
    showModal("modal-join", false);
  };
}


if (el("btn-join-confirm")) {
  el("btn-join-confirm").onclick = () => {
    const code =
      el("input-room-code")?.value
        .trim()
        .toUpperCase();

    const name =
      el("input-join-name")?.value.trim();

    if (!code || !name) {
      return;
    }

    joinRoomCode = code;
    pendingRoomName = name;

    localStorage.setItem(
      "ss_name",
      pendingRoomName
    );

    showModal("modal-join", false);

    doJoin();
  };
}


if (el("btn-quick-play")) {
  el("btn-quick-play").onclick = () => {
    pendingAction = "quickplay";

    if (el("modal-name-title")) {
      el("modal-name-title").textContent =
        "Quick Play";
    }

    showModal("modal-name", true);
  };
}


if (el("btn-name-cancel")) {
  el("btn-name-cancel").onclick = () => {
    showModal("modal-name", false);
  };
}


if (el("btn-name-confirm")) {
  el("btn-name-confirm").onclick = () => {
    const name =
      el("input-name")?.value.trim();

    if (!name) {
      return;
    }

    pendingRoomName = name;

    localStorage.setItem(
      "ss_name",
      pendingRoomName
    );

    showModal("modal-name", false);

    if (pendingAction === "create") {
      doCreate();
    }

    if (pendingAction === "quickplay") {
      doQuickPlay();
    }
  };
}


if (el("btn-how-to-play")) {
  el("btn-how-to-play").onclick = () => {
    showModal("modal-help", true);
  };
}


if (el("btn-help-close")) {
  el("btn-help-close").onclick = () => {
    showModal("modal-help", false);
  };
}


function setMenuError(message) {
  if (el("menu-error")) {
    el("menu-error").textContent =
      message || "";
  }
}


// =====================================================================
// CONNECTION
// =====================================================================

async function ensureConnected() {
  if (socketClient.connected) {
    wireSocketEvents();
    return;
  }

  setConnectionUi("connecting");

  await socketClient.connect();

  wireSocketEvents();

  setConnectionUi("online");
}


// =====================================================================
// CREATE ROOM
// =====================================================================

async function doCreate() {
  try {
    await ensureConnected();

    const res =
      await socketClient.request(
        "create_room",
        {
          name: pendingRoomName,
        }
      );

    if (res?.error) {
      setMenuError(
        describeError(res.error)
      );

      return;
    }

    onJoinedRoom(res);

  } catch (err) {
    console.error(
      "[Room] Create room error:",
      err
    );

    setMenuError(
      "Could not reach the game server. Check GAME_SERVER_URL."
    );
  }
}


// =====================================================================
// JOIN ROOM
// =====================================================================

async function doJoin() {
  try {
    await ensureConnected();

    const res =
      await socketClient.request(
        "join_room",
        {
          roomId: joinRoomCode,
          name: pendingRoomName,
        }
      );

    if (res?.error) {
      setMenuError(
        describeError(res.error)
      );

      return;
    }

    onJoinedRoom(res);

  } catch (err) {
    console.error(
      "[Room] Join room error:",
      err
    );

    setMenuError(
      "Could not reach the game server. Check GAME_SERVER_URL."
    );
  }
}


// =====================================================================
// QUICK PLAY
// =====================================================================

async function doQuickPlay() {
  try {
    await ensureConnected();

    const res =
      await socketClient.request(
        "quick_play",
        {
          name: pendingRoomName,
        }
      );

    if (res?.error) {
      setMenuError(
        describeError(res.error)
      );

      return;
    }

    onJoinedRoom(res);

  } catch (err) {
    console.error(
      "[Room] Quick play error:",
      err
    );

    setMenuError(
      "Could not reach the game server. Check GAME_SERVER_URL."
    );
  }
}


// =====================================================================
// SERVER ERRORS
// =====================================================================

function describeError(code) {
  const map = {
    ROOM_FULL:
      "That room is full (10/10 players).",

    GAME_ALREADY_STARTED:
      "That game has already started.",

    ROOM_NOT_FOUND:
      "No room with that code.",

    INVALID_ROOM_CODE:
      "Room codes are 6 letters/numbers.",

    INVALID_NAME:
      "Enter a name (1-16 characters).",
  };

  return map[code] || code;
}


// =====================================================================
// JOINED ROOM
// =====================================================================

function onJoinedRoom(res) {
  net.roomId = res.roomId;
  net.playerId = res.playerId;

  localStorage.setItem(
    `ss_reconnect_${res.roomId}`,
    res.reconnectToken || ""
  );

  localStorage.setItem(
    "ss_last_room",
    res.roomId
  );

  localStorage.setItem(
    "ss_name",
    pendingRoomName
  );

  setMenuError("");

  // Reset camera/game state.
  stopCamera();
  resetCameraState();

  // Stop any previous game music.
  audioManager.stopBackgroundMusic();

  // Stop any previous meeting buzzer.
  audioManager.stopMeetingBuzzer();

  showModal(
    "modal-name",
    false
  );

  showModal(
    "modal-join",
    false
  );

  showScreen("screen-lobby");

  renderLobbyIfActive();
}


// =====================================================================
// SOCKET EVENTS
// =====================================================================

function wireSocketEvents() {
  if (socketEventsWired) {
    return;
  }

  socketEventsWired = true;

  // -------------------------------------------------------------------
  // FULL GAME STATE
  // -------------------------------------------------------------------

  socketClient.on(
    "game_state",
    (state) => {
      if (!state) {
        return;
      }

      const previousPhase =
        net.phase;

      net.applyFullState(state);

      renderLobbyIfActive();

      // ---------------------------------------------------------------
      // GAME START
      // ---------------------------------------------------------------

      if (
        state.phase === "PLAYING" &&
        previousPhase !== "PLAYING"
      ) {
        console.log(
          "[Game] PLAYING received."
        );

        beginPlayingSetup();
      }

      // ---------------------------------------------------------------
      // MEETING
      // ---------------------------------------------------------------

      if (state.phase === "MEETING") {
        showMeetingOverlay(true);

        // Start the buzzer only when entering the meeting.
        // It will loop until the meeting closes.
        if (previousPhase !== "MEETING") {
          audioManager.startMeetingBuzzer();
        }

        renderMeeting();

      } else {

        // Meeting has closed.
        if (previousPhase === "MEETING") {
          audioManager.stopMeetingBuzzer();
        }

        showMeetingOverlay(false);
      }

      // ---------------------------------------------------------------
      // RETURN TO LOBBY
      // ---------------------------------------------------------------

      if (
        state.phase === "LOBBY" &&
        previousPhase !== "LOBBY"
      ) {
        resetGameStateForLobby();
      }

      updateHud();
    }
  );


  // -------------------------------------------------------------------
  // PLAYER MOVEMENT
  // -------------------------------------------------------------------

  socketClient.on(
    "player_moved",
    (list) => {
      net.applyMovementSnapshot(list);
    }
  );


  // -------------------------------------------------------------------
  // PRIVATE STATE
  // -------------------------------------------------------------------

  socketClient.on(
    "private_state",
    (priv) => {
      net.applyPrivateState(priv);
      updateHud();
    }
  );


  // -------------------------------------------------------------------
  // PLAYER JOINED
  // -------------------------------------------------------------------

  socketClient.on(
    "player_joined",
    (p) => {
      if (p) {
        logEvent(
          `${p.name} joined the room.`
        );
      }
    }
  );


  // -------------------------------------------------------------------
  // PLAYER LEFT
  // -------------------------------------------------------------------

  socketClient.on(
    "player_left",
    () => {
      renderLobbyIfActive();
    }
  );


  // -------------------------------------------------------------------
  // SYSTEM MESSAGE
  // -------------------------------------------------------------------

  socketClient.on(
    "system_message",
    (m) => {
      if (m?.text) {
        logEvent(m.text);
      }
    }
  );


  // -------------------------------------------------------------------
  // TASK
  // -------------------------------------------------------------------

  socketClient.on(
    "task_updated",
    () => {
      updateHud();
    }
  );


  // -------------------------------------------------------------------
  // KILL
  // -------------------------------------------------------------------

  socketClient.on(
    "player_killed",
    (d) => {
      // Play the kill sound whenever a kill event
      // is received from the server.
      audioManager.playKillSound();

      if (d?.victimName) {
        logEvent(
          `${d.victimName} was killed.`
        );
      }
    }
  );


  // -------------------------------------------------------------------
  // BODY
  // -------------------------------------------------------------------

  socketClient.on(
    "body_created",
    () => {}
  );


  // -------------------------------------------------------------------
  // MEETING
  // -------------------------------------------------------------------

  socketClient.on(
    "meeting_started",
    () => {
      showMeetingOverlay(true);

      // Start the looping meeting buzzer.
      audioManager.startMeetingBuzzer();

      renderMeeting();
    }
  );


  // -------------------------------------------------------------------
  // VOTE
  // -------------------------------------------------------------------

  socketClient.on(
    "vote_updated",
    () => {
      renderMeeting();
    }
  );


  // -------------------------------------------------------------------
  // VOTING RESULTS
  // -------------------------------------------------------------------

  socketClient.on(
    "voting_results",
    (r) => {
      if (!r) {
        return;
      }

      if (r.tie) {
        logEvent(
          "The vote was tied — no one was ejected."
        );
      } else if (r.ejectedName) {
        logEvent(
          `${r.ejectedName} was ejected. They were ${
            r.ejectedRole === "IMPOSTER"
              ? "an Imposter"
              : "not an Imposter"
          }.`
        );
      } else {
        logEvent(
          "No one was ejected."
        );
      }
    }
  );


  // -------------------------------------------------------------------
  // SABOTAGE
  // -------------------------------------------------------------------

  socketClient.on(
    "sabotage_started",
    (s) => {
      showSabotageBanner(s);
    }
  );


  socketClient.on(
    "sabotage_updated",
    (s) => {
      showSabotageBanner(s);
    }
  );


  socketClient.on(
    "sabotage_repaired",
    () => {
      hideSabotageBanner();

      logEvent(
        "Sabotage repaired."
      );
    }
  );


  // -------------------------------------------------------------------
  // CHAT
  // -------------------------------------------------------------------

  socketClient.on(
    "meeting_chat",
    (entry) => {
      appendChat(entry);
    }
  );


  // -------------------------------------------------------------------
  // GAME OVER
  // -------------------------------------------------------------------

  socketClient.on(
    "game_over",
    (results) => {
      showResults(results);
    }
  );


  // -------------------------------------------------------------------
  // DISCONNECT
  // -------------------------------------------------------------------

  if (socketClient.socket) {
    socketClient.socket.on(
      "disconnect",
      () => {
        setConnectionUi("offline");

        // Stop meeting buzzer if connection is lost.
        audioManager.stopMeetingBuzzer();

        if (el("connection-lost-banner")) {
          el(
            "connection-lost-banner"
          ).style.display =
            "block";
        }
      }
    );


    // -----------------------------------------------------------------
    // CONNECT
    // -----------------------------------------------------------------

    socketClient.socket.on(
      "connect",
      () => {
        setConnectionUi("online");

        if (el("connection-lost-banner")) {
          el(
            "connection-lost-banner"
          ).style.display =
            "none";
        }

        attemptReconnect();
      }
    );
  }
}


// =====================================================================
// RECONNECT
// =====================================================================

function attemptReconnect() {
  const roomId =
    net.roomId;

  if (!roomId) {
    return;
  }

  const token =
    localStorage.getItem(
      `ss_reconnect_${roomId}`
    );

  if (!token) {
    return;
  }

  socketClient.emit(
    "reconnect_to_room",
    {
      roomId,
      reconnectToken: token,
    }
  );
}


// =====================================================================
// CONNECTION UI
// =====================================================================

function setConnectionUi(state) {
  const dot =
    document.querySelector(
      "#connection-status .dot"
    );

  const text =
    el("connection-text");

  if (dot) {
    dot.className =
      "dot " + state;
  }

  if (text) {
    text.textContent =
      state.toUpperCase();
  }
}


// =====================================================================
// LOBBY
// =====================================================================

function renderLobbyIfActive() {
  const lobby =
    el("screen-lobby");

  if (
    !lobby ||
    !lobby.classList.contains("active")
  ) {
    return;
  }

  if (el("lobby-room-code")) {
    el("lobby-room-code").textContent =
      net.roomId || "------";
  }

  if (el("lobby-player-count")) {
    el("lobby-player-count").textContent =
      `${net.players.size}/10`;
  }

  const container =
    el("lobby-players");

  if (container) {
    container.innerHTML = "";

    net.players.forEach(
      (p) => {
        const row =
          document.createElement(
            "div"
          );

        row.className =
          "entry";

        row.innerHTML = `
          <span
            class="dot"
            style="background:${p.color}"
          ></span>

          <span>
            ${escapeHtml(p.name)}
            ${p.id === net.hostId ? " (host)" : ""}
            ${!p.connected ? " (disconnected)" : ""}
          </span>

          <span
            style="
              margin-left:auto;
              color:${p.ready ? "#2ecc71" : "#9aa5c7"}
            "
          >
            ${p.ready ? "READY" : ""}
          </span>
        `;

        container.appendChild(row);
      }
    );
  }

  if (el("setting-imposters")) {
    el("setting-imposters").textContent =
      net.settings.imposters ?? 1;
  }

  if (el("setting-cooldown")) {
    el("setting-cooldown").textContent =
      `${Math.round(
        (net.settings.killCooldownMs ?? 20000) / 1000
      )}s`;
  }

  if (el("setting-tasks")) {
    el("setting-tasks").textContent =
      net.settings.taskCount ?? 4;
  }

  const isHost =
    net.hostId === net.playerId;

  if (el("btn-start-game")) {
    el("btn-start-game").style.display =
      isHost
        ? "inline-block"
        : "none";
  }

  if (el("lobby-status")) {
    el("lobby-status").textContent =
      isHost
        ? "You are the host — start when ready."
        : "Waiting for host...";
  }

  if (net.phase === "COUNTDOWN") {
    if (el("lobby-status")) {
      el("lobby-status").textContent =
        "Starting...";
    }

    startCountdownUi();
  }
}


// =====================================================================
// READY
// =====================================================================

if (el("btn-ready")) {
  el("btn-ready").onclick = () => {
    const me =
      net.me;

    const nextReady =
      !(me && me.ready);

    socketClient.emit(
      "player_ready",
      {
        ready: nextReady,
      }
    );
  };
}


// =====================================================================
// START GAME
// =====================================================================

if (el("btn-start-game")) {
  el("btn-start-game").onclick =
    async () => {
      try {
        const res =
          await socketClient.request(
            "start_game",
            {}
          );

        if (res?.error) {
          setMenuError(
            describeError(res.error)
          );
        }
      } catch (err) {
        console.error(
          "[Game] Start game failed:",
          err
        );
      }
    };
}


// =====================================================================
// LEAVE LOBBY
// =====================================================================

if (el("btn-leave-lobby")) {
  el("btn-leave-lobby").onclick =
    () => {
      socketClient.emit(
        "leave_room",
        {}
      );

      stopCamera();
      resetCameraState();

      audioManager.stopBackgroundMusic();
      audioManager.stopMeetingBuzzer();

      showScreen(
        "screen-menu"
      );
    };
}


function startCountdownUi() {
  // Server-driven countdown.
}


// =====================================================================
// CAMERA CANVAS
// =====================================================================

function createHandCanvas(
  video,
  existingCanvas = null
) {
  if (!video) {
    return null;
  }

  const parent =
    video.parentElement;

  if (!parent) {
    return null;
  }

  const computed =
    getComputedStyle(parent);

  if (computed.position === "static") {
    parent.style.position =
      "relative";
  }

  let canvasOverlay =
    existingCanvas;

  if (!canvasOverlay) {
    canvasOverlay =
      document.createElement(
        "canvas"
      );

    canvasOverlay.className =
      "hand-landmark-overlay";

    canvasOverlay.setAttribute(
      "aria-hidden",
      "true"
    );

    parent.appendChild(
      canvasOverlay
    );
  }

  canvasOverlay.style.position =
    "absolute";

  canvasOverlay.style.left =
    "0";

  canvasOverlay.style.top =
    "0";

  canvasOverlay.style.width =
    "100%";

  canvasOverlay.style.height =
    "100%";

  canvasOverlay.style.pointerEvents =
    "none";

  canvasOverlay.style.zIndex =
    "5";

  return canvasOverlay;
}


// =====================================================================
// RESIZE HAND CANVAS
// =====================================================================

function resizeHandCanvas(
  video,
  canvasOverlay
) {
  if (
    !video ||
    !canvasOverlay
  ) {
    return;
  }

  const width =
    video.videoWidth ||
    video.clientWidth ||
    640;

  const height =
    video.videoHeight ||
    video.clientHeight ||
    480;

  if (
    canvasOverlay.width !== width ||
    canvasOverlay.height !== height
  ) {
    canvasOverlay.width =
      width;

    canvasOverlay.height =
      height;
  }
}


// =====================================================================
// DRAW HAND
// =====================================================================

function drawHandLandmarks(
  canvasOverlay,
  video,
  landmarks
) {
  if (
    !canvasOverlay ||
    !video
  ) {
    return;
  }

  const ctx =
    canvasOverlay.getContext("2d");

  if (!ctx) {
    return;
  }

  resizeHandCanvas(
    video,
    canvasOverlay
  );

  const width =
    canvasOverlay.width;

  const height =
    canvasOverlay.height;

  ctx.clearRect(
    0,
    0,
    width,
    height
  );

  if (
    !landmarks ||
    landmarks.length === 0
  ) {
    return;
  }

  const connections = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],

    [0, 5],
    [5, 6],
    [6, 7],
    [7, 8],

    [5, 9],
    [9, 10],
    [10, 11],
    [11, 12],

    [9, 13],
    [13, 14],
    [14, 15],
    [15, 16],

    [13, 17],
    [17, 18],
    [18, 19],
    [19, 20],

    [0, 17],
  ];

  // -------------------------------------------------------------------
  // Skeleton
  // -------------------------------------------------------------------

  ctx.lineWidth =
    3;

  ctx.strokeStyle =
    "#00ff88";

  ctx.lineCap =
    "round";

  connections.forEach(
    ([a, b]) => {
      const p1 =
        landmarks[a];

      const p2 =
        landmarks[b];

      if (!p1 || !p2) {
        return;
      }

      ctx.beginPath();

      ctx.moveTo(
        p1.x * width,
        p1.y * height
      );

      ctx.lineTo(
        p2.x * width,
        p2.y * height
      );

      ctx.stroke();
    }
  );


  // -------------------------------------------------------------------
  // Points
  // -------------------------------------------------------------------

  landmarks.forEach(
    (point, index) => {
      if (!point) {
        return;
      }

      const x =
        point.x * width;

      const y =
        point.y * height;

      ctx.beginPath();

      ctx.arc(
        x,
        y,
        index === 0
          ? 6
          : 4,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        index === 0
          ? "#ffffff"
          : "#00ff88";

      ctx.fill();
    }
  );
}


// =====================================================================
// CLEAR HAND CANVAS
// =====================================================================

function clearHandCanvas(
  canvasOverlay
) {
  if (!canvasOverlay) {
    return;
  }

  const ctx =
    canvasOverlay.getContext("2d");

  if (!ctx) {
    return;
  }

  ctx.clearRect(
    0,
    0,
    canvasOverlay.width,
    canvasOverlay.height
  );
}


// =====================================================================
// CALIBRATION STATUS
// =====================================================================

function setCalibrationStatus(text) {
  const status =
    el("calibration-status");

  if (status) {
    status.textContent =
      text;
  }
}


// =====================================================================
// CAMERA ERROR MESSAGE
// =====================================================================

function cameraErrorMessage(err) {
  if (!err) {
    return "Camera could not be started.";
  }

  switch (err.message) {
    case "CAMERA_PERMISSION_DENIED":
      return (
        "Camera permission was denied. " +
        "Allow camera access in the browser and retry."
      );

    case "CAMERA_NOT_FOUND":
      return (
        "No camera was found. Connect a webcam or use keyboard controls."
      );

    case "CAMERA_IN_USE":
      return (
        "The camera is already being used by another application. " +
        "Close Camera, Teams, Zoom, Discord or other webcam apps."
      );

    case "CAMERA_SECURITY_ERROR":
      return (
        "Camera access is blocked. Use HTTPS or localhost."
      );

    case "CAMERA_UNSUPPORTED":
      return (
        "This browser does not support webcam access. Try Chrome or Edge."
      );

    case "CAMERA_VIDEO_ELEMENT_MISSING":
      return (
        "Camera video element was not found in index.html."
      );

    case "MEDIAPIPE_HANDS_NOT_LOADED":
      return (
        "MediaPipe Hands did not load. Check your internet connection and refresh."
      );

    case "MEDIAPIPE_CAMERA_NOT_LOADED":
      return (
        "MediaPipe Camera Utils did not load. Check your internet connection and refresh."
      );

    case "CAMERA_ABORTED":
      return (
        "Camera startup was interrupted. Please retry."
      );

    case "CAMERA_CONSTRAINT_ERROR":
      return (
        "The camera does not support the requested settings."
      );

    case "CAMERA_VIDEO_ERROR":
      return (
        "The browser could not play the camera video."
      );

    case "CAMERA_VIDEO_TIMEOUT":
      return (
        "The camera did not start in time. Please retry."
      );

    default:
      return (
        `Camera error: ${err.message || "Unknown error"}`
      );
  }
}


// =====================================================================
// PERMANENT HANDTRACKER RESULT CALLBACK
// =====================================================================

function handleHandTrackerResult(result) {
  if (!result) {
    return;
  }

  latestHandResult =
    result;

  const calibrationVideo =
    el("calibration-video");

  const gameVideo =
    el("game-video");

  // -------------------------------------------------------------------
  // CALIBRATION MODE
  // -------------------------------------------------------------------

  if (
    calibrationStarted &&
    !gameScreenEntered
  ) {
    if (result.detected) {
      calibrationLandmarks =
        result.landmarks;

      drawHandLandmarks(
        calibrationCanvas,
        calibrationVideo,
        result.landmarks
      );

      setCalibrationStatus(
        "HAND DETECTED ✓ — Hold your hand steady and press CALIBRATE."
      );

    } else {
      calibrationLandmarks =
        null;

      clearHandCanvas(
        calibrationCanvas
      );

      setCalibrationStatus(
        "Show your open hand clearly inside the camera box."
      );
    }

    return;
  }


  // -------------------------------------------------------------------
  // GAME MODE
  // -------------------------------------------------------------------

  if (
    gameScreenEntered &&
    !usingKeyboard
  ) {
    if (result.detected) {
      drawHandLandmarks(
        gameHandCanvas,
        gameVideo,
        result.landmarks
      );
    } else {
      clearHandCanvas(
        gameHandCanvas
      );
    }

    // ---------------------------------------------------------------
    // Gesture Controller
    // ---------------------------------------------------------------

    try {
      const output =
        gestureController.update(
          result
        );

      if (output) {
        currentMovement =
          output.movement || {
            x: 0,
            y: 0,
          };

        updateGestureIndicator(
          output,
          result
        );
      }

    } catch (err) {
      console.error(
        "[Gesture] Controller update failed:",
        err
      );

      currentMovement = {
        x: 0,
        y: 0,
      };
    }
  }
}


// =====================================================================
// CREATE HAND TRACKER
// =====================================================================

function createHandTracker(video) {
  if (!video) {
    throw new Error(
      "CAMERA_VIDEO_ELEMENT_MISSING"
    );
  }

  console.log(
    "[Camera] Creating HandTracker..."
  );

  return new HandTracker({
    videoEl: video,

    onResults: handleHandTrackerResult,

    onError: (error) => {
      console.error(
        "[Camera] HandTracker error:",
        error
      );

      const message =
        cameraErrorMessage(error);

      if (
        calibrationStarted &&
        !gameScreenEntered
      ) {
        setCalibrationStatus(
          message
        );
      }
    },
  });
}


// =====================================================================
// START CALIBRATION
// =====================================================================

async function startCalibration() {
  if (calibrationStarted) {
    return;
  }

  if (net.phase !== "PLAYING") {
    return;
  }

  calibrationStarted = true;
  gameScreenEntered = false;

  usingKeyboard = false;

  console.log(
    "[Camera] ========================================"
  );

  console.log(
    "[Camera] Starting camera calibration..."
  );

  console.log(
    "[Camera] ========================================"
  );

  showScreen(
    "screen-lobby"
  );

  const overlay =
    el("calibration-overlay");

  if (overlay) {
    overlay.classList.add(
      "active"
    );
  }

  setCalibrationStatus(
    "Requesting camera access..."
  );

  const video =
    el("calibration-video");

  if (!video) {
    calibrationStarted = false;

    setCalibrationStatus(
      "Camera video element was not found in index.html."
    );

    return;
  }

  const oldRetry =
    el("camera-retry-btn");

  if (oldRetry) {
    oldRetry.remove();
  }

  if (handTracker) {
    try {
      handTracker.stop();
    } catch (err) {
      console.warn(
        "[Camera] Previous tracker stop failed:",
        err
      );
    }

    handTracker = null;
  }

  calibrationLandmarks =
    null;

  latestHandResult =
    null;

  gestureController =
    new GestureController();

  currentMovement = {
    x: 0,
    y: 0,
  };

  video.autoplay =
    true;

  video.muted =
    true;

  video.playsInline =
    true;

  video.setAttribute(
    "autoplay",
    ""
  );

  video.setAttribute(
    "playsinline",
    ""
  );

  video.setAttribute(
    "muted",
    ""
  );

  video.style.display =
    "block";

  calibrationCanvas =
    createHandCanvas(
      video,
      calibrationCanvas
    );

  clearHandCanvas(
    calibrationCanvas
  );

  try {
    handTracker =
      createHandTracker(
        video
      );

    await handTracker.start();

    try {
      await video.play();
    } catch (playError) {
      console.warn(
        "[Camera] Video play warning:",
        playError
      );
    }

    resizeHandCanvas(
      video,
      calibrationCanvas
    );

    setCalibrationStatus(
      "Camera active — show your open hand inside the camera box."
    );

    console.log(
      "[Camera] Webcam started successfully."
    );

    console.log(
      "[Camera] MediaPipe hand tracking started successfully."
    );

  } catch (err) {
    console.error(
      "[Camera] Calibration startup failed:",
      err
    );

    if (handTracker) {
      try {
        handTracker.stop();
      } catch {}
    }

    handTracker = null;

    calibrationLandmarks =
      null;

    latestHandResult =
      null;

    clearHandCanvas(
      calibrationCanvas
    );

    calibrationStarted =
      false;

    currentMovement = {
      x: 0,
      y: 0,
    };

    let message =
      cameraErrorMessage(
        err
      );

    if (
      !window.isSecureContext &&
      location.hostname !== "localhost" &&
      location.hostname !== "127.0.0.1"
    ) {
      message +=
        " Open the game using HTTPS or localhost.";
    }

    setCalibrationStatus(
      message
    );

    createCameraRetryButton();
  }
}


// =====================================================================
// CAMERA RETRY
// =====================================================================

function createCameraRetryButton() {
  const overlay =
    el("calibration-overlay");

  if (!overlay) {
    return;
  }

  const oldRetry =
    el("camera-retry-btn");

  if (oldRetry) {
    oldRetry.remove();
  }

  const retry =
    document.createElement(
      "button"
    );

  retry.id =
    "camera-retry-btn";

  retry.textContent =
    "RETRY CAMERA";

  retry.className =
    "primary";

  retry.style.marginTop =
    "10px";

  retry.onclick =
    async () => {
      retry.disabled =
        true;

      retry.textContent =
        "STARTING...";

      calibrationStarted =
        false;

      await startCalibration();

      if (
        retry.parentElement
      ) {
        retry.remove();
      }
    };

  overlay.appendChild(
    retry
  );
}


// =====================================================================
// CALIBRATE BUTTON
// =====================================================================

if (el("btn-calibrate")) {
  el("btn-calibrate").onclick =
    () => {
      if (
        !calibrationLandmarks ||
        calibrationLandmarks.length < 21
      ) {
        setCalibrationStatus(
          "No hand detected yet — place your hand inside the camera box."
        );

        return;
      }

      console.log(
        "[Camera] Calibrating gesture controller..."
      );

      try {
        const success =
          gestureController.calibrate(
            calibrationLandmarks
          );

        if (!success) {
          throw new Error(
            "Calibration returned false."
          );
        }

        usingKeyboard =
          false;

        console.log(
          "[Camera] Gesture calibration complete."
        );

        console.log(
          "[Camera] Neutral hand position:",
          gestureController.neutral
        );

        finishCalibration();

      } catch (err) {
        console.error(
          "[Camera] Gesture calibration failed:",
          err
        );

        setCalibrationStatus(
          "Calibration failed. Hold your hand clearly inside the camera box and try again."
        );
      }
    };
}


// =====================================================================
// KEYBOARD FALLBACK
// =====================================================================

if (el("btn-use-keyboard")) {
  el("btn-use-keyboard").onclick =
    () => {
      console.log(
        "[Game] Switching to keyboard control."
      );

      usingKeyboard =
        true;

      currentMovement = {
        x: 0,
        y: 0,
      };

      stopCamera();

      calibrationStarted =
        true;

      finishCalibration();
    };
}


// =====================================================================
// STOP CAMERA
// =====================================================================

function stopCamera() {
  console.log(
    "[Camera] Stopping camera..."
  );

  if (handTracker) {
    try {
      handTracker.stop();
    } catch (err) {
      console.warn(
        "[Camera] HandTracker stop failed:",
        err
      );
    }

    handTracker =
      null;
  }

  const calibrationVideo =
    el("calibration-video");

  const gameVideo =
    el("game-video");

  [
    calibrationVideo,
    gameVideo,
  ].forEach(
    (video) => {
      if (!video) {
        return;
      }

      try {
        video.pause();
      } catch {}

      try {
        video.srcObject =
          null;
      } catch {}
    }
  );

  calibrationLandmarks =
    null;

  latestHandResult =
    null;

  currentMovement = {
    x: 0,
    y: 0,
  };

  clearHandCanvas(
    calibrationCanvas
  );

  clearHandCanvas(
    gameHandCanvas
  );

  updateGestureIndicator(
    {
      movement: {
        x: 0,
        y: 0,
      },
      gesture: "NONE",
      handDetected: false,
      confidence: 0,
    },
    {
      detected: false,
    }
  );

  console.log(
    "[Camera] Camera stopped."
  );
}


// =====================================================================
// RESET CAMERA STATE
// =====================================================================

function resetCameraState() {
  calibrationStarted =
    false;

  gameScreenEntered =
    false;

  calibrationLandmarks =
    null;

  latestHandResult =
    null;

  currentMovement = {
    x: 0,
    y: 0,
  };

  gestureController =
    new GestureController();

  clearHandCanvas(
    calibrationCanvas
  );

  clearHandCanvas(
    gameHandCanvas
  );

  const retry =
    el("camera-retry-btn");

  if (retry) {
    retry.remove();
  }

  const overlay =
    el("calibration-overlay");

  if (overlay) {
    overlay.classList.remove(
      "active"
    );
  }
}


// =====================================================================
// RESET GAME STATE FOR LOBBY
// =====================================================================

function resetGameStateForLobby() {
  stopCamera();

  resetCameraState();

  // Stop game background music.
  audioManager.stopBackgroundMusic();

  // Stop meeting buzzer.
  audioManager.stopMeetingBuzzer();

  showMeetingOverlay(
    false
  );

  hideSabotageBanner();

  if (el("results-overlay")) {
    el("results-overlay").classList.remove(
      "active"
    );
  }

  if (el("camera-panel")) {
    el("camera-panel").style.display =
      "";
  }

  showScreen(
    "screen-lobby"
  );

  renderLobbyIfActive();
}


// =====================================================================
// FINISH CALIBRATION
// =====================================================================

function finishCalibration() {
  const overlay =
    el("calibration-overlay");

  if (overlay) {
    overlay.classList.remove(
      "active"
    );
  }

  enterGameScreen();
}


// =====================================================================
// ATTACH GAME CAMERA
// =====================================================================

async function attachGameCamera() {
  if (usingKeyboard) {
    return;
  }

  if (!handTracker) {
    console.warn(
      "[Game] Cannot attach camera: HandTracker missing."
    );

    return;
  }

  if (!handTracker.isRunning()) {
    console.warn(
      "[Game] Cannot attach camera: HandTracker is not running."
    );

    return;
  }

  const gameVideo =
    el("game-video");

  if (!gameVideo) {
    console.error(
      "[Game] #game-video not found."
    );

    return;
  }

  gameVideo.autoplay =
    true;

  gameVideo.muted =
    true;

  gameVideo.playsInline =
    true;

  gameVideo.setAttribute(
    "autoplay",
    ""
  );

  gameVideo.setAttribute(
    "playsinline",
    ""
  );

  gameVideo.setAttribute(
    "muted",
    ""
  );

  gameVideo.style.display =
    "block";

  gameHandCanvas =
    createHandCanvas(
      gameVideo,
      gameHandCanvas
    );

  clearHandCanvas(
    gameHandCanvas
  );

  const stream =
    handTracker.getStream();

  if (!stream) {
    console.error(
      "[Game] HandTracker has no active stream."
    );

    return;
  }

  gameVideo.srcObject =
    stream;

  try {
    await gameVideo.play();

    console.log(
      "[Game] Game camera preview started."
    );

  } catch (err) {
    console.warn(
      "[Game] Game video play warning:",
      err
    );
  }

  resizeHandCanvas(
    gameVideo,
    gameHandCanvas
  );

  console.log(
    "[Game] Same camera stream attached to game preview."
  );
}


// =====================================================================
// ENTER GAME SCREEN
// =====================================================================

async function enterGameScreen() {
  if (gameScreenEntered) {
    showScreen(
      "screen-game"
    );

    // Make sure music is running.
    audioManager.startBackgroundMusic();

    return;
  }

  if (
    !usingKeyboard &&
    !handTracker
  ) {
    console.warn(
      "[Game] HandTracker is not ready."
    );

    return;
  }

  if (
    !usingKeyboard &&
    !handTracker.isRunning()
  ) {
    console.warn(
      "[Game] HandTracker exists but is not running."
    );

    return;
  }

  gameScreenEntered =
    true;

  showScreen(
    "screen-game"
  );

  // -------------------------------------------------------------------
  // START GAME MUSIC
  // -------------------------------------------------------------------

  audioManager.startBackgroundMusic();

  renderer.resize();

  if (!rendererResizeAttached) {
    rendererResizeAttached =
      true;

    window.addEventListener(
      "resize",
      () => {
        renderer.resize();

        if (!usingKeyboard) {
          resizeHandCanvas(
            el("game-video"),
            gameHandCanvas
          );

          resizeHandCanvas(
            el("calibration-video"),
            calibrationCanvas
          );
        }
      }
    );
  }

  if (!usingKeyboard) {
    const cameraPanel =
      el("camera-panel");

    if (cameraPanel) {
      cameraPanel.style.display =
        "";
    }

    await attachGameCamera();

  } else {

    if (el("camera-panel")) {
      el("camera-panel").style.display =
        "none";
    }

    currentMovement = {
      x: 0,
      y: 0,
    };
  }

  if (!gameLoopStarted) {
    gameLoopStarted =
      true;

    lastFrameTime =
      performance.now();

    fpsTimer =
      performance.now();

    requestAnimationFrame(
      gameLoop
    );
  }

  if (!movementIntervalStarted) {
    movementIntervalStarted =
      true;

    setInterval(
      sendMovementInput,
      1000 / 18
    );
  }

  if (!pingIntervalStarted) {
    pingIntervalStarted =
      true;

    setInterval(
      pingServer,
      2000
    );
  }

  console.log(
    "[Game] Game screen entered."
  );
}


// =====================================================================
// GESTURE INDICATOR
// =====================================================================

function updateGestureIndicator(
  output,
  rawResult
) {
  if (!output) {
    return;
  }

  const handDetected =
    output.handDetected ??
    rawResult?.detected ??
    false;

  if (el("gesture-name")) {
    el("gesture-name").textContent =
      output.gesture ||
      "NONE";
  }

  if (el("hand-control-state")) {
    el("hand-control-state").textContent =
      handDetected
        ? "ON"
        : "SEARCHING";
  }

  if (el("dbg-hand")) {
    el("dbg-hand").textContent =
      handDetected
        ? "DETECTED"
        : "LOST";
  }

  if (el("dbg-conf")) {
    const confidence =
      Number(
        output.confidence
      ) || 0;

    el("dbg-conf").textContent =
      confidence > 0
        ? `${Math.round(
            confidence * 100
          )}%`
        : "-";
  }

  if (el("dbg-gesture")) {
    el("dbg-gesture").textContent =
      output.gesture ||
      "NONE";
  }

  const x =
    Number(
      output.movement?.x
    ) || 0;

  const y =
    Number(
      output.movement?.y
    ) || 0;

  if (el("dbg-movement")) {
    el("dbg-movement").textContent =
      `x:${x.toFixed(2)} y:${y.toFixed(2)}`;
  }

  if (el("gesture-move")) {
    let direction =
      "STOP";

    if (
      Math.abs(x) > 0.2
    ) {
      direction =
        x > 0
          ? "RIGHT"
          : "LEFT";
    }

    if (
      Math.abs(y) > 0.2
    ) {
      direction =
        y > 0
          ? "DOWN"
          : "UP";
    }

    if (
      Math.abs(x) > 0.2 &&
      Math.abs(y) > 0.2
    ) {
      if (x > 0 && y > 0) {
        direction =
          "DOWN-RIGHT";
      } else if (x > 0 && y < 0) {
        direction =
          "UP-RIGHT";
      } else if (x < 0 && y > 0) {
        direction =
          "DOWN-LEFT";
      } else if (x < 0 && y < 0) {
        direction =
          "UP-LEFT";
      }
    }

    el("gesture-move").textContent =
      `MOVE — ${direction}`;
  }
}


// =====================================================================
// CAMERA HIDE / SHOW
// =====================================================================

if (el("hide-camera-btn")) {
  el("hide-camera-btn").onclick =
    () => {
      const panel =
        el("camera-panel");

      if (!panel) {
        return;
      }

      panel.classList.toggle(
        "hidden"
      );

      el("hide-camera-btn").textContent =
        panel.classList.contains(
          "hidden"
        )
          ? "SHOW"
          : "HIDE";
    };
}


// =====================================================================
// KEYBOARD
// =====================================================================

const keysDown =
  new Set();


window.addEventListener(
  "keydown",
  (e) => {
    const key =
      e.key.toLowerCase();

    keysDown.add(
      key
    );

    if (e.key === "F3") {
      e.preventDefault();

      const debug =
        el("debug-panel");

      if (debug) {
        debug.classList.toggle(
          "active"
        );
      }
    }
  }
);


window.addEventListener(
  "keyup",
  (e) => {
    keysDown.delete(
      e.key.toLowerCase()
    );
  }
);


function computeKeyboardVector() {
  let x = 0;
  let y = 0;

  if (
    keysDown.has("a") ||
    keysDown.has("arrowleft")
  ) {
    x -= 1;
  }

  if (
    keysDown.has("d") ||
    keysDown.has("arrowright")
  ) {
    x += 1;
  }

  if (
    keysDown.has("w") ||
    keysDown.has("arrowup")
  ) {
    y -= 1;
  }

  if (
    keysDown.has("s") ||
    keysDown.has("arrowdown")
  ) {
    y += 1;
  }

  const magnitude =
    Math.hypot(
      x,
      y
    );

  if (magnitude > 0) {
    return {
      x:
        x / magnitude,

      y:
        y / magnitude,
    };
  }

  return {
    x: 0,
    y: 0,
  };
}


// =====================================================================
// MOVEMENT
// =====================================================================

function sendMovementInput() {
  if (
    net.phase !== "PLAYING"
  ) {
    return;
  }

  const vector =
    usingKeyboard
      ? computeKeyboardVector()
      : currentMovement;

  const x =
    Math.max(
      -1,
      Math.min(
        1,
        Number(vector?.x) || 0
      )
    );

  const y =
    Math.max(
      -1,
      Math.min(
        1,
        Number(vector?.y) || 0
      )
    );

  socketClient.emit(
    "player_input",
    {
      x,
      y,
    }
  );
}


// =====================================================================
// GAME LOOP
// =====================================================================

function gameLoop(now) {
  const dt =
    Math.min(
      0.1,
      (now - lastFrameTime) / 1000
    );

  lastFrameTime =
    now;

  net.step(dt);

  const me =
    net.me;

  if (me) {
    renderer.centerCameraOn(
      me.renderX,
      me.renderY
    );
  }

  const localTasks =
    net.privateState.tasks ||
    [];

  renderer.draw(
    net,
    localTasks
  );

  minimap.draw(
    net,
    !!net.sabotage &&
      net.sabotage.type ===
        "electrical"
  );

  updateInteractPrompt();

  updateActionBar();

  updateDebugPanel();

  frameCount +=
    1;

  if (
    now - fpsTimer >
    500
  ) {
    fps =
      Math.round(
        (frameCount * 1000) /
          (now - fpsTimer)
      );

    frameCount =
      0;

    fpsTimer =
      now;
  }

  requestAnimationFrame(
    gameLoop
  );
}


// =====================================================================
// INTERACTION PROMPT
// =====================================================================

function updateInteractPrompt() {
  const me =
    net.me;

  const prompt =
    el("interact-prompt");

  if (!prompt) {
    return;
  }

  if (
    !me ||
    !me.alive
  ) {
    prompt.style.display =
      "none";

    window._nearestInteractable =
      null;

    return;
  }

  const localTasks =
    net.privateState.tasks ||
    [];

  const nearest =
    renderer.nearestInteractable(
      me.renderX,
      me.renderY,
      localTasks,
      net.bodies,
      net.privateState.taskRange ||
        70
    );

  window._nearestInteractable =
    nearest;

  if (!nearest) {
    prompt.style.display =
      "none";

    return;
  }

  prompt.style.display =
    "block";

  if (
    nearest.type ===
    "task"
  ) {
    prompt.textContent =
      `Press USE to: ${nearest.task.label}`;

  } else {
    prompt.textContent =
      `Press USE to report ${nearest.body.victimName}'s body`;
  }
}


// =====================================================================
// ACTION BAR
// =====================================================================

function updateActionBar() {
  const me =
    net.me;

  const role =
    net.privateState.role;

  if (el("btn-kill")) {
    el("btn-kill").style.display =
      role === "IMPOSTER"
        ? "inline-block"
        : "none";
  }

  if (el("btn-sabotage")) {
    el("btn-sabotage").style.display =
      role === "IMPOSTER"
        ? "inline-block"
        : "none";
  }

  if (el("btn-report")) {
    el("btn-report").style.display =
      net.bodies.length > 0
        ? "inline-block"
        : "none";
  }

  if (
    role === "IMPOSTER" &&
    me &&
    el("btn-kill")
  ) {
    const cooldownUntil =
      Number(
        net.privateState.killCooldownUntil
      ) || 0;

    const onCooldown =
      Date.now() <
      cooldownUntil -
        net.serverTimeOffset;

    const nearestTarget =
      findNearestKillTarget();

    el("btn-kill").disabled =
      onCooldown ||
      !nearestTarget;

    el("btn-kill").textContent =
      onCooldown
        ? "KILL (CD)"
        : "KILL";
  }

  if (el("btn-use")) {
    el("btn-use").disabled =
      !window._nearestInteractable;
  }

  if (el("btn-report")) {
    el("btn-report").disabled =
      net.bodies.length === 0;
  }
}


// =====================================================================
// FIND KILL TARGET
// =====================================================================

function findNearestKillTarget() {
  const me =
    net.me;

  if (!me) {
    return null;
  }

  let best =
    null;

  let bestDistance =
    net.privateState.killRange ||
    90;

  net.players.forEach(
    (p) => {
      if (
        p.id === net.playerId ||
        !p.alive ||
        !p.connected
      ) {
        return;
      }

      const distance =
        Math.hypot(
          p.renderX -
            me.renderX,
          p.renderY -
            me.renderY
        );

      if (
        distance <
        bestDistance
      ) {
        bestDistance =
          distance;

        best =
          p;
      }
    }
  );

  return best;
}


// =====================================================================
// USE
// =====================================================================

if (el("btn-use")) {
  el("btn-use").onclick =
    () => {
      const nearest =
        window._nearestInteractable;

      if (!nearest) {
        return;
      }

      if (
        nearest.type ===
        "task"
      ) {
        socketClient.request(
          "complete_task",
          {
            taskId:
              nearest.task.id,
          }
        );

      } else if (
        nearest.type ===
        "body"
      ) {
        socketClient.request(
          "report_body",
          {
            bodyId:
              nearest.body.id,
          }
        );
      }
    };
}


// =====================================================================
// REPORT
// =====================================================================

if (el("btn-report")) {
  el("btn-report").onclick =
    () => {
      const body =
        net.bodies[0];

      if (!body) {
        return;
      }

      socketClient.request(
        "report_body",
        {
          bodyId:
            body.id,
        }
      );
    };
}


// =====================================================================
// KILL
// =====================================================================

if (el("btn-kill")) {
  el("btn-kill").onclick =
    () => {
      const target =
        findNearestKillTarget();

      if (!target) {
        return;
      }

      socketClient.request(
        "kill_request",
        {
          targetId:
            target.id,
        }
      );
    };
}


// =====================================================================
// EMERGENCY MEETING
// =====================================================================

if (el("btn-meeting")) {
  el("btn-meeting").onclick =
    () => {
      socketClient.request(
        "emergency_meeting",
        {}
      );
    };
}


// =====================================================================
// SABOTAGE
// =====================================================================

if (el("btn-sabotage")) {
  el("btn-sabotage").onclick =
    () => {
      showModal(
        "modal-sabotage",
        true
      );
    };
}


if (el("btn-sabotage-cancel")) {
  el("btn-sabotage-cancel").onclick =
    () => {
      showModal(
        "modal-sabotage",
        false
      );
    };
}


document
  .querySelectorAll(
    "#modal-sabotage [data-sab]"
  )
  .forEach(
    (button) => {
      button.onclick =
        () => {
          socketClient.request(
            "start_sabotage",
            {
              type:
                button.dataset.sab,
            }
          );

          showModal(
            "modal-sabotage",
            false
          );
        };
    }
  );


// =====================================================================
// SABOTAGE BANNER
// =====================================================================

function showSabotageBanner(s) {
  if (!s) {
    return;
  }

  const banner =
    el("sabotage-banner");

  if (!banner) {
    return;
  }

  banner.style.display =
    "block";

  banner.dataset.type =
    s.type;

  const tick =
    () => {
      if (!net.sabotage) {
        banner.style.display =
          "none";

        return;
      }

      const remaining =
        Math.max(
          0,
          s.startedAt +
            s.timerMs -
            net.serverNow()
        );

      banner.textContent =
        `${s.label.toUpperCase()} SABOTAGE — ${Math.ceil(
          remaining / 1000
        )}s`;

      if (
        remaining > 0 &&
        net.sabotage
      ) {
        requestAnimationFrame(
          tick
        );
      }
    };

  tick();
}


function hideSabotageBanner() {
  const banner =
    el("sabotage-banner");

  if (banner) {
    banner.style.display =
      "none";
  }
}


// =====================================================================
// SABOTAGE REPAIR
// =====================================================================

window.addEventListener(
  "keydown",
  (e) => {
    if (
      e.key.toLowerCase() !== "e" ||
      !net.sabotage
    ) {
      return;
    }

    const me =
      net.me;

    if (!me) {
      return;
    }

    const currentRoom =
      roomAt(
        me.renderX,
        me.renderY
      );

    const needed =
      SABOTAGE_ROOMS[
        net.sabotage.type
      ] || [];

    if (
      needed.includes(
        currentRoom
      )
    ) {
      socketClient.request(
        "repair_sabotage",
        {
          room:
            currentRoom,
        }
      );
    }
  }
);


// =====================================================================
// HUD
// =====================================================================

function updateHud() {
  const role =
    net.privateState.role;

  const badge =
    el("role-badge");

  if (
    badge &&
    role
  ) {
    badge.textContent =
      role;

    badge.className =
      role === "IMPOSTER"
        ? "imposter"
        : "crewmate";
  }

  const progress =
    el("task-progress");

  if (progress) {
    progress.textContent =
      `Tasks: ${net.taskProgress.done}/${net.taskProgress.total}`;
  }
}


// =====================================================================
// EVENT LOG
// =====================================================================

function logEvent(text) {
  const log =
    el("event-log");

  if (!log) {
    return;
  }

  const line =
    document.createElement(
      "div"
    );

  line.textContent =
    text;

  log.prepend(
    line
  );

  while (
    log.children.length >
    30
  ) {
    log.removeChild(
      log.lastChild
    );
  }
}


// =====================================================================
// MEETING OVERLAY
// =====================================================================

function showMeetingOverlay(show) {
  const overlay =
    el("meeting-overlay");

  if (!overlay) {
    return;
  }

  overlay.classList.toggle(
    "active",
    show
  );

  if (show) {
    latestVoteTarget =
      null;
  }
}


// =====================================================================
// RENDER MEETING
// =====================================================================

function renderMeeting() {
  if (!net.meeting) {
    return;
  }

  if (el("meeting-reason")) {
    el("meeting-reason").textContent =
      net.meeting.reason ||
      "";
  }

  const grid =
    el("vote-grid");

  if (!grid) {
    return;
  }

  grid.innerHTML =
    "";

  net.players.forEach(
    (p) => {
      if (!p.connected) {
        return;
      }

      const card =
        document.createElement(
          "div"
        );

      card.className =
        "vote-card" +
        (!p.alive
          ? " dead"
          : "") +
        (latestVoteTarget === p.id
          ? " selected"
          : "");

      card.innerHTML = `
        <span
          class="dot"
          style="background:${p.color}"
        ></span>

        <span>
          ${escapeHtml(p.name)}
        </span>
      `;

      if (p.alive) {
        card.onclick =
          () => castVote(p.id);
      }

      grid.appendChild(
        card
      );
    }
  );


  // -------------------------------------------------------------------
  // Skip
  // -------------------------------------------------------------------

  const skipCard =
    document.createElement(
      "div"
    );

  skipCard.className =
    "vote-card" +
    (
      latestVoteTarget ===
      "skip"
        ? " selected"
        : ""
    );

  skipCard.innerHTML =
    "<span>SKIP VOTE</span>";

  skipCard.onclick =
    () => castVote("skip");

  grid.appendChild(
    skipCard
  );


  // -------------------------------------------------------------------
  // Timer
  // -------------------------------------------------------------------

  const remaining =
    Math.max(
      0,
      net.meeting.startedAt +
        net.meeting.durationMs -
        net.serverNow()
    );

  if (el("meeting-timer")) {
    el("meeting-timer").textContent =
      Math.ceil(
        remaining / 1000
      );
  }


  // -------------------------------------------------------------------
  // Chat
  // -------------------------------------------------------------------

  if (el("chat-log")) {
    el("chat-log").innerHTML =
      "";

    (
      net.meeting.chat ||
      []
    ).forEach(
      appendChat
    );
  }
}


// =====================================================================
// VOTE
// =====================================================================

function castVote(targetId) {
  if (latestVoteTarget) {
    return;
  }

  latestVoteTarget =
    targetId;

  socketClient.request(
    "submit_vote",
    {
      targetId,
    }
  );

  renderMeeting();
}


// =====================================================================
// CHAT
// =====================================================================

if (el("btn-chat-send")) {
  el("btn-chat-send").onclick =
    sendChat;
}


if (el("chat-input")) {
  el("chat-input").addEventListener(
    "keydown",
    (e) => {
      if (
        e.key === "Enter"
      ) {
        sendChat();
      }
    }
  );
}


function sendChat() {
  const input =
    el("chat-input");

  if (!input) {
    return;
  }

  const text =
    input.value.trim();

  if (!text) {
    return;
  }

  socketClient.emit(
    "meeting_chat",
    {
      text,
    }
  );

  input.value =
    "";
}


function appendChat(entry) {
  const log =
    el("chat-log");

  if (
    !log ||
    !entry
  ) {
    return;
  }

  const line =
    document.createElement(
      "div"
    );

  line.innerHTML =
    `<strong>${escapeHtml(
      entry.name
    )}:</strong> ${escapeHtml(
      entry.text
    )}`;

  log.appendChild(
    line
  );

  log.scrollTop =
    log.scrollHeight;
}


function escapeHtml(str) {
  const div =
    document.createElement(
      "div"
    );

  div.textContent =
    str ?? "";

  return div.innerHTML;
}


// =====================================================================
// MEETING TIMER
// =====================================================================

setInterval(
  () => {
    if (
      net.phase === "MEETING" &&
      net.meeting
    ) {
      renderMeeting();
    }
  },
  500
);


// =====================================================================
// RESULTS
// =====================================================================

function showResults(results) {
  stopCamera();

  // Stop game music.
  audioManager.stopBackgroundMusic();

  // Stop meeting buzzer.
  audioManager.stopMeetingBuzzer();

  calibrationStarted =
    false;

  gameScreenEntered =
    false;

  const overlay =
    el("results-overlay");

  if (!overlay) {
    return;
  }

  overlay.classList.add(
    "active"
  );

  const title =
    el("results-title");

  if (title) {
    title.textContent =
      results?.winner ===
      "IMPOSTERS"
        ? "IMPOSTERS WIN"
        : "CREWMATES WIN";

    title.className =
      results?.winner ===
      "IMPOSTERS"
        ? "imposter-win"
        : "crew-win";
  }

  if (el("results-reason")) {
    el("results-reason").textContent =
      results?.reason ||
      "";
  }

  const list =
    el("results-list");

  if (!list) {
    return;
  }

  list.innerHTML =
    "";

  (
    results?.players ||
    []
  ).forEach(
    (p) => {
      const row =
        document.createElement(
          "div"
        );

      row.className =
        "result-row";

      row.innerHTML = `
        <span>
          ${escapeHtml(p.name)} —
          ${escapeHtml(p.role)}
          ${p.alive ? "" : " (dead)"}
        </span>

        <span>
          ${p.tasksDone}/${p.taskCount}
        </span>
      `;

      list.appendChild(
        row
      );
    }
  );

  if (el("btn-play-again")) {
    el("btn-play-again").style.display =
      net.hostId ===
      net.playerId
        ? "inline-block"
        : "none";
  }
}


// =====================================================================
// PLAY AGAIN
// =====================================================================

if (el("btn-play-again")) {
  el("btn-play-again").onclick =
    async () => {
      try {
        const res =
          await socketClient.request(
            "play_again",
            {}
          );

        if (res?.error) {
          console.warn(
            "Play again error:",
            res.error
          );
        }

      } catch (err) {
        console.error(
          "Play again failed:",
          err
        );
      }

      stopCamera();

      resetCameraState();

      audioManager.stopBackgroundMusic();
      audioManager.stopMeetingBuzzer();

      if (el("results-overlay")) {
        el("results-overlay").classList.remove(
          "active"
        );
      }

      showScreen(
        "screen-lobby"
      );
    };
}


// =====================================================================
// RETURN TO LOBBY
// =====================================================================

if (el("btn-return-lobby")) {
  el("btn-return-lobby").onclick =
    () => {
      stopCamera();

      resetCameraState();

      audioManager.stopBackgroundMusic();
      audioManager.stopMeetingBuzzer();

      if (el("results-overlay")) {
        el("results-overlay").classList.remove(
          "active"
        );
      }

      showScreen(
        "screen-lobby"
      );

      renderLobbyIfActive();
    };
}


// =====================================================================
// PING
// =====================================================================

let lastPing = 0;


function pingServer() {
  if (
    !socketClient.connected
  ) {
    return;
  }

  const start =
    performance.now();

  socketClient
    .request(
      "ping_check",
      {}
    )
    .then(() => {
      lastPing =
        Math.round(
          performance.now() -
            start
        );
    })
    .catch(() => {});
}


// =====================================================================
// DEBUG
// =====================================================================

function updateDebugPanel() {
  const debug =
    el("debug-panel");

  if (
    !debug ||
    !debug.classList.contains(
      "active"
    )
  ) {
    return;
  }

  if (el("dbg-fps")) {
    el("dbg-fps").textContent =
      fps;
  }

  if (el("dbg-ping")) {
    el("dbg-ping").textContent =
      lastPing;
  }

  if (el("dbg-server")) {
    el("dbg-server").textContent =
      socketClient.connected
        ? "ONLINE"
        : "OFFLINE";
  }

  if (el("dbg-room")) {
    el("dbg-room").textContent =
      net.roomId ||
      "-";
  }

  if (el("dbg-phase")) {
    el("dbg-phase").textContent =
      net.phase;
  }

  if (el("dbg-playerid")) {
    el("dbg-playerid").textContent =
      net.playerId ||
      "-";
  }

  if (el("dbg-role")) {
    el("dbg-role").textContent =
      net.privateState.role ||
      "-";
  }

  const me =
    net.me;

  if (me) {
    if (el("dbg-pos")) {
      el("dbg-pos").textContent =
        `${Math.round(
          me.renderX
        )}, ${Math.round(
          me.renderY
        )}`;
    }

    if (el("dbg-currentroom")) {
      el("dbg-currentroom").textContent =
        roomAt(
          me.renderX,
          me.renderY
        ) ||
        "corridor";
    }
  }
}


// =====================================================================
// PLAYING SETUP
// =====================================================================

function beginPlayingSetup() {
  if (net.phase !== "PLAYING") {
    return;
  }

  if (
    calibrationStarted ||
    gameScreenEntered
  ) {
    return;
  }

  console.log(
    "[Game] Beginning PLAYING setup."
  );

  startCalibration();
}


// =====================================================================
// PHASE WATCHER
// =====================================================================

setInterval(
  () => {
    const phase =
      net.phase;

    if (
      phase === "PLAYING" &&
      lastObservedPhase !==
        "PLAYING"
    ) {
      beginPlayingSetup();
    }

    if (
      phase === "LOBBY" &&
      lastObservedPhase !==
        "LOBBY"
    ) {
      resetGameStateForLobby();
    }

    lastObservedPhase =
      phase;
  },
  250
);


// =====================================================================
// RESTORE SAVED NAME
// =====================================================================

const savedName =
  localStorage.getItem(
    "ss_name"
  );

if (savedName) {
  if (el("input-name")) {
    el("input-name").value =
      savedName;
  }

  if (el("input-join-name")) {
    el("input-join-name").value =
      savedName;
  }
}


// =====================================================================
// INITIAL CAMERA CANVAS PREPARATION
// =====================================================================

function prepareCameraCanvases() {
  const calibrationVideo =
    el("calibration-video");

  if (calibrationVideo) {
    calibrationCanvas =
      createHandCanvas(
        calibrationVideo,
        calibrationCanvas
      );
  }

  const gameVideo =
    el("game-video");

  if (gameVideo) {
    gameHandCanvas =
      createHandCanvas(
        gameVideo,
        gameHandCanvas
      );
  }
}


// =====================================================================
// DOM READY
// =====================================================================

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    prepareCameraCanvases,
    {
      once: true,
    }
  );
} else {
  prepareCameraCanvases();
}


// =====================================================================
// INITIAL STATE
// =====================================================================

setConnectionUi(
  "offline"
);

console.log(
  "================================================="
);

console.log(
  "SPACE SABOTEURS"
);

console.log(
  "Main.js initialized."
);

console.log(
  "HandTracker integration ready."
);

console.log(
  "GestureController integration ready."
);

console.log(
  "AudioManager integration ready."
);

console.log(
  "Meeting buzzer integration ready."
);

console.log(
  "Camera callback architecture: STABLE"
);

console.log(
  "================================================="
);