import { afterEach, describe, expect, it, vi } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { ConstantClock, createEngine } from "@clockwyrks/simple-2d";
import type { Engine } from "@clockwyrks/simple-2d";
import { game, BACKGROUND } from "./game";
import type { CaromState, CaromDebugApi, StateView } from "./game";
import * as C from "./constants";
import { obstaclePose } from "./world";

const engines: Engine<CaromState, CaromDebugApi>[] = [];
afterEach(() => {
  engines.splice(0).forEach((e) => e.destroy());
  vi.restoreAllMocks();
});

async function harness(ms = 10, draw = false) {
  const canvas = createCanvas(C.FIELD_W, C.FIELD_H);
  const events = new EventTarget();
  const engine = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: C.FIELD_W,
    height: C.FIELD_H,
    background: BACKGROUND,
    layout: C.LAYOUT,
    game: draw ? game : { ...game, render() {} },
    clock: new ConstantClock(ms),
    surface: {
      cssWidth: () => C.FIELD_W,
      cssHeight: () => C.FIELD_H,
      dpr: () => 1,
      events: () => events,
    },
  });
  engines.push(engine);
  await engine.initialize();
  const key = (code: string, down = true) => {
    events.dispatchEvent(
      Object.assign(new Event(down ? "keydown" : "keyup"), {
        code,
        repeat: false,
      }),
    );
  };
  const tap = async (code: string) => {
    key(code);
    await engine.advance(1);
    key(code, false);
  };
  const pointer = (
    type: string,
    x: number,
    y: number,
    id = 1,
    device = "mouse",
  ) => {
    events.dispatchEvent(
      Object.assign(new Event(`pointer${type}`), {
        clientX: x,
        clientY: y,
        pointerId: id,
        pointerType: device,
        isPrimary: id === 1,
        button: 0,
        buttons: type === "up" ? 0 : 1,
      }),
    );
  };
  const pose = (f: (s: StateView, d: CaromDebugApi) => CaromState) =>
    engine.apply((s) => f(s, engine.debug));
  const flight = (x = 640, y = 360, vx = 520, vy = 0) =>
    pose((s, d) => {
      s = d.clearWorld(s);
      s = d.spawnBall(s);
      s = d.setScreen(s, "playing");
      s = d.setBallHeld(s, false);
      s = d.setBallPosition(s, x, y);
      return d.setBallVelocity(s, vx, vy);
    });
  return { engine, key, tap, pointer, pose, flight, canvas };
}

