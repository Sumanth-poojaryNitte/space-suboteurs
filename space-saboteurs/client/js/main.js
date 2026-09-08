import { SocketClient } from "./network/SocketClient.js";
import { NetworkState } from "./network/NetworkState.js";
import { HandTracker } from "./gesture/HandTracker.js";
import { GestureController } from "./gesture/GestureController.js";
import { Renderer } from "./game/Renderer.js";
import { Minimap } from "./ui/Minimap.js";
import { SABOTAGE_ROOMS, roomAt } from "./game/MapData.js";

// ---------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------

const GAME_SERVER_URL = (window.__ENV__ && window.__ENV__.GAME_SERVER_URL) || "http://localhost:3001";
const socketClient = new SocketClient(GAME_SERVER_URL);
const net = new NetworkState();

const canvas = document.getElementById("game-canvas");
const renderer = new Renderer(canvas);
const minimap = new Minimap(document.getElementById("minimap-canvas"));

let handTracker = null;
let gestureController = new GestureController();
let usingKeyboard = false;
let keyboardVector = { x: 0, y: 0 };
let currentMovement = { x: 0, y: 0 };

let pendingRoomName = "";
let pendingAction = null; // "create" | "join" | "quickplay"
let joinRoomCode = "";

let fps = 0;
let frameCount = 0;
let fpsTimer = performance.now();
let lastFrameTime = performance.now();
let latestVoteTarget = null;

const el = (id) => document.getElementById(id);

// ---------------------------------------------------------------------
// Screen management
// ---------------------------------------------------------------------

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  el(id).classList.add("active");
}

function showModal(id, show) {
  el(id).style.display = show ? "flex" : "none";
}

// ---------------------------------------------------------------------
// Menu wiring
// ---------------------------------------------------------------------

el("btn-create-game").onclick = () => {
  pendingAction = "create";
  el("modal-name-title").textContent = "Create Game";
  showModal("modal-name", true);
};

el("btn-join-game").onclick = () => showModal("modal-join", true);
el("btn-join-cancel").onclick = () => showModal("modal-join", false);
el("btn-join-confirm").onclick = () => {
  const code = el("input-room-code").value.trim().toUpperCase();
  const name = el("input-join-name").value.trim();
  if (!code || !name) return;
  joinRoomCode = code;
  pendingRoomName = name;
  showModal("modal-join", false);
  doJoin();
};

el("btn-quick-play").onclick = () => {
  pendingAction = "quickplay";
  el("modal-name-title").textContent = "Quick Play";
  showModal("modal-name", true);
};

el("btn-name-cancel").onclick = () => showModal("modal-name", false);
el("btn-name-confirm").onclick = () => {
  const name = el("input-name").value.trim();
  if (!name) return;
  pendingRoomName = name;
  showModal("modal-name", false);
  if (pendingAction === "create") doCreate();
  else if (pendingAction === "quickplay") doQuickPlay();
};

el("btn-how-to-play").onclick = () => showModal("modal-help", true);
el("btn-help-close").onclick = () => showModal("modal-help", false);

function setMenuError(msg) {
  el("menu-error").textContent = msg || "";
}

async function ensureConnected() {
  if (socketClient.connected) return;
  setConnectionUi("connecting");
  await socketClient.connect();
  wireSocketEvents();
  setConnectionUi("online");
}

async function doCreate() {
  try {
    await ensureConnected();
    const res = await socketClient.request("create_room", { name: pendingRoomName });
    if (res.error) return setMenuError(describeError(res.error));
    onJoinedRoom(res);
  } catch (err) {
    setMenuError("Could not reach the game server. Check NEXT_PUBLIC_GAME_SERVER_URL.");
  }
}

async function doJoin() {
  try {
    await ensureConnected();
    const res = await socketClient.request("join_room", { roomId: joinRoomCode, name: pendingRoomName });
    if (res.error) return setMenuError(describeError(res.error));
    onJoinedRoom(res);
  } catch (err) {
    setMenuError("Could not reach the game server. Check NEXT_PUBLIC_GAME_SERVER_URL.");
  }
}

async function doQuickPlay() {
  try {
    await ensureConnected();
    const res = await socketClient.request("quick_play", { name: pendingRoomName });
    if (res.error) return setMenuError(describeError(res.error));
    onJoinedRoom(res);
  } catch (err) {
    setMenuError("Could not reach the game server. Check NEXT_PUBLIC_GAME_SERVER_URL.");
  }
}

