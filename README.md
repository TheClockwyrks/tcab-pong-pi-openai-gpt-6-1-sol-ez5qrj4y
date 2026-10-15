# Carom

**Move. Curve. Outthink.** A top-down paddle duel about spin and bank shots,
played entirely in your browser. Face the machine in Solo or share a keyboard in
local Versus. Two golden obstacles sway and rotate through the court: use their
changing angles to slip a shot past your opponent.

Moving your paddle at contact adds spin to the ball. Edge hits change the launch
angle, each paddle hit adds speed, and the curve gradually fades. First to **11**
wins, with a **two-point lead** required.

## Run locally

Use a current Node.js release supported by Vite (Node 22.12+ recommended).

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. No accounts, services, runtime downloads, or
API keys are needed. All graphics are drawn on the canvas and all four sounds
are synthesized by the Simple 2D engine.

## Production

```sh
npm ci
npm run build
```

Serve **`dist/`** as the root of any static site. `dist/index.html` is the entry
point; no additional build or setup step is needed. To inspect the build locally:

```sh
npm run preview
```

## Controls

| Control | Action |
| --- | --- |
| **W / S** | Move the left paddle up / down |
| **↑ / ↓** | Move the right paddle in Versus; also move the left paddle in Solo |
| **W / S** or **↑ / ↓** in menus | Change selection |
| **Enter / Space** | Confirm the selected item |
| **P / Escape** | Pause or resume a match |
| **Escape** | Return from instructions or match results |
| **M** | Toggle sound on every screen |
| **Backtick** | Toggle the engine's diagnostic overlay |

Menus also support mouse and touch: select and release inside the same item to
activate it. Touching the screen reveals the engine's two side sliders and menu
buttons. Sound unlocks on the first gesture, and the game is fully playable muted.

The pause menu offers resume, restart, and quit. The title remembers your last
confirmed mode or instructions selection. Nothing is persisted between sessions.

## Development and tests

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

Tests run the engine in Node over a native canvas and counted clocks, without a
browser. They cover the immutable state transitions, debug poses, menus,
keyboard and pointer arbitration, AI, serving, spin, oriented collisions,
scoring, win-by-two, frame-size agreement, and drawing/recording.

### Source map

- `src/game.ts` — public state/debug contracts and engine initialization.
- `src/world.ts` — initial state, parking, match resets, and obstacle poses.
- `src/simulation.ts` — frame transitions, paddle integration, serves, and scoring.
- `src/physics.ts` — sub-stepped flight and collision resolution.
- `src/menus.ts` — shared menu geometry and input arbitration.
- `src/view.ts` — canvas-only presentation.
- `src/debug.ts` — stateless poses and detached snapshots, reached through
  `engine.debug`, never a page global.

The supplied `src/constants.ts`, entry point, and Simple 2D runtime remain
unchanged. The runtime owns fitting, timing, input, audio, diagnostics, and draw
recording. Simulation has no dependency on the renderer.

## Showcase

[`showcase/showcase.md`](showcase/showcase.md) introduces the game to players.
The adjacent carousel includes three Chromium screenshots and a six-second,
360-frame engine draw-command recording (`rally.json.gz`). The recording shows
real spin and collisions; the left paddle is driven through the debug surface
while the normal Solo AI defends the right.