describe("initialization and automation", () => {
  it("builds the complete title world and registers exactly the supplied actions and cues", async () => {
    const { engine } = await harness();
    const s = engine.debug.snapshot(engine.state);
    expect(s).toMatchObject({
      version: C.CAROM_DEBUG_VERSION,
      screen: "title",
      mode: "solo",
      menuIndex: 0,
      titleIndex: 0,
      score: { p1: 0, p2: 0 },
      winner: null,
      receiver: "left",
      ai: { tracking: true, movement: true },
      obstacleClock: 0,
      obstacleClockRunning: true,
      simTime: 0,
      muted: false,
    });
    expect(s.ball).toMatchObject({
      x: C.FIELD_CX,
      y: C.FIELD_CY,
      held: true,
      holdTimer: C.HOLD_TIME,
      vx: 0,
      vy: 0,
      spin: 0,
      trail: [],
      speed: 0,
    });
    expect(s.obstacles).toEqual([obstaclePose(0, 0), obstaclePose(1, 0)]);
    expect(engine.diagnostics()).toHaveLength(9);
    expect(engine.diagnostics().every((r) => r.error === undefined)).toBe(true);
    const before = structuredClone(engine.state);
    await engine.advance(3);
    expect(engine.state).toEqual({ ...before, simTime: 0.03 });
  });

  it("poses every independent field without advancing or mutating an old value", async () => {
    const { engine, pose } = await harness();
    const old = engine.state;
    pose((s, d) => {
      s = d.setMode(s, "versus");
      s = d.setScreen(s, "paused");
      s = d.setMenuIndex(s, 2);
      s = d.setTitleIndex(s, 1);
      s = d.setResumeScreen(s, "countdown");
      s = d.setScore(s, 10, 9);
      s = d.setWinner(s, "right");
      s = d.setReceiver(s, "right");
      s = d.setPaddleCy(s, "left", 99);
      s = d.setPaddleVy(s, "left", 300);
      s = d.setPaddleDriven(s, "left", true);
      s = d.setBallPosition(s, 321, 123);
      s = d.setBallVelocity(s, 300, 400);
      s = d.setBallSpin(s, -250);
      s = d.setBallHeld(s, false);
      s = d.setBallHoldTimer(s, 0.2);
      s = d.setBallServeSign(s, -1);
      s = d.setAiTracking(s, false);
      s = d.setAiMovement(s, false);
      s = d.setMuted(s, true);
      s = d.setObstacleClock(s, 1.2);
      return d.setObstacleClockRunning(s, false);
    });
    const snapshot = engine.debug.snapshot(engine.state);
    expect(snapshot).toMatchObject({
      mode: "versus",
      screen: "paused",
      menuIndex: 2,
      titleIndex: 1,
      resumeScreen: "countdown",
      score: { p1: 10, p2: 9 },
      winner: "right",
      receiver: "right",
      paddles: {
        left: { cy: 99, drivenVy: 300, vy: 0, driven: true },
        right: { driven: false },
      },
      ball: {
        x: 321,
        y: 123,
        vx: 300,
        vy: 400,
        speed: 500,
        spin: -250,
        held: false,
        holdTimer: 0.2,
        serveSign: -1,
      },
      ai: { tracking: false, movement: false },
      muted: true,
      obstacleClock: 1.2,
      obstacleClockRunning: false,
      simTime: 0,
    });
    expect(old.screen).toBe("title");
    expect(old.ball?.x).toBe(C.FIELD_CX);
    expect(snapshot.obstacles).toEqual([
      obstaclePose(0, 1.2),
      obstaclePose(1, 1.2),
    ]);
    expect(snapshot.score).not.toBe(engine.state.score);
    pose((s, d) => d.reconcile(s));
    expect(engine.debug.snapshot(engine.state)).toEqual(snapshot);
    pose((s, d) => d.reconcile(d.reconcile(s)));
    expect(engine.debug.snapshot(engine.state)).toEqual(snapshot);
    pose((s, d) => d.reset(s));
    expect(engine.state).toMatchObject({
      screen: "title",
      muted: true,
      simTime: 0,
      paddles: { left: { driven: false, drivenVy: 0 } },
      ai: { tracking: true, movement: true },
    });
  });

  it("clears and respawns entities, rejects missing entities and invalid indices", async () => {
    const { engine, pose } = await harness();
    pose((s, d) => d.clearWorld(s));
    expect(engine.state.ball).toBeNull();
    expect(engine.state.obstacles).toEqual([]);
    const d = engine.debug,
      s = engine.state;
    for (const f of [
      () => d.setBallPosition(s, 1, 2),
      () => d.setBallVelocity(s, 1, 2),
      () => d.setBallSpin(s, 1),
      () => d.setBallHeld(s, true),
      () => d.setBallHoldTimer(s, 0),
      () => d.setBallServeSign(s, 1),
      () => d.drawBallServeSign(s),
      () => d.spawnObstacle(s, 2),
    ])
      expect(f).toThrow();
    pose((s, d) => d.setObstacleClock(s, 2));
    pose((s, d) =>
      d.spawnObstacle(d.spawnObstacle(d.spawnObstacle(s, 1), 0), 1),
    );
    expect(engine.state.obstacles.map((o) => o.index)).toEqual([0, 1]);
    expect(engine.state.obstacles[1]).toEqual(obstaclePose(1, 2));
    vi.spyOn(Math, "random").mockReturnValue(0.2);
    pose((s, d) => d.spawnBall(s));
    expect(engine.state.ball?.serveSign).toBe(-1);
    vi.spyOn(Math, "random").mockReturnValue(0.8);
    pose((s, d) => d.drawBallServeSign(s));
    expect(engine.state.ball?.serveSign).toBe(1);
    pose((s, d) => d.clearWorld(d.setScreen(s, "playing")));
    await engine.advance(10);
    expect(engine.state.score).toEqual({ p1: 0, p2: 0 });
  });
});

