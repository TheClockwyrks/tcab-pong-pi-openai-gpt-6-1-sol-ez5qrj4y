import type { UpdateApi } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { CaromState, MenuRect, StateView } from "./game";
import { returnToTitle, startMatch } from "./world";

export function menuItems(s: StateView): readonly string[] {
  switch (s.screen) {
    case "title":
      return C.TITLE_ITEMS;
    case "howto":
      return ["BACK TO MENU"];
    case "paused":
      return C.PAUSE_ITEMS;
    case "matchover":
      return C.MATCHOVER_ITEMS;
    default:
      return [];
  }
}

export function menuItemRect(s: StateView, index: number): MenuRect | null {
  if (index < 0 || index >= menuItems(s).length || !Number.isInteger(index))
    return null;
  const y = s.screen === "howto" ? 589 : s.screen === "title" ? 346 : 350;
  return { x: 440, y: y + index * 70, w: 400, h: 58 };
}

function confirm(s: StateView): CaromState {
  switch (s.screen) {
    case "title": {
      const remembered = { ...s, titleIndex: s.menuIndex, menuPresses: {} };
      return s.menuIndex === 2
        ? { ...remembered, screen: "howto", menuIndex: 0 }
        : startMatch(remembered, s.menuIndex === 0 ? "solo" : "versus");
    }
    case "howto":
      return returnToTitle(s);
    case "paused":
      return s.menuIndex === 0
        ? { ...s, screen: s.resumeScreen, menuPresses: {} }
        : s.menuIndex === 1
          ? startMatch(s, s.mode)
          : returnToTitle(s);
    case "matchover":
      return s.menuIndex === 0 ? startMatch(s, s.mode) : returnToTitle(s);
    default:
      return s;
  }
}

export function readInput(state: StateView, api: UpdateApi): CaromState {
  // Consume each registered edge exactly once, before changing screens.
  const edges = Object.fromEntries(
    C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
  );
  const samples = api.input.pointerSamples();
  api.input.pointer();
  api.input.pointerContacts();
  let s: CaromState = { ...state };
  api.audio.setMuted(edges.mute ? !s.muted : s.muted);
  s = { ...s, muted: api.audio.muted() };
  const live = s.screen === "countdown" || s.screen === "playing";
  if (live) {
    return edges.pause
      ? {
          ...s,
          resumeScreen: s.screen as "countdown" | "playing",
          screen: "paused",
          menuIndex: 0,
          menuPresses: {},
        }
      : s;
  }
  if (s.screen === "paused" && (edges.pause || edges.back))
    return { ...s, screen: s.resumeScreen, menuPresses: {} };
  if ((s.screen === "howto" || s.screen === "matchover") && edges.back)
    return returnToTitle(s);

  const count = menuItems(s).length;
  const up = edges["p1-up"] || edges["p2-up"];
  const down = edges["p1-down"] || edges["p2-down"];
  if (up) s = { ...s, menuIndex: (s.menuIndex + count - 1) % count };
  else if (down) s = { ...s, menuIndex: (s.menuIndex + 1) % count };
  else if (edges.confirm) return confirm(s); // Keyboard confirmation wins over every pointer.

  const presses = { ...s.menuPresses };
  let selected = s.menuIndex;
  let clicked = false;
  for (const sample of samples) {
    if (sample.button && sample.button !== "primary") continue;
    const index = menuItems(s).findIndex((_, i) => {
      const r = menuItemRect(s, i)!;
      return (
        sample.x >= r.x &&
        sample.x <= r.x + r.w &&
        sample.y >= r.y &&
        sample.y <= r.y + r.h
      );
    });
    if (index >= 0) selected = index;
    if (sample.type === "down") presses[sample.id] = index;
    if (sample.type === "up") {
      if (index >= 0 && presses[sample.id] === index && !clicked) {
        selected = index;
        clicked = true;
      }
      delete presses[sample.id];
    }
  }
  s = { ...s, menuIndex: selected, menuPresses: presses };
  return clicked ? confirm(s) : s;
}
