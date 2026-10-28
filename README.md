# Gravity Duel — v0.12.2 playtest

Play: https://herald1921.github.io/gravity-duel/
Previous release: https://herald1921.github.io/gravity-duel/legacy-v0.12.1/

## Campaign and controls

30 different arenas in **7 / 10 / 13** levels. The original 27 maps remain; each unit receives an additional, distinct boss arena. The last three levels of each unit are four-way free-for-all, **one player versus two coordinated AI**, then the new boss. Bosses are exclusive to solo play. No weapon upgrades.

- Unit 1: planets and moons only; no ship gravity. The first three static lessons introduce all six pickups, then motion begins. Four-way FFA is 1-5, squad is 1-6, boss is 1-7.
- Unit 2: stars and neutron stars, followed by moving binary/triple and hierarchical systems; no wormholes or ship gravity. FFA 2-8, squad 2-9, boss 2-10.
- Unit 3: black holes and ship gravity; wormholes from 3-2. FFA 3-11, squad 3-12, boss 3-13.
- FFA: four independent pilots; no respawns within a round. The last survivor earns one point, first to three round wins. A simultaneous total wipe is a draw with no points. Eliminated humans spectate until the next round. AI spreads pressure toward unattended opponents, avoids prolonged target fixation and avoids adding a third attacker when another rival is available. Humans and AI use identical targeting criteria; no participation requirement is imposed on the survivor. This reduces, but cannot eliminate, occasional wins without firing.
- Bosses: four/six/eight-cannon patterns, visible warnings, locked aim before firing, recovery windows, 3/4/5 core health. Later bosses alternate lasers. Bosses ignore their own projectiles; normal pilots still risk returning fire. The player starts with a shield.
- AI: beginner ramp only in the first unit; later units retain full tactics. Movement candidates are projected through the same ship physics, moving-body collisions, gravity, neutron beams and wormholes used in live combat. Existing pickup strategies and coordinated squad pressure remain.
- Desktop: WASD movement, mouse aim, click/Space fire. P/Esc pause, R retry. Classic controls remain selectable on desktop.
- Phone: left stick moves, right stick aims; **release to shoot once**. Return the right stick to center before releasing to cancel. Touch cancellation, pause and focus loss clear pending fire. Guidance lines require the pickup outside flight school.
- Graphics: 2560×1440 render buffer with a fixed 1280×720 world and sharper text. Input is converted through the camera so scaling does not change aim or touch positions.

Campaign saves use `gravity-duel-campaign-v0120`. v0.11 completion migrates to the same original levels; added bosses start uncleared. Original saves are never overwritten. **CAMPAIGN → PRACTICE ALL** opens every arena without advancing campaign completion.

## Online multiplayer

**The peer-hosted client and signaling server are deployed for public playtesting.** `public/online.json` points to `wss://gravity-duel-online.onrender.com`. Friend/random internet play and capacity validation are recorded separately below; a live health endpoint alone does not prove 1,000 stable matches.

The same WebSocket service supports computer and phone, random matching and friend room codes/invite links. At least two connected humans are needed; empty seats are AI. Up to four humans can join before starting. Two modes:

- Four-way free-for-all: two humans plus two AI (or three/four humans), last-survivor round scoring and no mid-round respawns.
- 2 vs 2: P1 + P2 versus P3 + P4. With two humans, they cooperate against two AI. First team to three rounds; ally projectiles cannot hit teammates. Every original arena is available; no multiplayer bosses.

A foreground player device hosts the complete physics, collisions, pickups, AI and scoring. Desktop devices are preferred. Guests send bounded controls over a reliable WebRTC data channel; the host sends state at 20 Hz on an unordered channel, with interpolation and reconstructed trails. AI retains the full trajectory search in a worker. Gameplay normally bypasses the server entirely. The server handles room codes, random matching, signaling, liveness and host election. No camera or microphone permission is used.

On host departure/backgrounding, a connected foreground player resumes the latest checkpoint, including scores, projectiles, weapon charge, pickup timers and progression within the match. AI planning restarts after takeover. There can be a brief pause and up to one snapshot interval of rollback. Missing/background pilots become AI; disconnected seats have a 30-second reconnect window. Input expires after 0.3 seconds. The world waits when a visible connected human has not reached the host; pause only disables local controls. Rematches reuse healthy direct connections. A service restart loses in-memory room codes.

Direct connectivity is not guaranteed on restrictive networks. At most two rooms can use the WebSocket relay fallback simultaneously, with a 32 MiB application-data allowance per UTC day (`RELAY_DAILY_MB`). The in-memory counter resets on service restart; this safeguard does not constitute a billing cap. Frame/TLS overhead, signaling and platform traffic are additional. After the allowance is exhausted, direct rooms still work and relay-dependent players are asked to try another network. Other affected rooms wait with a connection message. This is a deliberate free-tier limit, not evidence that all networks support 1,000 matches. Player-hosted scores are not cheat resistant; direct peers can learn each other's network addresses.