describe("menus and input arbitration", () => {
  it("wraps, remembers selections, visits how-to, and starts either mode", async () => {
    const { engine, tap, key } = await harness();
    await tap("KeyW");
    expect(engine.state.menuIndex).toBe(2);
    await tap("Enter");
    expect(engine.state.screen).toBe("howto");
    expect(engine.state.titleIndex).toBe(2);
    await tap("Escape");
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(2);
    await tap("KeyS");
    expect(engine.state.menuIndex).toBe(0);
    key("KeyS");
    key("KeyW");
    key("Enter");
    await engine.advance(1);
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(2);
    key("KeyS", false);
    key("KeyW", false);
    key("Enter", false);
    await tap("KeyW");
    await tap("Space");
    expect(engine.state).toMatchObject({
      screen: "countdown",
      mode: "versus",
      titleIndex: 1,
      score: { p1: 0, p2: 0 },
    });
  });

  it("pauses with a single Escape, freezes all motion, then resumes once", async () => {
    const { engine, tap, key, pose } = await harness();
    await tap("Enter");
    await tap("Escape");
    expect(engine.state.screen).toBe("paused");
    const before = structuredClone(engine.state);
    key("KeyS");
    await engine.advance(20);
    key("KeyS", false);
    expect(engine.state.ball).toEqual(before.ball);
    expect(engine.state.paddles).toEqual(before.paddles);
    expect(engine.state.obstacleClock).toBe(before.obstacleClock);
    await tap("Escape");
    expect(engine.state.screen).toBe("countdown");
    expect(engine.state.ball!.holdTimer).toBeLessThan(before.ball!.holdTimer);
    pose((s, d) => d.setBallHoldTimer(s, 0));
    await engine.advance(1);
    await tap("KeyP");
    expect(engine.state.resumeScreen).toBe("playing");
    await tap("KeyS");
    await tap("Enter");
    expect(engine.state.screen).toBe("countdown");
    await tap("KeyP");
    await tap("KeyW");
    await tap("Enter");
    expect(engine.state.screen).toBe("title");
  });

  it("requires matching pointer edges, handles touch and lets keyboard confirm win", async () => {
    const { engine, pointer, pose, key } = await harness();
    const rect = engine.debug.menuItemRect(engine.state, 1)!;
    pointer("move", rect.x + 10, rect.y + 10);
    await engine.advance(1);
    expect(engine.state.menuIndex).toBe(1);
    pointer("down", rect.x + 10, rect.y + 10);
    await engine.advance(1);
    pointer("up", 0, 0);
    await engine.advance(1);
    expect(engine.state.screen).toBe("title");
    pointer("down", rect.x + 10, rect.y + 10, 2, "touch");
    pointer("up", rect.x + 10, rect.y + 10, 2, "touch");
    await engine.advance(1);
    expect(engine.state.mode).toBe("versus");
    expect(engine.state.screen).toBe("countdown");
    expect(engine.debug.menuItemRect(engine.state, 0)).toBeNull();
    pose((s, d) => d.reset(s));
    pointer("down", rect.x + 10, rect.y + 10);
    pointer("up", rect.x + 10, rect.y + 10);
    key("Enter");
    await engine.advance(1);
    key("Enter", false);
    expect(engine.state.mode).toBe("solo");
    pose((s, d) => d.reset(s));
    pointer("down", rect.x + 10, rect.y + 10);
    await engine.advance(1);
    pointer("move", rect.x + 10, rect.y + 80);
    pointer("up", rect.x + 10, rect.y + 80);
    await engine.advance(1);
    expect(engine.state.screen).toBe("title");
    expect(engine.debug.menuItemRect(engine.state, -1)).toBeNull();
    expect(engine.debug.menuItemRect(engine.state, 8)).toBeNull();
    pose((s, d) => d.setScreen(s, "howto"));
    const back = engine.debug.menuItemRect(engine.state, 0)!;
    pointer("down", back.x + 10, back.y + 10);
    pointer("up", back.x + 10, back.y + 10);
    await engine.advance(1);
    expect(engine.state.screen).toBe("title");
  });

  it("handles match-over replay, menu, back, and all-screen mute", async () => {
    const { engine, pose, tap } = await harness();
    await tap("KeyM");
    expect(engine.state.muted).toBe(true);
    pose((s, d) => d.setScreen(s, "matchover"));
    await tap("Enter");
    expect(engine.state.screen).toBe("countdown");
    pose((s, d) => d.setScreen(s, "matchover"));
    await tap("KeyS");
    await tap("Enter");
    expect(engine.state.screen).toBe("title");
    pose((s, d) => d.setScreen(s, "matchover"));
    await tap("Escape");
    expect(engine.state.screen).toBe("title");
    await tap("KeyM");
    expect(engine.state.muted).toBe(false);
  });
});

