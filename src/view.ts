import type { RenderApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { MenuRect, StateView } from "./game";
import { menuItemRect, menuItems } from "./menus";

const INK = "#e9f1e7";
const MINT = "#8df5c5";
const CORAL = "#ff8877";
const GOLD = "#edc779";
const MUTED = "#7c9798";
const LINE = "#24383c";
const MONO = '"Courier New", monospace';
const SANS = "Arial, Helvetica, sans-serif";

function text(
  ctx: CanvasRenderingContext2D,
  copy: string,
  x: number,
  y: number,
  size = 14,
  color = MUTED,
  align: CanvasTextAlign = "left",
  weight = 400,
  mono = true,
): void {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${mono ? MONO : SANS}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(copy, x, y);
}
function line(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  x2: number,
  y2: number,
  color = LINE,
  width = 1,
): void {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}
function rounded(
  ctx: CanvasRenderingContext2D,
  r: MenuRect,
  radius: number,
  color: string,
): void {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
  ctx.fillStyle = color;
  ctx.fill();
}
function circle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function backdrop(ctx: CanvasRenderingContext2D): void {
  const glow = ctx.createRadialGradient(
    C.FIELD_CX,
    C.FIELD_CY,
    40,
    C.FIELD_CX,
    C.FIELD_CY,
    740,
  );
  glow.addColorStop(0, "#14282b");
  glow.addColorStop(1, "#091519");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
  // Quiet drafting marks make the court read as a physical instrument.
  ctx.fillStyle = "#203337";
  for (let x = 96; x < C.FIELD_W; x += 48)
    for (let y = 96; y < C.FIELD_H; y += 48) ctx.fillRect(x, y, 1, 1);
  line(ctx, 24, 24, C.FIELD_W - 24, 24);
  line(ctx, 24, C.FIELD_H - 24, C.FIELD_W - 24, C.FIELD_H - 24);
  for (const x of [24, C.FIELD_W - 24]) {
    line(ctx, x, 24, x, 48, "#4b6262");
    line(ctx, x, C.FIELD_H - 48, x, C.FIELD_H - 24, "#4b6262");
  }
}

function court(s: StateView, ctx: CanvasRenderingContext2D, dim = false): void {
  ctx.save();
  if (dim) ctx.globalAlpha = 0.17;
  ctx.setLineDash([7, 13]);
  line(ctx, C.NET_X, 100, C.NET_X, C.FIELD_H - 65, "#304447", 2);
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(C.FIELD_CX, C.FIELD_CY, 70, 0, Math.PI * 2);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.stroke();
  line(ctx, 0, 2, C.FIELD_W, 2, "#3e5a5b", 3);
  line(ctx, 0, C.FIELD_H - 2, C.FIELD_W, C.FIELD_H - 2, "#3e5a5b", 3);
  for (const [side, x, color] of [
    ["left", C.P1_X0, MINT],
    ["right", C.P2_X0, CORAL],
  ] as const) {
    const p = s.paddles[side];
    ctx.shadowColor = color;
    ctx.shadowBlur = 19;
    rounded(
      ctx,
      { x, y: p.cy - C.PADDLE_HALF, w: C.PADDLE_W, h: C.PADDLE_H },
      7,
      color,
    );
    ctx.shadowBlur = 0;
    line(ctx, x + 5, p.cy - 16, x + 5, p.cy + 16, "#ffffff80", 2);
    line(
      ctx,
      x + (side === "left" ? -16 : 32),
      p.cy - 5,
      x + (side === "left" ? -16 : 32),
      p.cy + 5,
      color,
      2,
    );
  }
  for (const o of s.obstacles) {
    ctx.save();
    ctx.translate(o.cx, o.cy);
    ctx.rotate(o.theta);
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 15;
    rounded(
      ctx,
      {
        x: -C.OBSTACLE_HW,
        y: -C.OBSTACLE_HH,
        w: C.OBSTACLE_W,
        h: C.OBSTACLE_H,
      },
      7,
      GOLD,
    );
    ctx.shadowBlur = 0;
    circle(ctx, 0, 0, 3, "#725c32");
    line(ctx, 0, -48, 0, -27, "#fff4cf", 2);
    line(ctx, 0, 27, 0, 48, "#fff4cf", 2);
    ctx.restore();
    text(ctx, o.index === 0 ? "A" : "B", o.cx + 28, o.cy, 10, "#aa9568");
  }
  if (s.ball) {
    const b = s.ball;
    for (let i = 1; i < b.trail.length; i++) {
      const p = b.trail[i - 1],
        q = b.trail[i];
      const alpha = Math.max(0, 1 - (s.simTime - q.t) / C.TRAIL_TIME);
      ctx.globalAlpha = (dim ? 0.17 : 1) * alpha * 0.45;
      ctx.lineCap = "round";
      line(ctx, p.x, p.y, q.x, q.y, INK, C.BALL_R * 2 * alpha);
    }
    ctx.globalAlpha = dim ? 0.17 : 1;
    ctx.shadowColor = INK;
    ctx.shadowBlur = 22;
    circle(ctx, b.x, b.y, C.BALL_R, INK);
    ctx.shadowBlur = 0;
    if (Math.abs(b.spin) > 60 && !b.held) {
      ctx.beginPath();
      ctx.arc(
        b.x,
        b.y,
        C.BALL_R + 7,
        s.simTime * 5,
        s.simTime * 5 + Math.PI * 1.3,
      );
      ctx.lineWidth = 2;
      ctx.strokeStyle = b.spin > 0 ? CORAL : MINT;
      ctx.stroke();
    }
  }
  ctx.restore();
}

function brand(ctx: CanvasRenderingContext2D, muted: boolean): void {
  text(ctx, "C /", 48, 57, 20, MINT, "left", 700, false);
  text(ctx, "CAROM   /   PADDLE DUEL", 100, 57, 12, INK);
  circle(ctx, 1095, 57, 3, muted ? MUTED : MINT);
  text(
    ctx,
    muted ? "M  SOUND OFF" : "M  SOUND ON",
    1232,
    57,
    11,
    MUTED,
    "right",
  );
}

function buttons(s: StateView, ctx: CanvasRenderingContext2D): void {
  const notes =
    s.screen === "title"
      ? [
          "YOU VS THE MACHINE",
          "TWO PLAYERS · ONE KEYBOARD",
          "CONTROLS & THE CRAFT",
        ]
      : [];
  menuItems(s).forEach((item, i) => {
    const r = menuItemRect(s, i)!;
    const active = s.menuIndex === i;
    rounded(ctx, r, 4, active ? MINT : "#14272b");
    if (!active) {
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    }
    text(
      ctx,
      `0${i + 1}`,
      r.x + 20,
      r.y + r.h / 2,
      11,
      active ? "#375e50" : MUTED,
    );
    text(
      ctx,
      item,
      r.x + 63,
      r.y + (notes.length ? 21 : r.h / 2),
      17,
      active ? "#0b2721" : INK,
      "left",
      700,
      false,
    );
    if (notes[i])
      text(ctx, notes[i], r.x + 63, r.y + 41, 9, active ? "#315f4f" : MUTED);
    text(
      ctx,
      active ? "↗" : "+",
      r.x + r.w - 24,
      r.y + r.h / 2,
      22,
      active ? "#173e31" : MUTED,
      "center",
      400,
      false,
    );
  });
}

function title(s: StateView, ctx: CanvasRenderingContext2D): void {
  brand(ctx, s.muted);
  text(ctx, "A GAME OF ANGLES", C.FIELD_CX, 153, 12, MINT, "center");
  // Broad, tightly stacked typography is the identity; no external font assets.
  ctx.save();
  ctx.translate(C.FIELD_CX, 241);
  ctx.scale(1.12, 1);
  text(ctx, C.TITLE_TEXT, 0, 0, 142, INK, "center", 900, false);
  ctx.restore();
  text(ctx, "MOVE.  CURVE.  OUTTHINK.", C.FIELD_CX, 309, 13, MUTED, "center");
  buttons(s, ctx);
  text(
    ctx,
    `FIRST TO ${C.WIN_SCORE}  /  WIN BY ${C.WIN_LEAD}`,
    C.FIELD_CX,
    601,
    11,
    GOLD,
    "center",
  );
  line(ctx, 440, 630, 840, 630);
  text(
    ctx,
    "W / S or ↑ / ↓  SELECT     ENTER  PLAY",
    C.FIELD_CX,
    654,
    11,
    MUTED,
    "center",
  );
  // A pair of bank-shot diagrams frame, rather than compete with, the menu.
  for (const right of [false, true]) {
    ctx.save();
    if (right) {
      ctx.translate(C.FIELD_W, C.FIELD_H);
      ctx.rotate(Math.PI);
    }
    ctx.strokeStyle = "#375858";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 7]);
    ctx.beginPath();
    ctx.moveTo(140, 516);
    ctx.bezierCurveTo(330, 480, 217, 315, 332, 290);
    ctx.lineTo(220, 180);
    ctx.stroke();
    ctx.setLineDash([]);
    circle(ctx, 140, 516, 6, MINT);
    circle(ctx, 332, 290, 9, INK);
    ctx.save();
    ctx.translate(311, 276);
    ctx.rotate(-0.62);
    rounded(ctx, { x: -7, y: -49, w: 14, h: 98 }, 5, GOLD);
    ctx.restore();
    if (!right) text(ctx, "01 / THE BANK SHOT", 135, 557, 10, MUTED);
    ctx.restore();
  }
  text(ctx, "02 / THE RETURN", 1145, 164, 10, MUTED, "right");
}