**Verified public signaling capacity (2026-10-28):** four standard GitHub runners jointly held **1,000 started rooms / 4,000 WebSocket connections for at least 600.6 seconds**, with **zero disconnects, retries or host migrations**, all 6,000 signaling packets delivered, and all seats retained. The existing free Render service used approximately **0.0213 CPU cores and 98 MiB RSS**. See `qa/signaling-1000-distributed-summary.json`, the four raw shard reports and [the completed test run](https://github.com/herald1921/gravity-duel/actions/runs/40688185259). Signaling ping p95 was 200–317 ms across runners; this is not peer-to-peer gameplay latency. Earlier failed tests are retained. The new run changed both the client keepalive and load-source arrangement, so it does not isolate the cause of the earlier failures.

**Capacity target: 1,000 simultaneous real matches. Not yet verified.** `server/benchmark-signaling.mjs` exercises 1,000 started rooms / 4,000 real WebSockets, realistic signaling and ongoing heartbeats, but does NOT execute 1,000 browsers or transmit their direct gameplay streams. Its JSON explicitly labels this distinction. The manually triggered `Public signaling capacity (not gameplay)` GitHub Actions workflow runs four independent test machines with 250 rooms each, requires an empty service before starting, and retains timestamped reports. It records every disconnect and recovery; its recovery criterion requires all rooms/seats to survive and each recovery to take no more than ten seconds. The successful run above had no disconnects. It never runs automatically on code pushes. Real distributed gameplay, low-end phones, restrictive-network relay demand, monthly traffic and long-duration public stability remain separate acceptance gates. The server-authoritative reference and CPU benchmark are preserved in `server/authoritative.mjs` and `server/benchmark.mjs`.

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

The included `render.yaml` defines one **free** Render Node service with a health endpoint, a 1,000-room admission cap and a two-room relay cap. The game itself needs no database or secrets. The account owner completed the card verification requested for this free instance. A card on file can enable charges for usage beyond included allowances. A free instance is not a guarantee of zero bills. Render account creation and any terms acceptance must be completed by the account owner. Free service availability, sleep/wake latency and capacity remain hosting limitations, so this is a playtest deployment, not a production service promise.

1. For a fresh deployment, sign in to Render, create a Blueprint from `https://github.com/herald1921/gravity-duel`, and review `render.yaml`. Keep the free plan.
2. Wait for `/health` on the assigned HTTPS hostname to return version `0.12.1`.
3. Set `public/online.json` to `{"endpoint":"wss://YOUR-ASSIGNED-HOST.onrender.com"}` using the actual assigned hostname, then rebuild and publish the client.
4. Verify a friend room and a random match from two devices on different networks. The local browser checks do not replace this cross-network acceptance test.

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

Tests cover the shared physics, all unique layouts and safe spawn routes, ordered mechanics, pickup tactics, coordinated firing, four-way elimination, draws, full-round resets and fair AI target rotation, additional bosses, team rules, save migration and touch release/cancel behavior. The server smoke test checks friend/random rooms, signaling isolation, host-only state relay, stale epoch rejection, relay limits and host migration. A separate reconnect-burst test verifies that 24 players can return simultaneously to six full rooms without retained seats blocking live-connection admission. Active clients send a small application keepalive every 20 seconds; gameplay remains peer-to-peer. Core continuation tests verify exact physics and pickup-state preservation after takeover; input tests reject invalid controls. Browser QA covers desktop and phone-size layouts and controls; physical-device multitouch, internet latency and extended human balance testing remain necessary.

- `src/`, `tests/`, `server/`: editable source, regression coverage and signaling service.
- `web-v0.12.2/`: current static build; previous releases under `legacy-*`.
- `web-v0.12.1/`, `web-v0.12.0/`, `web-v0.11.1/` and earlier version folders: preserved builds.
- `Play-Gravity-Duel.html`: current standalone solo build.
- `Play-Gravity-Duel-v0.12.1.html`, `Play-Gravity-Duel-v0.11.1.html` and earlier version files: preserved standalone builds.
- Git tag `v0.11.1-playtest`: previous source snapshot.
- `qa/v0122-tests.txt`: latest automated regression report.

This version has not been submitted to CrazyGames.

### v0.12.2 playtest update

Outer Space Loop by wipics (CC0) replaces the menu/combat music; provenance is in `assets/audio/README.txt` and the shipped third-party notices. Boss mechanics, maps and health are unchanged. Previous v0.12.1 remains playable at `legacy-v0.12.1/`. The signaling server needs no update for this client-side release.
