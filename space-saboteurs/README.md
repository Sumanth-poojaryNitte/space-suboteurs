# Space Saboteurs

A real online multiplayer social-deduction game, controlled by webcam hand
gestures. Server-authoritative Node/Express/Socket.IO backend; vanilla
JS + Canvas frontend with MediaPipe Hands for local gesture tracking.

Original game — not a copy of any existing title's characters, UI, map,
sounds, or branding.

## What's real here vs. what's a known v1 limitation

**Real:**
- Actual Socket.IO rooms with room codes, lobby, ready/start, quick play matchmaking
- Server-authoritative movement, collision, tasks, kill, report, meetings, voting, sabotage, win conditions — the server never trusts client-sent positions or outcomes
- Client-side interpolation for smooth remote-player movement (no teleporting)
- Real webcam hand-gesture movement via MediaPipe Hands, 100% local — no video ever leaves the browser, only an {x,y} movement vector goes to the server
- Reconnect tokens + host migration on disconnect
- Debug panel (F3), connection status indicator, server-time-based timers

**Known v1 simplifications** (structured so you can extend them):
- Task mini-games are simplified to "walk up, hold/click USE" rather than
  bespoke mini-game UIs per task — `TASK_DEFINITIONS` in
  `server/src/game/MapData.js` has a `type` field (`hold`/`sequence`) you
  can hook richer mini-games into; the server only cares that
  `complete_task` was called while in range.
- Collision is simple AABB room/corridor containment, not per-wall physics.
- No vents/emergency-only cams — not requested in scope, but the
  `systems`-style split (kill/report/meeting/sabotage all live as methods
  on `GameRoom`) makes them straightforward to bolt on.

## Project structure

```
/client                      static frontend (deploy to Vercel)
  index.html
  env.js                     local dev default; regenerated at build time
  scripts/generate-env.js    build step: bakes NEXT_PUBLIC_GAME_SERVER_URL into env.js
  js/
    main.js                  screen flow, socket wiring, render loop, HUD
    network/SocketClient.js
    network/NetworkState.js  interpolation + latest server state
    gesture/HandTracker.js   MediaPipe wrapper (local-only)
    gesture/GestureController.js
    gesture/GestureSmoothing.js
    game/MapData.js          render-only copy of the map layout
    game/Renderer.js         canvas drawing
    ui/Minimap.js

/server                      persistent Socket.IO backend (deploy to Render/Railway/Fly)
  src/server.js               express + http + socket.io bootstrap
  src/socket.js                all socket event handlers + rate limiting
  src/rooms/RoomManager.js     room creation / quick play matchmaking
  src/rooms/GameRoom.js        GameState + authoritative game loop + all systems
  src/game/MapData.js          rooms, corridors, tasks, sabotage types
  src/validation/InputValidator.js  anti-cheat constants + helpers
```

## Local development

Two terminals.

**Backend:**
```
cd server
npm install
npm run dev
```
Server runs at `http://localhost:3001`.

**Frontend:**
```
cd client
npm install
npm run dev
```
This writes `env.js` (pointing at `http://localhost:3001` by default) and
serves the static client at `http://localhost:3000`.

If you'd rather not use `npx serve`, any static file server works — the
client has no build step beyond generating `env.js`, e.g.:
```
cd client
node scripts/generate-env.js
python3 -m http.server 3000
```

## Mandatory two-browser test

1. Start the backend (`server`, port 3001) and frontend (`client`, port 3000) as above.
2. Open `http://localhost:3000` in **Browser 1**. Click **CREATE GAME**, enter a name, copy the room code.
3. Open `http://localhost:3000` in **Browser 2** (or an incognito window). Click **JOIN GAME**, enter the room code and a different name.
4. Confirm both browsers show both players in the lobby player list.
5. In Browser 1 (host), click **START GAME**. Both browsers should hit hand-control calibration (or click **USE KEYBOARD INSTEAD** to skip camera for a quick test).
6. Move in Browser 1 (hand or WASD) — confirm Browser 2 sees that player move smoothly, with no teleporting.
7. Repeat moving from Browser 2, confirm Browser 1 sees it.
8. With 4 players minimum required to start a full round (imposters/tasks/etc.), open two more tabs/browsers, join the same room code, and re-test:
   - task completion (`USE` near a yellow task marker)
   - kill (imposter only, `KILL` button near a target)
   - report (`REPORT` / `USE` near a body)
   - meeting + voting + chat
   - sabotage (`SABOTAGE` button, imposter only) and repair (`E` while standing in the required room)
   - win/lose screen, **PLAY AGAIN** returning everyone to the lobby

## Manual test checklist

- [ ] `npm install` succeeds in both `server/` and `client/`
- [ ] backend starts on `PORT` (default 3001)
- [ ] frontend starts and loads `env.js` pointing at the backend
- [ ] create room / join room / quick play all work
- [ ] room code system works, 4-10 players supported
- [ ] lobby shows all connected players in real time
- [ ] host can change settings and start the game
- [ ] hand gesture calibration works; keyboard fallback works
- [ ] gesture movement is smooth (dead zone + smoothing prevent jitter)
- [ ] remote players interpolate smoothly, no teleporting
- [ ] task completion, kill, report, meeting, voting, sabotage, repair, death, and win conditions all synchronize across every connected browser
- [ ] disconnect/reconnect works without crashing the match
- [ ] host migration works if the host disconnects
- [ ] no console errors, no server crashes, no dead buttons

## Production deployment

### 1. Backend — Render / Railway / Fly.io (NOT Vercel serverless)

The Socket.IO server needs a persistent process, which Vercel serverless
functions do not provide. Deploy `server/` to Render, Railway, or Fly.io.

Example (Render):
1. New Web Service → point at this repo, root directory `server`.
2. Build command: `npm install`
3. Start command: `npm start`
4. Environment variables:
   - `PORT` — Render sets this automatically, no action needed
   - `CLIENT_ORIGIN` — e.g. `https://space-saboteurs.vercel.app` (comma-separate multiple origins if needed, e.g. include `http://localhost:3000` while testing)
5. Deploy. Note the resulting URL, e.g. `https://space-saboteurs-server.onrender.com`.

### 2. Frontend — Vercel

1. New Project → point at this repo, root directory `client`.
2. Framework preset: "Other" (static site).
3. Build command: `npm run build`
4. Output directory: `.`
5. Environment variable: `NEXT_PUBLIC_GAME_SERVER_URL` = your backend URL from step 1 (e.g. `https://space-saboteurs-server.onrender.com`).
6. Deploy.

`scripts/generate-env.js` runs during the Vercel build and bakes
`NEXT_PUBLIC_GAME_SERVER_URL` into `env.js`, which `index.html` loads
before `main.js`. No localhost is ever hardcoded into the production
build.

### 3. Production test

With both deployed:
- Open the Vercel URL on two different computers/networks.
- Repeat the two-browser test above end-to-end.
- Confirm the debug panel (F3) shows `SERVER: ONLINE` and a reasonable ping.

## Exact commands reference

```
# Backend
cd server
npm install
npm run dev            # local dev, nodemon
npm start               # production start (what Render/Railway run)

# Frontend
cd client
npm install
npm run dev             # generates env.js, serves on :3000
npm run build            # what Vercel runs: generates env.js from NEXT_PUBLIC_GAME_SERVER_URL
```

Configure these where noted above:
- `NEXT_PUBLIC_GAME_SERVER_URL` → Vercel project → Environment Variables
- `CLIENT_ORIGIN` → Render/Railway/Fly → Environment Variables
- `PORT` → set automatically by your hosting platform; defaults to 3001 locally