function hud(s: StateView, ctx: CanvasRenderingContext2D): void {
  text(ctx, "01 / YOU", 116, 49, 11, MINT);
  text(
    ctx,
    s.mode === "solo" ? "02 / MACHINE" : "02 / PLAYER TWO",
    1164,
    49,
    11,
    CORAL,
    "right",
  );
  text(
    ctx,
    String(s.score.p1).padStart(2, "0"),
    C.FIELD_CX - 125,
    65,
    66,
    MINT,
    "center",
    700,
    false,
  );
  text(
    ctx,
    String(s.score.p2).padStart(2, "0"),
    C.FIELD_CX + 125,
    65,
    66,
    CORAL,
    "center",
    700,
    false,
  );
  text(
    ctx,
    s.mode === "solo" ? "SOLO" : "VERSUS",
    C.FIELD_CX,
    42,
    12,
    INK,
    "center",
    700,
  );
  text(ctx, `FIRST TO ${C.WIN_SCORE}`, C.FIELD_CX, 66, 10, MUTED, "center");
  line(ctx, 100, 94, 540, 94);
  line(ctx, 740, 94, 1180, 94);
  text(
    ctx,
    s.mode === "solo" ? "W S / ↑ ↓   MOVE" : "W S   PLAYER ONE",
    100,
    663,
    11,
    MUTED,
  );
  text(ctx, "P / ESC  PAUSE", C.FIELD_CX, 663, 11, MUTED, "center");
  text(
    ctx,
    s.mode === "solo"
      ? s.muted
        ? "M  SOUND OFF"
        : "M  SOUND ON"
      : "↑ ↓   PLAYER TWO",
    1180,
    663,
    11,
    MUTED,
    "right",
  );
  if (s.screen === "countdown") {
    text(ctx, "GET READY", C.FIELD_CX, 265, 12, MINT, "center");
    text(
      ctx,
      s.receiver === "left" ? "← YOUR SERVE TO RECEIVE" : "SERVING RIGHT →",
      C.FIELD_CX,
      294,
      11,
      MUTED,
      "center",
    );
    const progress =
      1 -
      Math.max(
        0,
        Math.min(1, (s.ball?.holdTimer ?? C.HOLD_TIME) / C.HOLD_TIME),
      );
    rounded(ctx, { x: C.FIELD_CX - 45, y: 420, w: 90, h: 3 }, 1, LINE);
    if (progress > 0)
      rounded(
        ctx,
        { x: C.FIELD_CX - 45, y: 420, w: 90 * progress, h: 3 },
        1,
        MINT,
      );
  }
}

