import type { Rest } from './types';

/** One tap starts one of these. */
export const REST_PRESETS = [30, 45, 60, 90, 120, 150, 180, 240, 300];
export const REST_STEP_SEC = 15;
export const REST_MIN_SEC = 10;
export const REST_MAX_SEC = 30 * 60;
export const DEFAULT_REST_SEC = 90;

export function clampRestSec(sec: number): number {
  if (!Number.isFinite(sec)) return DEFAULT_REST_SEC;
  return Math.min(REST_MAX_SEC, Math.max(REST_MIN_SEC, Math.round(sec)));
}

export function startRest(now: number, sec: number): Rest {
  return { startedAt: now, endsAt: now + clampRestSec(sec) * 1000 };
}

/**
 * Time left. Counted from the stored end time, not by ticking down: iOS freezes a hidden
 * app, and the first frame after it comes back must already show the right value.
 */
export function restRemainingMs(rest: Rest | null, now: number): number {
  return rest ? Math.max(0, rest.endsAt - now) : 0;
}

export function restTotalMs(rest: Rest): number {
  return Math.max(1, rest.endsAt - rest.startedAt);
}

/** ±15 s during a rest: never into the past, never beyond the longest rest. */
export function adjustRest(rest: Rest, deltaSec: number, now: number): Rest {
  const latest = rest.startedAt + REST_MAX_SEC * 1000;
  return { ...rest, endsAt: Math.min(latest, Math.max(now, rest.endsAt + deltaSec * 1000)) };
}