function describeError(code) {
  const map = {
    ROOM_FULL: "That room is full (10/10 players).",
    GAME_ALREADY_STARTED: "That game has already started.",
    ROOM_NOT_FOUND: "No room with that code.",
    INVALID_ROOM_CODE: "Room codes are 6 letters/numbers.",
    INVALID_NAME: "Enter a name (1-16 characters).",
  };
  return map[code] || code;
}

function onJoinedRoom(res) {
  net.roomId = res.roomId;
  net.playerId = res.playerId;
  localStorage.setItem(`ss_reconnect_${res.roomId}`, res.reconnectToken || "");
  localStorage.setItem("ss_last_room", res.roomId);
  localStorage.setItem("ss_name", pendingRoomName);
  setMenuError("");
  showScreen("screen-lobby");
}

// ---------------------------------------------------------------------
// Socket event wiring (server -> client)
// ---------------------------------------------------------------------

let wired = false;
function wireSocketEvents() {
  if (wired) return;
  wired = true;

  socketClient.on("game_state", (state) => {
    net.applyFullState(state);
    renderLobbyIfActive();
    if (state.phase === "PLAYING" && el("screen-game").classList.contains("active") === false) {
      enterGameScreen();
    }
    if (state.phase === "MEETING") {
      showMeetingOverlay(true);
      renderMeeting();
    } else {
      showMeetingOverlay(false);
    }
    updateHud();
  });

  socketClient.on("player_moved", (list) => net.applyMovementSnapshot(list));
  socketClient.on("private_state", (priv) => {
    net.applyPrivateState(priv);
    updateHud();
  });

  socketClient.on("player_joined", (p) => logEvent(`${p.name} joined the room.`));
  socketClient.on("player_left", () => renderLobbyIfActive());
  socketClient.on("system_message", (m) => logEvent(m.text));

  socketClient.on("task_updated", () => updateHud());
  socketClient.on("player_killed", (d) => logEvent(`${d.victimName} was killed.`));
  socketClient.on("body_created", () => {});
  socketClient.on("meeting_started", () => {
    showMeetingOverlay(true);
  });
  socketClient.on("vote_updated", () => {});
  socketClient.on("voting_results", (r) => {
    if (!r) return;
    if (r.tie) logEvent("The vote was tied — no one was ejected.");
    else if (r.ejectedName) logEvent(`${r.ejectedName} was ejected. They were ${r.ejectedRole === "IMPOSTER" ? "an Imposter" : "not an Imposter"}.`);
    else logEvent("No one was ejected.");
  });
  socketClient.on("sabotage_started", (s) => showSabotageBanner(s));
  socketClient.on("sabotage_updated", (s) => showSabotageBanner(s));
  socketClient.on("sabotage_repaired", () => {
    hideSabotageBanner();
    logEvent("Sabotage repaired.");
  });
  socketClient.on("meeting_chat", (entry) => appendChat(entry));
  socketClient.on("game_over", (results) => showResults(results));

  socketClient.socket.on("disconnect", () => {
    setConnectionUi("offline");
    el("connection-lost-banner").style.display = "block";
  });
  socketClient.socket.on("connect", () => {
    setConnectionUi("online");
    el("connection-lost-banner").style.display = "none";
    attemptReconnect();
  });
}

function attemptReconnect() {
  const roomId = net.roomId;
  if (!roomId) return;
  const token = localStorage.getItem(`ss_reconnect_${roomId}`);
  if (!token) return;
  socketClient.emit("reconnect_to_room", { roomId, reconnectToken: token });
}

function setConnectionUi(state) {
  const dot = document.querySelector("#connection-status .dot");
  const text = el("connection-text");
  dot.className = "dot " + state;
  text.textContent = state.toUpperCase();
}

// ---------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------

