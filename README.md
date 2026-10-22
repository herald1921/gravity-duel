# Gravity Duel

**Play online:** [v0.10 campaign](https://herald1921.github.io/gravity-duel/) · [previous v0.9 playtest](https://herald1921.github.io/gravity-duel/legacy-v0.9/)

Gravity Duel is a browser arcade game built with Phaser and TypeScript. Move through compact orbital arenas, aim independently, and bend projectiles around planets to defeat an AI rival.

This repository contains the `v0.10.0` campaign playtest: 27 levels across three units, increasingly skilled AI, and up to three simultaneous enemies. The previous source is preserved by the `v0.9.0-playtest` tag; its original web build and standalone HTML are also retained.

## Campaign

- **Planets & moons:** no ship gravity; guidance, shield, heavy, laser, homing and orbital pickups are introduced in the first six levels.
- **Stellar systems:** lethal stars, neutron-star interference, binary/triple systems and portals. Ships still ignore gravity.
- **Event horizons:** black holes and portal networks; all celestial bodies now exert a capped gravitational pull on ships.

Each unit starts with six static arenas, adds moving bodies in level 7, then two and three enemies in levels 8 and 9. Clear every enemy to score one point; first to three wins the campaign level. Enemy teams do not damage their teammates, but returning shots can still hit their owner. Campaign levels unlock sequentially. **CAMPAIGN → PRACTICE ALL** opens every level without advancing the campaign save.

Reaction time decreases from 1.35 to 0.32 seconds, angular error from ±11 to ±1.4 degrees, and minimum firing interval from 3.8 to 1.15 seconds. Pickup seeking, bounded velocity prediction, projectile avoidance, squad separation and independent movement/aiming unlock gradually. Enemies use the same trajectory simulation as players, and squad shots are spaced by at least 0.4 seconds.

Trajectory previews are automatic in flight school and otherwise require a 12-second GUIDANCE pickup. It coexists with shields and special ammo. Homing guidance is reduced to 3.6 seconds with slower turning; orbital rounds last up to 48 seconds, unless intercepted, replaced or destroyed. The mouse crosshair has been removed.

The new campaign uses a separate save key. Audio, controls, tutorial completion, badges and paint carry over from v0.9; old arena completion does not unlock unrelated campaign levels, and the old save stays intact.

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

Automated checks cover the existing physics and platform behavior plus campaign sequencing, safe moving-body spawns, gravity modes, pickup duration, squad scoring, teammate immunity, AI progression, firing in all 27 levels, and save migration. Browser checks cover the campaign selector, first-level guidance pickup, combat and pause. Physical-phone multitouch, long-duration performance and human difficulty balance still need real-device playtesting.

## Project layout

- `src/`: game and platform source
- `tests/`: logic and regression tests
- `assets/`: editable/local source assets
- `public/`: files copied into the web build
- `web-v0.10.0/`: current ready-to-serve build, including the previous build under `legacy-v0.9/`
- `web-v0.9.0/`: preserved previous web build
- `Play-Gravity-Duel.html`: standalone offline playtest
- `Play-Gravity-Duel-v0.9.0.html`: preserved previous offline playtest
- `PLAYTEST-v0.10.0.txt`: current playtest notes

The CrazyGames integration can be built with `npm run build:crazygames`. This playtest has not been submitted to CrazyGames.