function howto(s: StateView, ctx: CanvasRenderingContext2D): void {
  brand(ctx, s.muted);
  text(ctx, "THE SHORT MANUAL", C.FIELD_CX, 135, 11, MINT, "center");
  text(ctx, "Play the angle.", C.FIELD_CX, 191, 56, INK, "center", 700, false);
  const cards = [
    {
      x: 130,
      n: "01",
      title: "MEET THE BALL",
      color: MINT,
      lines: [
        "W / S moves the left paddle.",
        "In Solo, ↑ / ↓ works too.",
        "In Versus, arrows move right.",
      ],
    },
    {
      x: 485,
      n: "02",
      title: "PUT A CURVE ON IT",
      color: CORAL,
      lines: [
        "Move as you strike to add spin.",
        "Up bends one way; down, the other.",
        "The curve fades. The advantage stays.",
      ],
    },
    {
      x: 840,
      n: "03",
      title: "FIND THE REBOUND",
      color: GOLD,
      lines: [
        "The golden bars sway and rotate.",
        "Bank off a tilted face to find a gap.",
        `First to ${C.WIN_SCORE}, with a ${C.WIN_LEAD}-point lead.`,
      ],
    },
  ];
  for (const card of cards) {
    rounded(ctx, { x: card.x - 16, y: 260, w: 326, h: 242 }, 5, "#14272b");
    text(ctx, card.n, card.x + 6, 292, 13, card.color);
    if (card.n === "01") {
      rounded(ctx, { x: card.x + 12, y: 330, w: 8, h: 55 }, 4, MINT);
      circle(ctx, card.x + 100, 354, 7, INK);
      line(ctx, card.x + 40, 354, card.x + 80, 354, MUTED);
    }
    if (card.n === "02") {
      ctx.beginPath();
      ctx.moveTo(card.x + 10, 370);
      ctx.quadraticCurveTo(card.x + 65, 303, card.x + 140, 346);
      ctx.strokeStyle = CORAL;
      ctx.lineWidth = 2;
      ctx.stroke();
      circle(ctx, card.x + 140, 346, 7, INK);
    }
    if (card.n === "03") {
      ctx.save();
      ctx.translate(card.x + 53, 348);
      ctx.rotate(-0.65);
      rounded(ctx, { x: -5, y: -32, w: 10, h: 64 }, 4, GOLD);
      ctx.restore();
      line(ctx, card.x + 85, 363, card.x + 130, 325, GOLD);
    }
    text(ctx, card.title, card.x + 6, 404, 15, INK, "left", 700, false);
    card.lines.forEach((copy, i) =>
      text(ctx, copy, card.x + 6, 438 + i * 20, 11, MUTED),
    );
  }
  text(
    ctx,
    "P / ESC  PAUSE      M  TOGGLE SOUND      TOUCH  USE THE SIDE SLIDERS",
    C.FIELD_CX,
    545,
    11,
    MUTED,
    "center",
  );
  buttons(s, ctx);
}

