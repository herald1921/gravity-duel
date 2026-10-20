# Gravity Duel

Gravity Duel is a browser arcade game built with Phaser and TypeScript. Move through compact orbital arenas, aim independently, and bend projectiles around planets to defeat an AI rival.

This repository contains the `v0.9.0` phase-one playtest. The update focuses on clearer art, easier controls, and a faster combat rhythm while preserving the nine existing arenas, special weapons, badges, ship paints, local multiplayer, and the classic control scheme.

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

The current playtest passes 124 automated logic tests. Browser checks cover the tutorial, combat, pause flow, classic controls, small-screen menus, and simulated dual-stick input. Physical-phone multitouch and long-duration performance still need real-device playtesting.

## Project layout

- `src/`: game and platform source
- `tests/`: logic and regression tests
- `assets/`: editable/local source assets
- `public/`: files copied into the web build
- `web-v0.9.0/`: ready-to-serve playtest build
- `Play-Gravity-Duel.html`: standalone offline playtest
- `PLAYTEST-v0.9.0.txt`: detailed playtest notes

The CrazyGames integration can be built with `npm run build:crazygames`. This playtest has not been submitted to CrazyGames.