describe("paddles, serves, and the AI", () => {
  it("moves during countdown, serves at the exact angle without advancing on the serve frame", async () => {
    const { engine, key, tap, pose } = await harness();
    await tap("Enter");
    key("ArrowDown");
    await engine.advance(10);
    key("ArrowDown", false);
    expect(engine.state.paddles.left.cy).toBeCloseTo(
      C.FIELD_CY + C.PADDLE_SPEED * 0.1,
    );
    pose((s, d) => d.setBallServeSign(d.setBallHoldTimer(s, 0.005), -1));
    await engine.advance(1);
    expect(engine.state.screen).toBe("playing");
    expect(engine.state.ball).toMatchObject({
      x: C.FIELD_CX,
      y: C.FIELD_CY,
      held: false,
      holdTimer: 0,
      serveSign: -1,
    });
    expect(engine.state.ball!.vx).toBeCloseTo(
      -C.SERVE_SPEED * Math.cos(C.SERVE_ANGLE),
    );
    expect(engine.state.ball!.vy).toBeCloseTo(
      -C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
    );
    await engine.advance(1);
    expect(engine.state.ball!.x).toBeLessThan(C.FIELD_CX);
  });

  it("drives each side independently, keeps drivenVy, and reports actual clamped vy", async () => {
    const { engine, pose, key } = await harness();
    pose((s, d) => d.setScreen(s, "countdown"));
    pose((s, d) =>
      d.setPaddleVy(d.setPaddleDriven(s, "left", true), "left", 900),
    );
    key("KeyW");
    await engine.advance(100);
    key("KeyW", false);
    expect(engine.state.paddles.left).toMatchObject({
      cy: C.PADDLE_MAX_CY,
      vy: 0,
      drivenVy: 900,
    });
    pose((s, d) => d.setPaddleDriven(s, "left", false));
    key("KeyW");
    await engine.advance(1);
    key("KeyW", false);
    expect(engine.state.paddles.left.vy).toBe(-C.PADDLE_SPEED);
    expect(engine.state.paddles.left.drivenVy).toBe(900);
    pose((s, d) => d.setMode(d.setScreen(s, "countdown"), "versus"));
    key("ArrowUp");
    await engine.advance(1);
    key("ArrowUp", false);
    expect(engine.state.paddles.right.vy).toBe(-C.PADDLE_SPEED);
  });

  it("tracks only approaching balls and independently gates sensing and motion", async () => {
    const { engine, flight, pose } = await harness();
    flight(900, 550, 500, 100);
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(C.AI_SPEED);
    pose((s, d) => d.setAiMovement(s, false));
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(0);
    pose((s, d) => d.setAiTracking(d.setAiMovement(s, true), false));
    pose((s, d) => d.setPaddleCy(s, "right", 600));
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(-C.AI_SPEED);
    pose((s, d) => d.setAiTracking(d.setBallVelocity(s, -500, 0), true));
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(-C.AI_SPEED);
    pose((s, d) => d.setPaddleCy(s, "right", C.AI_HOME_Y));
    await engine.advance(1);
    expect(engine.state.paddles.right.vy).toBe(0);
  });
});

