import type { UpdateApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type {
  BallState,
  CaromState,
  PaddleState,
  Side,
  StateView,
} from "./game";
import { readInput } from "./menus";
import { fly } from "./physics";
import { clamp, obstaclePose, parkedBall } from "./world";

function movePaddle(
  s: StateView,
  side: Side,
  api: UpdateApi,
  dt: number,
): PaddleState {
  const p = s.paddles[side];
  let vy = p.drivenVy;
  if (!p.driven) {
    if (side === "right" && s.mode === "solo") {
      let target = C.AI_HOME_Y,
        deadzone = C.AI_HOME_DEADZONE;
      if (s.ai.tracking && s.screen === "playing" && s.ball && s.ball.vx > 0) {
        target = s.ball.y - s.ball.vy * C.AI_REACT;
        deadzone = C.AI_DEADZONE;
      }
      const diff = target - p.cy;
      vy =
        !s.ai.movement || Math.abs(diff) <= deadzone || dt <= 0
          ? 0
          : Math.sign(diff) * Math.min(C.AI_SPEED, Math.abs(diff) / dt);
    } else {
      const prefix = side === "left" ? "p1" : "p2";
      let up = api.input.value(`${prefix}-up`) > 0,
        down = api.input.value(`${prefix}-down`) > 0;
      if (s.mode === "solo") {
        up = up || api.input.value("p2-up") > 0;
        down = down || api.input.value("p2-down") > 0;
      }
      vy = (Number(down) - Number(up)) * C.PADDLE_SPEED;
    }
  }
  const raw = p.cy + vy * dt;
  const cy = clamp(raw, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  if (cy !== raw && dt > 0) vy = (cy - p.cy) / dt;
  return { ...p, cy, vy };
}

function serve(s: StateView, ball: BallState): BallState {
  return {
    ...ball,
    held: false,
    holdTimer: 0,
    trail: [],
    vx:
      (s.receiver === "left" ? -1 : 1) *
      C.SERVE_SPEED *
      Math.cos(C.SERVE_ANGLE),
    vy: ball.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
  };
}

export function update(
  state: StateView,
  api: UpdateApi,
  dt: number,
): CaromState {
  let s = readInput(state, api);
  s = { ...s, simTime: state.simTime + dt };
  if (s.screen !== "playing" && s.screen !== "countdown") return s;
  s = {
    ...s,
    paddles: {
      left: movePaddle(s, "left", api, dt),
      right: movePaddle(s, "right", api, dt),
    },
  };
  let ball = s.ball;
  if (ball) {
    if (ball.held) {
      ball = { ...ball, holdTimer: ball.holdTimer - dt };
      if (ball.holdTimer <= 0) {
        ball = serve(s, ball);
        s = { ...s, screen: "playing" };
      }
    } else if (s.screen === "playing") {
      const result = fly(s, ball, dt);
      ball = result.ball;
      for (const cue of result.cues) api.audio.play(cue);
    }
    ball = {
      ...ball,
      trail: [
        ...ball.trail.filter((p) => s.simTime - p.t <= C.TRAIL_TIME),
        { x: ball.x, y: ball.y, t: s.simTime },
      ],
    };
  }
  const clock = s.obstacleClock + (s.obstacleClockRunning ? dt : 0);
  s = {
    ...s,
    ball,
    obstacleClock: clock,
    obstacles: s.obstacles.map((o) => obstaclePose(o.index, clock)),
  };
  if (
    s.screen === "playing" &&
    ball &&
    (ball.x - C.BALL_R > C.FIELD_W || ball.x + C.BALL_R < 0)
  ) {
    const left = ball.x > C.FIELD_W;
    const score = {
      p1: s.score.p1 + Number(left),
      p2: s.score.p2 + Number(!left),
    };
    api.audio.play(C.CUES.score);
    const won =
      Math.max(score.p1, score.p2) >= C.WIN_SCORE &&
      Math.abs(score.p1 - score.p2) >= C.WIN_LEAD;
    s = won
      ? {
          ...s,
          score,
          winner: left ? "left" : "right",
          screen: "matchover",
          menuIndex: 0,
          menuPresses: {},
        }
      : {
          ...s,
          score,
          receiver: left ? "right" : "left",
          screen: "countdown",
          ball: parkedBall(),
        };
  }
  return s;
}
