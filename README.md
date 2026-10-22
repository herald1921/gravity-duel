# Gravity Duel

**Play online:** [v0.10.1 campaign](https://herald1921.github.io/gravity-duel/) · [previous v0.10](https://herald1921.github.io/gravity-duel/legacy-v0.10/) · [original v0.9](https://herald1921.github.io/gravity-duel/legacy-v0.9/)

Gravity Duel is a browser arcade game built with Phaser and TypeScript. Move through compact orbital arenas, aim independently, and bend projectiles around planets to defeat an AI rival.

This repository contains the `v0.10.1` campaign playtest: 27 levels across three units, increasingly skilled AI, and up to three simultaneous enemies. Previous sources are preserved by the `v0.9.0-playtest` and `v0.10.0-playtest` tags; original web builds and standalone HTML files are also retained. This patch keeps v0.10 campaign progress.

## v0.10.1 corrections

- **Squad coordination:** a shared coordinator assigns pressure, flank and intercept roles, separate approach positions and exclusive pickup reservations. Pressure fire triggers partner advancement, firing priority rotates, and roles are reassigned after casualties. Roles are visible under enemy ships. A lone survivor returns to solo behavior.
- **System motion:** binary stars, star/neutron companions and paired black holes now orbit a common mass-balanced center instead of tracing unrelated identical circles. The solar-family level has a moon orbiting its moving planet; the triple-star level uses an inner binary and a wider companion orbit. Position, velocity, collision, AI prediction and rendering share the same analytical paths. These are prescribed game orbits, not a full N-body simulation. Faint rings show celestial orbits; weapon guides still require a pickup.
- **Neutron stars:** introduced in 2-3, reinforced in 2-6, and orbiting a star in 2-8. Level cards and in-world labels explicitly identify them. Their bright compact cores, magnetic rings and rotating beams distinguish them from planets. Beams reduce thrust/turn; touching the core is lethal.
- Small-star shading now scales with the star's radius, preventing invalid negative circles. Frozen body snapshots no longer accidentally apply motion twice.

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
- `web-v0.10.1/`: current ready-to-serve build, with previous builds under `legacy-v0.10/` and `legacy-v0.9/`
- `web-v0.10.0/`: preserved previous campaign build
- `web-v0.9.0/`: preserved previous web build
- `Play-Gravity-Duel.html`: standalone offline playtest
- `Play-Gravity-Duel-v0.9.0.html`: preserved previous offline playtest
- `Play-Gravity-Duel-v0.10.0.html`: preserved previous offline campaign
- `PLAYTEST-v0.10.1.txt`: current patch notes

The CrazyGames integration can be built with `npm run build:crazygames`. This playtest has not been submitted to CrazyGames.