describe("flight, collisions, and scoring", () => {
  it("curves without changing speed, decays spin, and bounds the trail in seconds", async () => {
    const { engine, flight, pose } = await harness();
    flight();
    pose((s, d) => d.setBallSpin(s, 400));
    await engine.advance(20);
    expect(
      Math.hypot(engine.state.ball!.vx, engine.state.ball!.vy),
    ).toBeCloseTo(520, 7);
    expect(engine.state.ball!.vy).toBeGreaterThan(0);
    expect(engine.state.ball!.spin).toBeCloseTo(
      400 * Math.pow(0.5, 0.2 / C.SPIN_HALFLIFE),
      7,
    );
    expect(
      engine.state.ball!.trail.every(
        (p) => engine.state.simTime - p.t <= C.TRAIL_TIME,
      ),
    ).toBe(true);
    const saved = structuredClone(engine.state);
    await engine.advance(1);
    expect(saved.ball!.x).not.toBe(engine.state.ball!.x);
    flight(640, 360, 0, 0);
    pose((s, d) => d.setBallSpin(s, -20));
    await engine.advance(1);
    expect(engine.state.ball!.x).toBe(640);
  });

  it("reflects at both walls, preserving speed and spin except for decay; emits each cue once", async () => {
    const { engine, flight, pose } = await harness(100);
    const cues: string[] = [];
    engine.events.on("cue:played", (e) => cues.push(e.cue));
    flight(640, 15, 0, -980);
    pose((s, d) => d.setBallSpin(s, 0));
    await engine.advance(1);
    expect(engine.state.ball!.vy).toBe(980);
    expect(engine.state.ball!.y).toBeGreaterThanOrEqual(C.BALL_R);
    flight(640, 705, 0, 980);
    await engine.advance(1);
    expect(engine.state.ball!.vy).toBe(-980);
    expect(cues).toEqual([C.CUES.wallBounce, C.CUES.wallBounce]);
  });

  it("accelerates front-face hits, maps offsets, and acquires moving-paddle spin", async () => {
    const { engine, flight, pose } = await harness();
    const cues: string[] = [];
    engine.events.on("cue:played", (e) => cues.push(e.cue));
    flight(C.P1_X1 + C.BALL_R + 2, 360, -520, 0);
    await engine.advance(1);
    expect(engine.state.ball!.vx).toBeCloseTo(520 * C.SPEED_MULT);
    expect(engine.state.ball!.vy).toBe(0);
    flight(C.P2_X0 - C.BALL_R - 2, 360, 970, 0);
    pose((s, d) => d.setAiMovement(s, false));
    await engine.advance(1);
    expect(engine.state.ball!.vx).toBeCloseTo(-C.SPEED_CAP);
    flight(C.P1_X1 + C.BALL_R + 2, 390, -520, 0);
    pose((s, d) =>
      d.setPaddleVy(d.setPaddleDriven(s, "left", true), "left", 720),
    );
    await engine.advance(1);
    expect(engine.state.ball!.spin).toBeGreaterThan(600);
    expect(engine.state.ball!.vy).toBeGreaterThan(0);
    expect(cues.filter((c) => c === C.CUES.paddleHit)).toHaveLength(3);
  });

  it("resolves end caps like walls, including moving-away penetration", async () => {
    const { engine, flight, pose } = await harness(2);
    pose((s, d) => d.setMode(s, "versus"));
    flight(56, 293, 0, 900);
    await engine.advance(1);
    expect(engine.state.ball!.vy).toBe(-900);
    expect(engine.state.ball!.spin).toBe(0);
    flight(56, 427, 0, -900);
    await engine.advance(1);
    expect(engine.state.ball!.vy).toBe(900);
    flight(56, 295, 0, -100);
    await engine.advance(1);
    expect(engine.state.ball!.vy).toBe(-100);
    expect(engine.state.ball!.y).toBe(294);
  });

  it("reflects off tilted faces, corners and interior penetrations with no speed gain", async () => {
    const { engine, flight, pose } = await harness(2);
    const cues: string[] = [];
    engine.events.on("cue:played", (e) => cues.push(e.cue));
    for (const t of [0, 0.5, 1.5]) {
      flight();
      pose((s, d) =>
        d.spawnObstacle(
          d.setObstacleClockRunning(d.setObstacleClock(s, t), false),
          0,
        ),
      );
      const o = engine.state.obstacles[0],
        c = Math.cos(o.theta),
        sn = Math.sin(o.theta);
      pose((s, d) =>
        d.setBallVelocity(
          d.setBallPosition(
            s,
            o.cx - (C.OBSTACLE_HW + C.BALL_R + 1) * c,
            o.cy - (C.OBSTACLE_HW + C.BALL_R + 1) * sn,
          ),
          980 * c,
          980 * sn,
        ),
      );
      await engine.advance(2);
      const b = engine.state.ball!;
      expect(b.vx * c + b.vy * sn).toBeLessThan(0);
      expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(980);
    }
    expect(cues.filter((c) => c === C.CUES.obstacleBounce)).toHaveLength(3);
    flight();
    pose((s, d) => d.spawnObstacle(d.setObstacleClock(s, 0), 0));
    pose((s, d) => d.setBallPosition(s, 490, 220));
    await engine.advance(1);
    expect(engine.state.ball!.x).toBeGreaterThanOrEqual(511);
    flight();
    pose((s, d) =>
      d.spawnObstacle(
        d.setObstacleClockRunning(d.setObstacleClock(s, 0), false),
        0,
      ),
    );
    pose((s, d) =>
      d.setBallVelocity(d.setBallPosition(s, 504, 294), -100, -100),
    );
    await engine.advance(1);
    expect(
      Math.hypot(engine.state.ball!.vx, engine.state.ball!.vy),
    ).toBeCloseTo(Math.hypot(100, 100));
  });

  it("scores only beyond the whole ball, serves toward the receiver, and wins by two", async () => {
    const { engine, flight, pose } = await harness();
    flight(C.FIELD_W + C.BALL_R, 100, 0, 0);
    await engine.advance(1);
    expect(engine.state.score.p1).toBe(0);
    pose((s, d) => d.setBallVelocity(s, 500, 0));
    await engine.advance(1);
    expect(engine.state).toMatchObject({
      screen: "countdown",
      score: { p1: 1, p2: 0 },
      receiver: "right",
    });
    expect(engine.state.ball!.trail).toEqual([]);
    pose((s, d) => d.setBallHoldTimer(s, 0));
    await engine.advance(1);
    expect(engine.state.ball!.vx).toBeGreaterThan(0);
    flight(-C.BALL_R - 1, 100, -500, 0);
    pose((s, d) => d.setScore(s, 10, 10));
    await engine.advance(1);
    expect(engine.state.screen).toBe("countdown");
    expect(engine.state.score).toEqual({ p1: 10, p2: 11 });
    flight(-C.BALL_R - 1, 100, -500, 0);
    await engine.advance(1);
    expect(engine.state).toMatchObject({
      screen: "matchover",
      winner: "right",
      menuIndex: 0,
      score: { p1: 10, p2: 12 },
    });
    flight(C.FIELD_W + C.BALL_R + 1, 100, 500, 0);
    pose((s, d) => d.setScore(s, 10, 0));
    await engine.advance(1);
    expect(engine.state.winner).toBe("left");
  });

  it("agrees across 2ms and 16ms frame lengths on a spinning paddle rally", async () => {
    const outcomes = [];
    for (const ms of [2, 16]) {
      const { engine, flight, pose } = await harness(ms);
      flight(300, 355, -700, -10);
      pose((s, d) =>
        d.setPaddleVy(d.setPaddleDriven(s, "left", true), "left", -40),
      );
      await engine.advance(800 / ms);
      outcomes.push(engine.debug.snapshot(engine.state));
    }
    const [a, b] = outcomes;
    expect(a.score).toEqual(b.score);
    expect(Math.abs(a.ball!.speed - b.ball!.speed)).toBeLessThan(10);
    expect(Math.sign(a.ball!.vx)).toBe(Math.sign(b.ball!.vx));
    expect(Math.sign(a.ball!.vy)).toBe(Math.sign(b.ball!.vy));
    expect(a.simTime).toBeCloseTo(b.simTime);
  });
});

