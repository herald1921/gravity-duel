# Gravity Duel

**Play online:** [v0.11.0 campaign](https://herald1921.github.io/gravity-duel/) · [previous v0.10.1](https://herald1921.github.io/gravity-duel/legacy-v0.10.1/) · [v0.10](https://herald1921.github.io/gravity-duel/legacy-v0.10/) · [v0.9](https://herald1921.github.io/gravity-duel/legacy-v0.9/)

Gravity Duel is a browser arcade game built with Phaser and TypeScript. Move through compact orbital arenas, aim independently, and bend projectiles around planets to defeat an AI rival.

This repository contains the `v0.11.0` campaign playtest: 27 distinct arenas across units of 6, 9 and 12 levels. Each unit ends with a three-way free-for-all followed by a harder two-AI squad battle. Previous source tags, web builds and standalone HTML files are retained. Completed levels migrate by their retained identity; new combinations remain uncleared, and old saves are untouched.

## v0.11.0 changes

- **Distinct arenas:** handcrafted body arrangements, moving systems, pickup sites and wormhole routes replace repeated layouts. The selector previews each arena and describes its tactical layout. Unit three adds separate well/moon systems, a black-hole/neutron binary and two wormhole pairs.
- **Pressure fire:** each pilot prepares independently, and the squad selects only pilots whose firing gates are ready. A pilot still waiting for its interval can no longer block its partner. Pressure pilots prefer clear firing lanes, relocate when blocked and allow bounded near-miss cannon shots. Existing difficulty, reload, warning and 0.4-second squad spacing remain.
- **Three-way battles:** in 1-5, 2-8 and 3-11 the player and two AI pilots have separate scores and no alliances. AI target selection and homing locks can choose other AI. All weapons can hit rivals. Last survivor scores; the first to three points wins. If the player is eliminated first, AI continue the round while the player spectates. 1-6, 2-9 and 3-12 retain coordinated enemy squads.
- **Wormholes:** introduced only in unit three, from 3-2. Dark throats, receding light rings, spiral streams and a lens rim replace the flat gate symbols. The second pair in 3-10 uses warm colors to distinguish its connection. Ships and projectiles cross; lasers do not.
- **System motion:** binary stars, star/neutron companions and paired black holes now orbit a common mass-balanced center instead of tracing unrelated identical circles. The solar-family level has a moon orbiting its moving planet; the triple-star level uses an inner binary and a wider companion orbit. Position, velocity, collision, AI prediction and rendering share the same analytical paths. These are prescribed game orbits, not a full N-body simulation. Faint rings show celestial orbits; weapon guides still require a pickup.
- **Neutron stars:** introduced in 2-3, reinforced in 2-6, and orbiting a star in 2-8. Level cards and in-world labels explicitly identify them. Their bright compact cores, magnetic rings and rotating beams distinguish them from planets. Beams reduce thrust/turn; touching the core is lethal.

## Campaign

- **Planets & moons (6 levels):** only planets and moons; no ship gravity. The first three static levels introduce guidance/shield, heavy/laser and homing/orbital. Level 4 adds moving bodies.
- **Stellar systems (9 levels):** lethal stars, neutron-star interference and binary/triple systems. No wormholes; ships still ignore gravity. The first six arenas are static, level 7 introduces a moving solar family.
- **Event horizons (12 levels):** black holes, wormholes and a capped gravitational pull on ships from all bodies. Six static arenas introduce the mechanics; levels 7–10 explore distinct moving combinations.

Every unit's penultimate level is a three-way battle and its final level is a coordinated two-AI squad. In squad battles, clear both enemies to score; enemy teammates cannot damage each other. In free-for-all, every rival is a valid target and the last survivor scores. Returning shots can hit their owner in either mode. Campaign levels unlock sequentially. **CAMPAIGN → PRACTICE ALL** opens every level without advancing the campaign save.

Reaction time decreases from 1.35 to 0.32 seconds, angular error from ±11 to ±1.4 degrees, and minimum firing interval from 3.8 to 1.15 seconds. Pickup seeking, bounded velocity prediction, projectile avoidance, squad separation and independent movement/aiming unlock gradually. Enemies use the same trajectory simulation as players, and squad shots are spaced by at least 0.4 seconds.

Trajectory previews are automatic in flight school and otherwise require a 12-second GUIDANCE pickup. It coexists with shields and special ammo. Homing guidance is reduced to 3.6 seconds with slower turning; orbital rounds last up to 48 seconds, unless intercepted, replaced or destroyed. The mouse crosshair has been removed.

The new campaign uses a separate save key. Audio, controls, tutorial completion, badges and paint carry over. v0.10 campaign completion maps to retained level identities; the three new unit-three combinations do not inherit completion. Migration from v0.9 carries settings and cosmetics only. All old saves stay intact.

## Play locally

The quickest option on Windows is to open `Play-Gravity-Duel.html` or double-click `Start-Playtest.cmd`. The single-file build embeds the game, music, and AI worker and does not require a local server.

For development:

```bash
npm install
npm run dev
```

Default controls:

- `WASD`: move in screen space
- Mouse: aim
- Left mouse button or `Space`: fire
- `P` or `Esc`: pause
- `R`: restart the arena

Touch devices use separate movement and aim/fire sticks. Classic thrust-and-turn controls can be selected from the main menu.

## Validate and build

```bash
npm test
npm run build
npm run build:offline
```

Automated checks cover physics/platform behavior, distinct layouts, 6/9/12 progression, safe moving-body and touch spawns, wormhole exits, paired pickup lessons, three independent scores, all-weapon AI-versus-AI damage, target switching, asynchronous aim invalidation, prepared-shooter arbitration, squad spacing, firing in all 27 levels and save migration. Browser checks cover the selector, free-for-all and wormhole combat. Physical-phone multitouch, long-duration performance and human difficulty balance still need real-device playtesting.

## Project layout

- `src/`: game and platform source
- `tests/`: logic and regression tests
- `assets/`: editable/local source assets
- `public/`: files copied into the web build
- `web-v0.11.0/`: current ready-to-serve build, with prior versions under `legacy-v0.10.1/`, `legacy-v0.10/` and `legacy-v0.9/`
- `web-v0.10.1/`: preserved previous squad/trajectory build
- `web-v0.10.0/`: preserved previous campaign build
- `web-v0.9.0/`: preserved previous web build
- `Play-Gravity-Duel.html`: standalone offline playtest
- `Play-Gravity-Duel-v0.9.0.html`: preserved previous offline playtest
- `Play-Gravity-Duel-v0.10.0.html`: preserved previous offline campaign
- `Play-Gravity-Duel-v0.10.1.html`: preserved previous offline patch
- `PLAYTEST-v0.11.0.txt`: current patch notes

The CrazyGames integration can be built with `npm run build:crazygames`. This playtest has not been submitted to CrazyGames.
