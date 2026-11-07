import { describe, expect, it } from 'vitest';
import {
  bestSet,
  dailySeries,
  dayRowsNewestFirst,
  dayStart,
  groupByDay,
  isPersonalRecord,
  lastPerformance,
  runsBySession,
} from './stats';
import type { SetRecord } from './types';

/** Local time, like the phone's clock. */
const at = (s: string) => new Date(s).getTime();

let seq = 0;
function set(doneAt: string, weight: number | null, reps: number, sessionId?: string): SetRecord {
  return { id: `s${++seq}`, exerciseId: 'bench', weight, reps, doneAt: at(doneAt), ...(sessionId && { sessionId }) };
}

describe('groupByDay', () => {
  const history = [
    set('2026-11-03T18:00', 60, 10, 'a'),
    set('2026-11-03T18:05', 60, 8, 'a'),
    set('2026-11-05T09:00', 62.5, 8, 'b'),
    set('2026-11-05T09:04', 62.5, 7, 'b'),
    // Same exercise again in the evening, in another workout.
    set('2026-11-05T19:30', 50, 12, 'c'),
  ];

  it('groups by local day, newest day first, sets in the order they were done', () => {
    const days = groupByDay(history);
    expect(days.map((d) => d.day)).toEqual([dayStart(at('2026-11-05T12:00')), dayStart(at('2026-11-03T12:00'))]);
    expect(days[1].parts).toHaveLength(1);
    expect(days[1].parts[0].sets.map((s) => s.reps)).toEqual([10, 8]);
  });

  it('splits a day with two workouts into parts', () => {
    const [day] = groupByDay(history);
    expect(day.parts.map((p) => p.sessionId)).toEqual(['b', 'c']);
    expect(day.sets).toBe(3);
  });

  it('sums the day', () => {
    const [day] = groupByDay(history);
    expect(day.reps).toBe(27);
    expect(day.volume).toBe(62.5 * 8 + 62.5 * 7 + 50 * 12);
    expect(day.maxWeight).toBe(62.5);
    expect(day.maxReps).toBe(12);
  });

  it('keeps sets logged outside a workout in their own part', () => {
    const [day] = groupByDay([set('2026-11-06T10:00', 20, 10, 'x'), set('2026-11-06T20:00', 20, 15)]);
    expect(day.parts.map((p) => p.sessionId)).toEqual(['x', null]);
  });

  it('has no max weight for bodyweight sets', () => {
    const [day] = groupByDay([set('2026-11-06T10:00', null, 15)]);
    expect(day.maxWeight).toBeNull();
    expect(day.volume).toBe(0);
  });
});

describe('bestSet', () => {
  it('prefers weight, then reps', () => {
    const sets = [set('2026-11-01T10:00', 60, 10), set('2026-11-02T10:00', 65, 5), set('2026-11-03T10:00', 65, 6)];
    expect(bestSet(sets, true)?.reps).toBe(6);
  });

  it('counts reps for bodyweight and keeps the earliest of equal sets', () => {
    const a = set('2026-11-01T10:00', null, 12);
    const b = set('2026-11-02T10:00', null, 12);
    expect(bestSet([a, b], false)).toBe(a);
  });

  it('is null without sets', () => {
    expect(bestSet([], true)).toBeNull();
  });
});

describe('lastPerformance', () => {
  const history = [
    set('2026-11-01T10:00', 60, 10, 'a'),
    set('2026-11-01T10:05', 60, 9, 'a'),
    set('2026-11-04T10:00', 62.5, 8, 'b'),
    set('2026-11-04T10:05', 62.5, 8, 'b'),
    set('2026-11-07T10:00', 65, 5, 'now'),
  ];

  it('returns the previous session, not the current one', () => {
    expect(lastPerformance(history, 'now').map((s) => s.weight)).toEqual([62.5, 62.5]);
  });

  it('returns the latest one outside a workout', () => {
    expect(lastPerformance(history).map((s) => s.sessionId)).toEqual(['now']);
  });

  it('groups sets logged outside a workout by day', () => {
    const loose = [set('2026-11-02T08:00', 20, 10), set('2026-11-02T20:00', 20, 12), set('2026-11-03T08:00', 22, 10)];
    expect(lastPerformance(loose.slice(0, 2)).map((s) => s.reps)).toEqual([10, 12]);
    expect(lastPerformance(loose).map((s) => s.reps)).toEqual([10]);
  });

  it('is empty for a new exercise', () => {
    expect(lastPerformance([], 'now')).toEqual([]);
  });
});

describe('isPersonalRecord', () => {
  const earlier = [set('2026-11-01T10:00', 60, 10), set('2026-11-03T10:00', 62.5, 6)];

  it('needs to beat the best earlier set', () => {
    expect(isPersonalRecord([set('2026-11-07T10:00', 62.5, 7)], earlier, true)).toBe(true);
    expect(isPersonalRecord([set('2026-11-07T10:00', 62.5, 6)], earlier, true)).toBe(false);
  });

  it('is not a record the first time', () => {
    expect(isPersonalRecord([set('2026-11-07T10:00', 40, 10)], [], true)).toBe(false);
  });
});

describe('dailySeries', () => {
  it('gives one value per day, oldest first', () => {
    const days = groupByDay([
      set('2026-11-01T10:00', 60, 10, 'a'),
      set('2026-11-01T10:05', 65, 5, 'a'),
      set('2026-11-03T10:00', 70, 3, 'b'),
    ]);
    expect(dailySeries(days, 'maxWeight').map((p) => p.value)).toEqual([65, 70]);
    expect(dailySeries(days, 'volume').map((p) => p.value)).toEqual([925, 210]);
    expect(dailySeries(days, 'totalReps').map((p) => p.value)).toEqual([15, 3]);
  });
});

describe('day rows for the history list', () => {
  // Morning workout with 2 sets, evening workout with 3.
  const [day] = groupByDay([
    set('2026-11-07T09:00', 60, 10, 'am'),
    set('2026-11-07T09:05', 60, 9, 'am'),
    set('2026-11-07T19:00', 65, 6, 'pm'),
    set('2026-11-07T19:04', 65, 5, 'pm'),
    set('2026-11-07T19:08', 65, 4, 'pm'),
  ]);

  it('lists the newest set first and keeps each set its number within its workout', () => {
    expect(dayRowsNewestFirst(day).map((r) => [r.sessionId, r.n, r.set.reps])).toEqual([
      ['pm', 3, 4],
      ['pm', 2, 5],
      ['pm', 1, 6],
      ['am', 2, 9],
      ['am', 1, 10],
    ]);
  });

  it('splits the shown rows by workout, the latest workout first', () => {
    const rows = dayRowsNewestFirst(day);
    expect(runsBySession(rows).map((r) => [r.sessionId, r.rows.length])).toEqual([
      ['pm', 3],
      ['am', 2],
    ]);
    // Only the first 4 shown: the morning workout is cut to its last set.
    expect(runsBySession(rows.slice(0, 4)).map((r) => [r.sessionId, r.rows.map((x) => x.n)])).toEqual([
      ['pm', [3, 2, 1]],
      ['am', [2]],
    ]);
  });
});