it("renders each screen through the real engine canvas and records its own drawing", async () => {
  const { engine, pose, canvas } = await harness(16, true);
  engine.startRecording();
  for (const screen of [
    "title",
    "howto",
    "countdown",
    "playing",
    "paused",
    "matchover",
  ] as const) {
    pose((s, d) => d.setScreen(s, screen));
    await engine.advance(1);
  }
  const recording = engine.stopRecording();
  expect(recording.frames).toHaveLength(6);
  expect(recording.ops.length).toBeGreaterThan(100);
  expect(canvas.toBuffer("image/png").byteLength).toBeGreaterThan(10000);
  pose((s, d) => d.setWinner(d.setMode(s, "versus"), "right"));
  await engine.advance(1);
  pose((s, d) => d.setWinner(s, "left"));
  await engine.advance(1);
  pose((s, d) => d.clearWorld(s));
  await engine.advance(1);
  expect(
    engine.diagnostics().find((r) => r.name === "ball position")?.value,
  ).toBe("none");
  pose((s, d) =>
    d.setBallSpin(
      d.setBallHeld(d.spawnBall(d.setScreen(s, "playing")), false),
      400,
    ),
  );
  await engine.advance(3);
  pose((s, d) => d.setBallSpin(s, -400));
  await engine.advance(3);
});

it("deduplicates repeated sub-step cues and mutes the runtime without changing flight", async () => {
  const { engine, flight, pose } = await harness(2000);
  const cues: { cue: string; gain: number }[] = [];
  engine.events.on("cue:played", (e) => cues.push(e));
  flight(C.FIELD_CX, C.FIELD_CY, 0, C.SPEED_CAP);
  pose((s, d) => d.setMuted(s, true));
  await engine.advance(1);
  expect(cues).toEqual([
    expect.objectContaining({ cue: C.CUES.wallBounce, gain: 0 }),
  ]);
  expect(Math.abs(engine.state.ball!.vy)).toBe(C.SPEED_CAP);
  expect(engine.state.ball!.y).toBeGreaterThanOrEqual(C.BALL_R);
  expect(engine.state.ball!.y).toBeLessThanOrEqual(C.FIELD_H - C.BALL_R);
});