function renderLobbyIfActive() {
  if (!el("screen-lobby").classList.contains("active")) return;
  el("lobby-room-code").textContent = net.roomId || "------";
  el("lobby-player-count").textContent = `${net.players.size}/10`;
  const container = el("lobby-players");
  container.innerHTML = "";
  net.players.forEach((p) => {
    const row = document.createElement("div");
    row.className = "entry";
    row.innerHTML = `<span class="dot" style="background:${p.color}"></span>
      <span>${p.name}${p.id === net.hostId ? " (host)" : ""}${!p.connected ? " (disconnected)" : ""}</span>
      <span style="margin-left:auto;color:${p.ready ? "#2ecc71" : "#9aa5c7"}">${p.ready ? "READY" : ""}</span>`;
    container.appendChild(row);
  });

  el("setting-imposters").textContent = net.settings.imposters ?? 1;
  el("setting-cooldown").textContent = `${Math.round((net.settings.killCooldownMs ?? 20000) / 1000)}s`;
  el("setting-tasks").textContent = net.settings.taskCount ?? 4;

  const isHost = net.hostId === net.playerId;
  el("btn-start-game").style.display = isHost ? "inline-block" : "none";
  el("lobby-status").textContent = isHost ? "You are the host — start when ready." : "Waiting for host...";

  if (net.phase === "COUNTDOWN") {
    el("lobby-status").textContent = "Starting...";
    startCountdownUi();
  }
}

el("btn-ready").onclick = () => {
  const me = net.me;
  const nextReady = !(me && me.ready);
  socketClient.emit("player_ready", { ready: nextReady });
};

el("btn-start-game").onclick = async () => {
  const res = await socketClient.request("start_game", {});
  if (res.error) setMenuError(describeError(res.error));
};

el("btn-leave-lobby").onclick = () => {
  socketClient.emit("leave_room", {});
  showScreen("screen-menu");
};

function startCountdownUi() {
  // Countdown is server-driven; once phase flips to PLAYING we jump to
  // calibration/game. We just show a friendly status text meanwhile.
}

// ---------------------------------------------------------------------
// Calibration / hand control setup
// ---------------------------------------------------------------------

let calibrationLandmarks = null;

async function startCalibration() {
  showScreen("screen-lobby"); // keep lobby behind while overlay shows
  el("calibration-overlay").classList.add("active");
  el("calibration-status").textContent = "Requesting camera access...";

  const video = el("calibration-video");
  try {
    handTracker = new HandTracker({
      videoEl: video,
      onResults: (result) => {
        calibrationLandmarks = result.detected ? result.landmarks : null;
        el("calibration-status").textContent = result.detected
          ? "Hand detected — hold steady and press CALIBRATE."
          : "Show your open hand to the camera.";
      },
    });
    await handTracker.start();
  } catch (err) {
    if (err.message === "CAMERA_PERMISSION_DENIED") {
      el("calibration-status").textContent = "Camera access is required for hand controls.";
      const retry = document.createElement("button");
      retry.textContent = "RETRY CAMERA";
      retry.className = "primary";
      retry.onclick = () => {
        retry.remove();
        startCalibration();
      };
      el("calibration-overlay").appendChild(retry);
    } else {
      el("calibration-status").textContent = "Camera unavailable in this browser.";
    }
  }
}

el("btn-calibrate").onclick = () => {
  if (!calibrationLandmarks) {
    el("calibration-status").textContent = "No hand detected yet — try again.";
    return;
  }
  gestureController.calibrate(calibrationLandmarks);
  usingKeyboard = false;
  finishCalibration();
};

el("btn-use-keyboard").onclick = () => {
  usingKeyboard = true;
  if (handTracker) handTracker.stop();
  finishCalibration();
};

function finishCalibration() {
  el("calibration-overlay").classList.remove("active");
  enterGameScreen();
}

// ---------------------------------------------------------------------
// Game screen
// ---------------------------------------------------------------------

let gameScreenEntered = false;

function enterGameScreen() {
  if (gameScreenEntered) {
    showScreen("screen-game");
    return;
  }
  gameScreenEntered = true;
  showScreen("screen-game");
  renderer.resize();
  window.addEventListener("resize", () => renderer.resize());

  if (!usingKeyboard) {
    // Move the live game camera video feed into the in-game camera panel.
    const gameVideo = el("game-video");
    if (handTracker && handTracker.videoEl.srcObject) {
      gameVideo.srcObject = handTracker.videoEl.srcObject;
      // Assigning srcObject does not start playback on its own — the
      // calibration video gets .play() called on it inside HandTracker,
      // but this second <video> element sharing the same stream needs
      // its own explicit play() call. muted + playsInline are required
      // for autoplay to be allowed by the browser without a fresh user
      // gesture, and to avoid iOS Safari taking the video fullscreen.
      gameVideo.muted = true;
      gameVideo.playsInline = true;
      gameVideo.play().catch((err) => console.warn("game-video play failed:", err));
    }
    handTracker.onResults = (result) => {
      const out = gestureController.update(result);
      currentMovement = out.movement;
      updateGestureIndicator(out, result);
    };
  } else {
    el("camera-panel").style.display = "none";
  }

  requestAnimationFrame(gameLoop);
  setInterval(sendMovementInput, 1000 / 18); // ~18 inputs/sec, within the 10-20/sec target
  setInterval(pingServer, 2000);
}

