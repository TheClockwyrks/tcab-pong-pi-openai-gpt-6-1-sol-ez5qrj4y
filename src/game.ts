import type { Game } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";
import { initialState } from "./world";
import { createDebug } from "./debug";
import { update } from "./simulation";
import { render } from "./view";

export const BACKGROUND = "#091519";

export type Screen =
  "title" | "howto" | "countdown" | "playing" | "paused" | "matchover";

export type Mode = "solo" | "versus";

export type Side = "left" | "right";

export interface PaddleState {
  readonly cy: number;
  readonly vy: number;
  readonly driven: boolean;
  readonly drivenVy: number;
}

export interface AiState {
  readonly tracking: boolean;
  readonly movement: boolean;
}

export interface TrailSample {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}

export interface BallState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly spin: number;
  readonly held: boolean;
  readonly holdTimer: number;
  readonly serveSign: 1 | -1;
  readonly trail: readonly TrailSample[];
}

export interface ObstacleState {
  readonly index: number;
  readonly cx: number;
  readonly cy: number;
  readonly theta: number;
}

export interface CaromState {
  readonly screen: Screen;
  readonly mode: Mode;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly resumeScreen: "countdown" | "playing";

  readonly score: { readonly p1: number; readonly p2: number };
  readonly winner: Side | null;

  readonly paddles: { readonly left: PaddleState; readonly right: PaddleState };
  readonly ai: AiState;

  readonly receiver: Side;
  readonly ball: BallState | null;
  readonly obstacles: readonly ObstacleState[];
  readonly obstacleClock: number;
  readonly obstacleClockRunning: boolean;

  readonly simTime: number;
  readonly muted: boolean;

  /** Input bookkeeping only: menu regions in which active contacts began. */
  readonly menuPresses: Readonly<Record<number, number>>;
}

export type StateView = DeepReadonly<CaromState>;
export interface MenuRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type CaromSnapshot = Omit<CaromState, "menuPresses" | "ball"> & {
  readonly version: number;
  readonly ball: (BallState & { readonly speed: number }) | null;
};

export interface CaromDebugApi {
  readonly version: number;
  clearWorld(s: StateView): CaromState;
  spawnBall(s: StateView): CaromState;
  spawnObstacle(s: StateView, index: number): CaromState;
  reset(s: StateView): CaromState;
  reconcile(s: StateView): CaromState;
  setScreen(s: StateView, screen: Screen): CaromState;
  setMode(s: StateView, mode: Mode): CaromState;
  setMenuIndex(s: StateView, index: number): CaromState;
  setTitleIndex(s: StateView, index: number): CaromState;
  setResumeScreen(s: StateView, screen: "countdown" | "playing"): CaromState;
  setScore(s: StateView, p1: number, p2: number): CaromState;
  setWinner(s: StateView, side: Side | null): CaromState;
  setReceiver(s: StateView, side: Side): CaromState;
  setPaddleCy(s: StateView, side: Side, cy: number): CaromState;
  setPaddleVy(s: StateView, side: Side, vy: number): CaromState;
  setPaddleDriven(s: StateView, side: Side, driven: boolean): CaromState;
  setBallPosition(s: StateView, x: number, y: number): CaromState;
  setBallVelocity(s: StateView, vx: number, vy: number): CaromState;
  setBallSpin(s: StateView, spin: number): CaromState;
  setBallHeld(s: StateView, held: boolean): CaromState;
  setBallHoldTimer(s: StateView, seconds: number): CaromState;
  setBallServeSign(s: StateView, sign: 1 | -1): CaromState;
  drawBallServeSign(s: StateView): CaromState;
  setAiTracking(s: StateView, enabled: boolean): CaromState;
  setAiMovement(s: StateView, enabled: boolean): CaromState;
  setMuted(s: StateView, muted: boolean): CaromState;
  setObstacleClock(s: StateView, t: number): CaromState;
  setObstacleClockRunning(s: StateView, running: boolean): CaromState;
  snapshot(s: StateView): CaromSnapshot;
  menuItemRect(s: StateView, index: number): MenuRect | null;
}

export const game: Game<CaromState, CaromDebugApi> = {
  initialize(api) {
    for (const name of C.ACTIONS)
      api.input.register(name, { keys: [...C.BINDINGS[name]] });
    api.audio.define(C.CUES.paddleHit, {
      wave: "triangle",
      freq: 620,
      freqTo: 320,
      durationMs: 75,
      gain: 0.18,
    });
    api.audio.define(C.CUES.wallBounce, {
      freq: 260,
      freqTo: 180,
      durationMs: 45,
      gain: 0.12,
    });
    api.audio.define(C.CUES.obstacleBounce, {
      wave: "square",
      freq: 880,
      freqTo: 440,
      durationMs: 55,
      gain: 0.07,
    });
    api.audio.define(C.CUES.score, {
      wave: "triangle",
      freq: 330,
      freqTo: 990,
      durationMs: 230,
      gain: 0.2,
    });
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("mode", (s) => s.mode);
    api.diagnostics.register("score", (s) => `${s.score.p1} : ${s.score.p2}`);
    for (const side of ["left", "right"] as const) {
      api.diagnostics.register(
        `${side} cy / vy`,
        (s) =>
          `${s.paddles[side].cy.toFixed(1)} / ${s.paddles[side].vy.toFixed(1)}`,
      );
    }
    api.diagnostics.register("ball position", (s) =>
      s.ball ? `${s.ball.x.toFixed(1)}, ${s.ball.y.toFixed(1)}` : "none",
    );
    api.diagnostics.register("ball velocity", (s) =>
      s.ball ? `${s.ball.vx.toFixed(1)}, ${s.ball.vy.toFixed(1)}` : "none",
    );
    api.diagnostics.register("ball speed", (s) =>
      s.ball ? Math.hypot(s.ball.vx, s.ball.vy) : "none",
    );
    api.diagnostics.register("ball spin", (s) => s.ball?.spin ?? "none");
    return [initialState(), createDebug()];
  },
  update,
  render,
};