export function render(s: StateView, { ctx }: RenderApi): void {
  // The supplied runtime can pin an initially stylesheet-sized canvas to pixels
  // when its CSS and backing sizes coincide (notably at DPR 1). Keep the page's
  // original responsive CSS in charge of layout; all measurement, backing-store
  // resizing, scaling and letterboxing still belong exclusively to the engine.
  ctx.canvas.style?.removeProperty("width");
  ctx.canvas.style?.removeProperty("height");
  ctx.save();
  backdrop(ctx);
  if (s.screen === "title") {
    court(s, ctx, true);
    title(s, ctx);
  } else if (s.screen === "howto") howto(s, ctx);
  else {
    court(s, ctx);
    hud(s, ctx);
    if (s.screen === "paused" || s.screen === "matchover") {
      ctx.fillStyle = "#071216d9";
      ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
      brand(ctx, s.muted);
      text(
        ctx,
        s.screen === "paused" ? "TAKE A BREATHER" : "MATCH COMPLETE",
        C.FIELD_CX,
        168,
        12,
        GOLD,
        "center",
      );
      const heading =
        s.screen === "paused"
          ? "Paused."
          : s.winner === "left"
            ? "Player one wins."
            : s.mode === "solo"
              ? "Machine wins."
              : "Player two wins.";
      text(ctx, heading, C.FIELD_CX, 233, 58, INK, "center", 700, false);
      text(
        ctx,
        s.screen === "paused"
          ? "THE NEXT ANGLE CAN WAIT."
          : `${s.score.p1}  —  ${s.score.p2}   /   WELL PLAYED.`,
        C.FIELD_CX,
        294,
        13,
        MUTED,
        "center",
      );
      buttons(s, ctx);
      text(
        ctx,
        "W / S or ↑ / ↓  SELECT     ENTER  CONFIRM",
        C.FIELD_CX,
        608,
        11,
        MUTED,
        "center",
      );
    }
  }
  ctx.restore();
}
