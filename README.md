# Gravity Duel — v0.12.0 playtest

Play: https://herald1921.github.io/gravity-duel/
Previous release: https://herald1921.github.io/gravity-duel/legacy-v0.11.1/

## Campaign and controls

30 different arenas in **7 / 10 / 13** levels. The original 27 maps remain; each unit receives an additional, distinct boss arena. The last three levels of each unit are four-way free-for-all, **one player versus two coordinated AI**, then the new boss. Bosses are exclusive to solo play. No weapon upgrades.

- Unit 1: planets and moons only; no ship gravity. The first three static lessons introduce all six pickups, then motion begins. Four-way FFA is 1-5, squad is 1-6, boss is 1-7.
- Unit 2: stars and neutron stars, followed by moving binary/triple and hierarchical systems; no wormholes or ship gravity. FFA 2-8, squad 2-9, boss 2-10.
- Unit 3: black holes and ship gravity; wormholes from 3-2. FFA 3-11, squad 3-12, boss 3-13.
- FFA: player plus three mutually hostile AI, first to four kills, 90-second limit, tied overtime. Killed pilots respawn after 1.8 seconds with protection that ends when they shoot. AI mutual kills never grant the player points.
- Bosses: four/six/eight-cannon patterns, visible warnings, locked aim before firing, recovery windows, 3/4/5 core health. Later bosses alternate lasers. Bosses ignore their own projectiles; normal pilots still risk returning fire. The player starts with a shield.
- AI: beginner ramp only in the first unit; later units retain full tactics. Movement candidates are projected through the same ship physics, moving-body collisions, gravity, neutron beams and wormholes used in live combat. Existing pickup strategies and coordinated squad pressure remain.
- Desktop: WASD movement, mouse aim, click/Space fire. P/Esc pause, R retry. Classic controls remain selectable on desktop.
- Phone: left stick moves, right stick aims; **release to shoot once**. Return the right stick to center before releasing to cancel. Touch cancellation, pause and focus loss clear pending fire. Guidance lines require the pickup outside flight school.
- Graphics: 2560×1440 render buffer with a fixed 1280×720 world and sharper text. Input is converted through the camera so scaling does not change aim or touch positions.

Campaign saves use `gravity-duel-campaign-v0120`. v0.11 completion migrates to the same original levels; added bosses start uncleared. Original saves are never overwritten. **CAMPAIGN → PRACTICE ALL** opens every arena without advancing campaign completion.

## Online multiplayer

**The client and server are implemented and locally tested. Public matchmaking is unavailable until a server is deployed and `public/online.json` is configured.** The lobby reports this explicitly; it does not pretend that bots are remote players.

The same WebSocket service supports computer and phone, random matching and friend room codes/invite links. At least two connected humans are needed; empty seats are AI. Up to four humans can join before starting. Two modes:

- Four-way free-for-all: two humans plus two AI (or three/four humans), kill scoring and respawns.
- 2 vs 2: P1 + P2 versus P3 + P4. With two humans, they cooperate against two AI. First team to three rounds; ally projectiles cannot hit teammates. Every original arena is available; no multiplayer bosses.

The server owns physics, collisions, pickups and scores; clients send bounded movement/aim/fire inputs only. State snapshots are rounded for transport and interpolated for display; projectile trails are reconstructed locally. Server AI uses a bounded coarse-to-fine angular search to limit shared CPU costs. Disconnected pilots become AI immediately, with a 30-second reconnection window. Inputs expire after 0.3 seconds. Leaving/pausing a client does not pause the shared match. The room creator starts rematches; a restarted server does not preserve in-memory rooms.

### Local development

Node 22 or later supported by Vite:

```sh
npm ci
npm run dev
# In a second terminal:
npm run build:server
npm run start:server
```

Open `http://127.0.0.1:5176/` in two browser tabs for a local online match. Local development automatically uses WebSocket port 8787. `Play-Gravity-Duel.html` embeds assets and the AI worker for solo offline use; public online configuration is intentionally not embedded.

### Public server deployment

The included `render.yaml` defines one **free** Render Node service with a health endpoint and one-room cap. No database, payment details, or secrets are required by the game. Render account creation and any terms acceptance must be completed by the account owner. Free service availability, sleep/wake latency and capacity remain hosting limitations, so this is a playtest deployment, not a production service promise.

1. Sign in to Render, create a Blueprint from `https://github.com/herald1921/gravity-duel`, and review `render.yaml`. Keep the free plan.
2. Wait for `/health` on the assigned HTTPS hostname to return version `0.12.0`.
3. Set `public/online.json` to `{"endpoint":"wss://YOUR-ASSIGNED-HOST.onrender.com"}` using the actual assigned hostname, then rebuild and publish the client.
4. Verify a friend room and a random match from two devices on different networks. No public online completion is claimed before that test.

`ALLOWED_ORIGINS` is restricted to the GitHub Pages origin in the deployment template. Add the actual platform iframe origin only when integrating a published CrazyGames build. CrazyGames hosts game files and provides invite/room SDK hooks, but developers provide the real-time multiplayer backend: https://docs.crazygames.com/faq/#do-you-provide-a-server-for-multiplayer-games . The online lobby currently uses its own share links; CrazyGames-specific invite integration remains a platform-release task.

A Dockerfile is also included for another Node-capable host. Never place service credentials in the client config or repository.

## Validation and releases

```sh
npm test
npm run test:server
npm run build
npm run build:offline
npm run build:crazygames
```

Tests cover the shared physics, all unique layouts and safe spawn routes, ordered mechanics, pickup tactics, coordinated firing, four-way scoring and respawns, additional bosses, team rules, save migration and touch release/cancel behavior. The server smoke test uses separate WebSocket clients to check friend/random rooms, authoritative state, input bounds and reconnection. Browser QA covers desktop and phone-size layouts and controls; physical-device multitouch, internet latency and extended human balance testing remain necessary.

- `src/`, `tests/`, `server/`: editable source, regression coverage and authoritative room service.
- `web-v0.12.0/`: current static build; previous releases under `legacy-*`.
- `web-v0.11.1/` and earlier version folders: preserved builds.
- `Play-Gravity-Duel.html`: current standalone solo build.
- `Play-Gravity-Duel-v0.11.1.html` and earlier version files: preserved standalone builds.
- Git tag `v0.11.1-playtest`: previous source snapshot.
- `qa/v0120-tests.txt`: latest automated regression report.

This version has not been submitted to CrazyGames.
