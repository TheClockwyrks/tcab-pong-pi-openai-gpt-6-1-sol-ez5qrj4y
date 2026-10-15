import * as C from "./constants";
import type {
  BallState,
  CaromDebugApi,
  CaromState,
  PaddleState,
  Side,
  StateView,
} from "./game";
import { drawSign, initialState, obstaclePose, parkedBall } from "./world";
import { menuItemRect } from "./menus";

function ballPatch(s: StateView, patch: Partial<BallState>): CaromState {
  if (!s.ball) throw new Error("No ball on the field");
  return { ...s, ball: { ...s.ball, ...patch } };
}
function paddlePatch(
  s: StateView,
  side: Side,
  patch: Partial<PaddleState>,
): CaromState {
  return {
    ...s,
    paddles: { ...s.paddles, [side]: { ...s.paddles[side], ...patch } },
  };
}

export function createDebug(): CaromDebugApi {
  return {
    version: C.CAROM_DEBUG_VERSION,
    clearWorld: (s) => ({ ...s, ball: null, obstacles: [] }),
    spawnBall: (s) => ({ ...s, ball: parkedBall() }),
    spawnObstacle(s, index) {
      const pose = obstaclePose(index, s.obstacleClock);
      return {
        ...s,
        obstacles: [...s.obstacles.filter((o) => o.index !== index), pose].sort(
          (a, b) => a.index - b.index,
        ),
      };
    },
    reset: (s) => initialState(s.muted),
    reconcile: (s) => ({
      ...s,
      obstacles: s.obstacles.map((o) => obstaclePose(o.index, s.obstacleClock)),
    }),
    setScreen: (s, screen) => ({ ...s, screen }),
    setMode: (s, mode) => ({ ...s, mode }),
    setMenuIndex: (s, menuIndex) => ({ ...s, menuIndex }),
    setTitleIndex: (s, titleIndex) => ({ ...s, titleIndex }),
    setResumeScreen: (s, resumeScreen) => ({ ...s, resumeScreen }),
    setScore: (s, p1, p2) => ({ ...s, score: { p1, p2 } }),
    setWinner: (s, winner) => ({ ...s, winner }),
    setReceiver: (s, receiver) => ({ ...s, receiver }),
    setPaddleCy: (s, side, cy) => paddlePatch(s, side, { cy }),
    setPaddleVy: (s, side, drivenVy) => paddlePatch(s, side, { drivenVy }),
    setPaddleDriven: (s, side, driven) => paddlePatch(s, side, { driven }),
    setBallPosition: (s, x, y) => ballPatch(s, { x, y }),
    setBallVelocity: (s, vx, vy) => ballPatch(s, { vx, vy }),
    setBallSpin: (s, spin) => ballPatch(s, { spin }),
    setBallHeld: (s, held) => ballPatch(s, { held }),
    setBallHoldTimer: (s, holdTimer) => ballPatch(s, { holdTimer }),
    setBallServeSign: (s, serveSign) => ballPatch(s, { serveSign }),
    drawBallServeSign: (s) => ballPatch(s, { serveSign: drawSign() }),
    setAiTracking: (s, tracking) => ({ ...s, ai: { ...s.ai, tracking } }),
    setAiMovement: (s, movement) => ({ ...s, ai: { ...s.ai, movement } }),
    setMuted: (s, muted) => ({ ...s, muted }),
    setObstacleClock: (s, obstacleClock) => ({
      ...s,
      obstacleClock,
      obstacles: s.obstacles.map((o) => obstaclePose(o.index, obstacleClock)),
    }),
    setObstacleClockRunning: (s, obstacleClockRunning) => ({
      ...s,
      obstacleClockRunning,
    }),
    snapshot(s) {
      const { menuPresses: _menuPresses, ...world } = structuredClone(s);
      return {
        ...world,
        version: C.CAROM_DEBUG_VERSION,
        ball: world.ball
          ? { ...world.ball, speed: Math.hypot(world.ball.vx, world.ball.vy) }
          : null,
      };
    },
    menuItemRect,
  };
}
