import { describe, expect, it } from 'vitest';
import { REST_MAX_SEC, REST_MIN_SEC, adjustRest, clampRestSec, restRemainingMs, startRest } from './rest';

describe('rest timer', () => {
  it('stores the end time', () => {
    expect(startRest(1000, 90)).toEqual({ startedAt: 1000, endsAt: 91_000 });
  });

  it('counts down from the end time, whatever happened in between', () => {
    const rest = startRest(0, 60);
    // The app was frozen in the background for 45 s: one look at the clock is enough.
    expect(restRemainingMs(rest, 45_000)).toBe(15_000);
    expect(restRemainingMs(rest, 90_000)).toBe(0);
    expect(restRemainingMs(null, 0)).toBe(0);
  });

  it('keeps the length within limits', () => {
    expect(clampRestSec(1)).toBe(REST_MIN_SEC);
    expect(clampRestSec(99_999)).toBe(REST_MAX_SEC);
    expect(clampRestSec(Number.NaN)).toBe(90);
  });

  it('adjusts by ±15 s, never into the past or beyond the maximum', () => {
    const rest = startRest(0, 60);
    expect(adjustRest(rest, 15, 10_000).endsAt).toBe(75_000);
    expect(adjustRest(rest, -15, 50_000).endsAt).toBe(50_000);
    expect(adjustRest({ startedAt: 0, endsAt: REST_MAX_SEC * 1000 }, 15, 0).endsAt).toBe(REST_MAX_SEC * 1000);
  });
});