function updateGestureIndicator(out, rawResult) {
  el("gesture-name").textContent = out.gesture;
  el("hand-control-state").textContent = out.handDetected ? "ON" : "SEARCHING";
  el("dbg-hand").textContent = out.handDetected ? "DETECTED" : "LOST";
  el("dbg-conf").textContent = out.confidence ? `${Math.round(out.confidence * 100)}%` : "-";
  el("dbg-gesture").textContent = out.gesture;
  el("dbg-movement").textContent = `x:${out.movement.x.toFixed(2)} y:${out.movement.y.toFixed(2)}`;
}

el("hide-camera-btn").onclick = () => {
  const panel = el("camera-panel");
  panel.classList.toggle("hidden");
  el("hide-camera-btn").textContent = panel.classList.contains("hidden") ? "SHOW" : "HIDE";
  // Hiding the preview never disables gesture detection — onResults keeps firing.
};

// Keyboard fallback (WASD / arrows)
const keysDown = new Set();
window.addEventListener("keydown", (e) => {
  keysDown.add(e.key.toLowerCase());
  if (e.key === "F3") {
    e.preventDefault();
    el("debug-panel").classList.toggle("active");
  }
});
window.addEventListener("keyup", (e) => keysDown.delete(e.key.toLowerCase()));

function computeKeyboardVector() {
  let x = 0, y = 0;
  if (keysDown.has("a") || keysDown.has("arrowleft")) x -= 1;
  if (keysDown.has("d") || keysDown.has("arrowright")) x += 1;
  if (keysDown.has("w") || keysDown.has("arrowup")) y -= 1;
  if (keysDown.has("s") || keysDown.has("arrowdown")) y += 1;
  const mag = Math.hypot(x, y);
  return mag > 0 ? { x: x / mag, y: y / mag } : { x: 0, y: 0 };
}

function sendMovementInput() {
  if (net.phase !== "PLAYING") return;
  const vec = usingKeyboard ? computeKeyboardVector() : currentMovement;
  socketClient.emit("player_input", { x: vec.x, y: vec.y });
}

// ---------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------

function gameLoop(now) {
  const dt = Math.min(0.1, (now - lastFrameTime) / 1000);
  lastFrameTime = now;
  net.step(dt);

  const me = net.me;
  if (me) renderer.centerCameraOn(me.renderX, me.renderY);

  const localTasks = net.privateState.tasks || [];
  renderer.draw(net, localTasks);
  minimap.draw(net, !!net.sabotage && net.sabotage.type === "electrical");

  updateInteractPrompt();
  updateActionBar();
  updateDebugPanel();

  frameCount += 1;
  if (now - fpsTimer > 500) {
    fps = Math.round((frameCount * 1000) / (now - fpsTimer));
    frameCount = 0;
    fpsTimer = now;
  }

  requestAnimationFrame(gameLoop);
}

function updateInteractPrompt() {
  const me = net.me;
  const prompt = el("interact-prompt");
  if (!me || !me.alive) {
    prompt.style.display = "none";
    window._nearestInteractable = null;
    return;
  }
  const localTasks = net.privateState.tasks || [];
  const nearest = renderer.nearestInteractable(me.renderX, me.renderY, localTasks, net.bodies, net.privateState.taskRange || 70);
  window._nearestInteractable = nearest;
  if (!nearest) {
    prompt.style.display = "none";
    return;
  }
  prompt.style.display = "block";
  prompt.textContent = nearest.type === "task" ? `Press USE to: ${nearest.task.label}` : `Press USE to report ${nearest.body.victimName}'s body`;
}

function updateActionBar() {
  const me = net.me;
  const role = net.privateState.role;
  el("btn-kill").style.display = role === "IMPOSTER" ? "inline-block" : "none";
  el("btn-sabotage").style.display = role === "IMPOSTER" ? "inline-block" : "none";
  el("btn-report").style.display = net.bodies.length > 0 ? "inline-block" : "none";

  if (role === "IMPOSTER" && me) {
    const onCooldown = Date.now() < net.privateState.killCooldownUntil - net.serverTimeOffset;
    const nearestTarget = findNearestKillTarget();
    el("btn-kill").disabled = onCooldown || !nearestTarget;
    el("btn-kill").textContent = onCooldown ? "KILL (CD)" : "KILL";
  }
  el("btn-use").disabled = !window._nearestInteractable;
  el("btn-report").disabled = net.bodies.length === 0;
}

