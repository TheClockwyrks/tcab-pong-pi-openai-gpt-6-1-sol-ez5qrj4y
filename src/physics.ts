import * as C from "./constants";
import type { BallState, ObstacleState, PaddleState, StateView } from "./game";
import { clamp } from "./world";

type MovingBall = { -readonly [K in keyof BallState]: BallState[K] };
export interface FlightResult {
  ball: BallState;
  cues: ReadonlySet<C.CueName>;
}

function paddleContact(
  b: MovingBall,
  paddle: PaddleState,
  left: boolean,
  cues: Set<C.CueName>,
): void {
  const x0 = left ? C.P1_X0 : C.P2_X0;
  const x1 = left ? C.P1_X1 : C.P2_X1;
  const y0 = paddle.cy - C.PADDLE_HALF,
    y1 = paddle.cy + C.PADDLE_HALF;
  if (
    b.x <= x0 - C.BALL_R ||
    b.x >= x1 + C.BALL_R ||
    b.y <= y0 - C.BALL_R ||
    b.y >= y1 + C.BALL_R
  )
    return;
  const depths = [
    b.x - (x0 - C.BALL_R),
    x1 + C.BALL_R - b.x,
    b.y - (y0 - C.BALL_R),
    y1 + C.BALL_R - b.y,
  ];
  const face = depths.indexOf(Math.min(...depths));
  if (face >= 2) {
    b.y = face === 2 ? y0 - C.BALL_R : y1 + C.BALL_R;
    if ((face === 2 && b.vy > 0) || (face === 3 && b.vy < 0)) {
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    }
    return;
  }
  const theta =
    clamp((b.y - paddle.cy) / C.PADDLE_HALF, -1, 1) * C.MAX_BOUNCE_ANGLE;
  const speed = Math.min(Math.hypot(b.vx, b.vy) * C.SPEED_MULT, C.SPEED_CAP);
  b.vx = (left ? 1 : -1) * speed * Math.cos(theta);
  b.vy = speed * Math.sin(theta);
  b.spin = clamp(
    b.spin + paddle.vy * C.SPIN_FROM_PADDLE,
    -C.SPIN_CLAMP,
    C.SPIN_CLAMP,
  );
  b.x = left ? C.P1_X1 + C.BALL_R : C.P2_X0 - C.BALL_R;
  cues.add(C.CUES.paddleHit);
}

function obstacleContact(
  b: MovingBall,
  o: ObstacleState,
  cues: Set<C.CueName>,
): void {
  const c = Math.cos(o.theta),
    s = Math.sin(o.theta);
  const dx = b.x - o.cx,
    dy = b.y - o.cy;
  const lx = dx * c + dy * s,
    ly = -dx * s + dy * c;
  const qx = clamp(lx, -C.OBSTACLE_HW, C.OBSTACLE_HW),
    qy = clamp(ly, -C.OBSTACLE_HH, C.OBSTACLE_HH);
  const ex = lx - qx,
    ey = ly - qy;
  const dist = Math.hypot(ex, ey);
  if (dist >= C.BALL_R) return;
  let nx: number, ny: number, push: number;
  if (dist > 0) {
    nx = ex / dist;
    ny = ey / dist;
    push = C.BALL_R - dist;
  } else {
    const px = C.OBSTACLE_HW - Math.abs(lx),
      py = C.OBSTACLE_HH - Math.abs(ly);
    nx = px <= py ? (lx >= 0 ? 1 : -1) : 0;
    ny = px <= py ? 0 : ly >= 0 ? 1 : -1;
    push = C.BALL_R + Math.min(px, py);
  }
  const wx = nx * c - ny * s,
    wy = nx * s + ny * c;
  const dot = b.vx * wx + b.vy * wy;
  if (dot < 0) {
    b.vx -= 2 * dot * wx;
    b.vy -= 2 * dot * wy;
    cues.add(C.CUES.obstacleBounce);
  }
  b.x += wx * push;
  b.y += wy * push;
}

/** A frame-local working copy; never writes through to the engine's state. */
export function fly(s: StateView, ball: BallState, dt: number): FlightResult {
  const b: MovingBall = { ...ball };
  const cues = new Set<C.CueName>();
  const n = Math.max(
    1,
    Math.ceil((Math.hypot(b.vx, b.vy) * dt) / C.MAX_SUBSTEP),
  );
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 0) {
      const angle = (b.spin / speed) * h,
        c = Math.cos(angle),
        sin = Math.sin(angle);
      const vx = b.vx * c - b.vy * sin;
      b.vy = b.vx * sin + b.vy * c;
      b.vx = vx;
    }
    b.spin *= Math.pow(0.5, h / C.SPIN_HALFLIFE);
    b.x += b.vx * h;
    b.y += b.vy * h;
    if (b.y - C.BALL_R < 0 && b.vy < 0) {
      b.y = C.BALL_R;
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    } else if (b.y + C.BALL_R > C.FIELD_H && b.vy > 0) {
      b.y = C.FIELD_H - C.BALL_R;
      b.vy = -b.vy;
      cues.add(C.CUES.wallBounce);
    }
    paddleContact(b, s.paddles.left, true, cues);
    paddleContact(b, s.paddles.right, false, cues);
    for (const obstacle of s.obstacles) obstacleContact(b, obstacle, cues);
  }
  return { ball: b, cues };
}