function findNearestKillTarget() {
  const me = net.me;
  if (!me) return null;
  let best = null;
  let bestDist = net.privateState.killRange || 90;
  net.players.forEach((p) => {
    if (p.id === net.playerId || !p.alive || !p.connected) return;
    const d = Math.hypot(p.renderX - me.renderX, p.renderY - me.renderY);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  });
  return best;
}

el("btn-use").onclick = () => {
  const nearest = window._nearestInteractable;
  if (!nearest) return;
  if (nearest.type === "task") {
    socketClient.request("complete_task", { taskId: nearest.task.id });
  } else if (nearest.type === "body") {
    socketClient.request("report_body", { bodyId: nearest.body.id });
  }
};

el("btn-report").onclick = () => {
  const body = net.bodies[0];
  if (body) socketClient.request("report_body", { bodyId: body.id });
};

el("btn-kill").onclick = () => {
  const target = findNearestKillTarget();
  if (!target) return;
  socketClient.request("kill_request", { targetId: target.id });
};

el("btn-meeting").onclick = () => {
  socketClient.request("emergency_meeting", {});
};

el("btn-sabotage").onclick = () => showModal("modal-sabotage", true);
el("btn-sabotage-cancel").onclick = () => showModal("modal-sabotage", false);
document.querySelectorAll("#modal-sabotage [data-sab]").forEach((btn) => {
  btn.onclick = () => {
    socketClient.request("start_sabotage", { type: btn.dataset.sab });
    showModal("modal-sabotage", false);
  };
});

function showSabotageBanner(s) {
  if (!s) return;
  const banner = el("sabotage-banner");
  banner.style.display = "block";
  banner.dataset.type = s.type;
  const tick = () => {
    if (!net.sabotage) {
      banner.style.display = "none";
      return;
    }
    const remaining = Math.max(0, s.startedAt + s.timerMs - net.serverNow());
    banner.textContent = `${s.label.toUpperCase()} SABOTAGE — ${Math.ceil(remaining / 1000)}s`;
    if (remaining > 0 && net.sabotage) requestAnimationFrame(tick);
  };
  tick();
}

function hideSabotageBanner() {
  el("sabotage-banner").style.display = "none";
}

// Repair: pressing USE while standing in a room required by the active
// sabotage attempts a repair (in addition to task/report interactions).
window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() !== "e" || !net.sabotage) return;
  const me = net.me;
  if (!me) return;
  const currentRoom = roomAt(me.renderX, me.renderY);
  const needed = SABOTAGE_ROOMS[net.sabotage.type] || [];
  if (needed.includes(currentRoom)) {
    socketClient.request("repair_sabotage", { room: currentRoom });
  }
});

// ---------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------

function updateHud() {
  const role = net.privateState.role;
  const badge = el("role-badge");
  if (role) {
    badge.textContent = role;
    badge.className = role === "IMPOSTER" ? "imposter" : "crewmate";
  }
  el("task-progress").textContent = `Tasks: ${net.taskProgress.done}/${net.taskProgress.total}`;
}

function logEvent(text) {
  const log = el("event-log");
  const line = document.createElement("div");
  line.textContent = text;
  log.prepend(line);
  while (log.children.length > 30) log.removeChild(log.lastChild);
}

// ---------------------------------------------------------------------
// Meeting overlay
// ---------------------------------------------------------------------

function showMeetingOverlay(show) {
  el("meeting-overlay").classList.toggle("active", show);
  if (show) latestVoteTarget = null;
}

function renderMeeting() {
  if (!net.meeting) return;
  el("meeting-reason").textContent = net.meeting.reason || "";
  const grid = el("vote-grid");
  grid.innerHTML = "";
  net.players.forEach((p) => {
    if (!p.connected) return;
    const card = document.createElement("div");
    card.className = "vote-card" + (!p.alive ? " dead" : "") + (latestVoteTarget === p.id ? " selected" : "");
    card.innerHTML = `<span class="dot" style="background:${p.color}"></span><span>${p.name}</span>`;
    if (p.alive) {
      card.onclick = () => castVote(p.id);
    }
    grid.appendChild(card);
  });
  const skipCard = document.createElement("div");
  skipCard.className = "vote-card" + (latestVoteTarget === "skip" ? " selected" : "");
  skipCard.innerHTML = "<span>SKIP VOTE</span>";
  skipCard.onclick = () => castVote("skip");
  grid.appendChild(skipCard);

  const remaining = Math.max(0, net.meeting.startedAt + net.meeting.durationMs - net.serverNow());
  el("meeting-timer").textContent = Math.ceil(remaining / 1000);

  el("chat-log").innerHTML = "";
  (net.meeting.chat || []).forEach(appendChat);
}

function castVote(targetId) {
  if (latestVoteTarget) return; // already voted this meeting
  latestVoteTarget = targetId;
  socketClient.request("submit_vote", { targetId });
  renderMeeting();
}

el("btn-chat-send").onclick = sendChat;
el("chat-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendChat();
});
function sendChat() {
  const input = el("chat-input");
  const text = input.value.trim();
  if (!text) return;
  socketClient.emit("meeting_chat", { text });
  input.value = "";
}

function appendChat(entry) {
  const log = el("chat-log");
  const line = document.createElement("div");
  line.innerHTML = `<strong>${entry.name}:</strong> ${escapeHtml(entry.text)}`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

// Meeting timer visual ticking (independent of server pushes)
setInterval(() => {
  if (net.phase === "MEETING" && net.meeting) renderMeeting();
}, 500);

// ---------------------------------------------------------------------
// Results overlay
// ---------------------------------------------------------------------

function showResults(results) {
  const overlay = el("results-overlay");
  overlay.classList.add("active");
  const title = el("results-title");
  title.textContent = results.winner === "IMPOSTERS" ? "IMPOSTERS WIN" : "CREWMATES WIN";
  title.className = results.winner === "IMPOSTERS" ? "imposter-win" : "crew-win";
  el("results-reason").textContent = results.reason || "";
  const list = el("results-list");
  list.innerHTML = "";
  results.players.forEach((p) => {
    const row = document.createElement("div");
    row.className = "result-row";
    row.innerHTML = `<span>${p.name} — ${p.role}${p.alive ? "" : " (dead)"}</span><span>${p.tasksDone}/${p.taskCount}</span>`;
    list.appendChild(row);
  });
  el("btn-play-again").style.display = net.hostId === net.playerId ? "inline-block" : "none";
}

el("btn-play-again").onclick = async () => {
  await socketClient.request("play_again", {});
  el("results-overlay").classList.remove("active");
  showScreen("screen-lobby");
};

el("btn-return-lobby").onclick = () => {
  el("results-overlay").classList.remove("active");
  showScreen("screen-lobby");
};

// ---------------------------------------------------------------------
// Debug panel + ping
// ---------------------------------------------------------------------

let lastPing = 0;
function pingServer() {
  if (!socketClient.connected) return;
  const start = performance.now();
  socketClient.request("ping_check", {}).then(() => {
    lastPing = Math.round(performance.now() - start);
  }).catch(() => {});
}

function updateDebugPanel() {
  if (!el("debug-panel").classList.contains("active")) return;
  el("dbg-fps").textContent = fps;
  el("dbg-ping").textContent = lastPing;
  el("dbg-server").textContent = socketClient.connected ? "ONLINE" : "OFFLINE";
  el("dbg-room").textContent = net.roomId || "-";
  el("dbg-phase").textContent = net.phase;
  el("dbg-playerid").textContent = net.playerId || "-";
  el("dbg-role").textContent = net.privateState.role || "-";
  const me = net.me;
  if (me) {
    el("dbg-pos").textContent = `${Math.round(me.renderX)}, ${Math.round(me.renderY)}`;
    el("dbg-currentroom").textContent = roomAt(me.renderX, me.renderY) || "corridor";
  }
}

// ---------------------------------------------------------------------
// Kick things off: watch for PLAYING phase transition to trigger calibration
// ---------------------------------------------------------------------

let calibrationStarted = false;
socketClientOnStateChange();
function socketClientOnStateChange() {
  setInterval(() => {
    if (net.phase === "PLAYING" && !calibrationStarted && el("screen-lobby").classList.contains("active")) {
      calibrationStarted = true;
      startCalibration();
    }
    if (net.phase === "LOBBY") {
      calibrationStarted = false;
      gameScreenEntered = false;
    }
  }, 200);
}

// Restore a saved name for convenience.
const savedName = localStorage.getItem("ss_name");
if (savedName) {
  el("input-name").value = savedName;
  el("input-join-name").value = savedName;
}