import type { SetRecord } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local midnight of the day a timestamp falls on: the key sets are grouped by. */
export function dayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Calendar days from `from` to `to` (DST-safe). */
export function daysBetween(from: number, to: number): number {
  return Math.round((dayStart(to) - dayStart(from)) / DAY_MS);
}

export function setVolume(s: SetRecord): number {
  return (s.weight ?? 0) * s.reps;
}

export interface SessionPart {
  /** null: logged outside a workout. */
  sessionId: string | null;
  sets: SetRecord[];
}

export interface DayGroup {
  day: number;
  /** Sets in the order they were done, split by workout when the exercise was done in several that day. */
  parts: SessionPart[];
  sets: number;
  reps: number;
  volume: number;
  maxWeight: number | null;
  maxReps: number;
}

/** History of one exercise by day, newest day first. Expects sets oldest first. */
export function groupByDay(sets: readonly SetRecord[]): DayGroup[] {
  const days: DayGroup[] = [];
  let current: DayGroup | null = null;
  for (const s of sets) {
    const day = dayStart(s.doneAt);
    if (!current || current.day !== day) {
      current = { day, parts: [], sets: 0, reps: 0, volume: 0, maxWeight: null, maxReps: 0 };
      days.push(current);
    }
    const sessionId = s.sessionId ?? null;
    const part = current.parts.find((p) => p.sessionId === sessionId);
    if (part) part.sets.push(s);
    else current.parts.push({ sessionId, sets: [s] });
    current.sets += 1;
    current.reps += s.reps;
    current.volume += setVolume(s);
    if (s.weight !== null) current.maxWeight = Math.max(current.maxWeight ?? 0, s.weight);
    current.maxReps = Math.max(current.maxReps, s.reps);
  }
  return days.reverse();
}

export interface DayRow {
  set: SetRecord;
  /** Number of the set within its workout that day, 1 = first: the latest of 12 sets stays 12. */
  n: number;
  sessionId: string | null;
}

/** A day's sets for the history list: newest first, each keeping its number. */
export function dayRowsNewestFirst(day: DayGroup): DayRow[] {
  const rows = day.parts.flatMap((part) => part.sets.map((set, i) => ({ set, n: i + 1, sessionId: part.sessionId })));
  return rows.sort((a, b) => b.set.doneAt - a.set.doneAt);
}

export interface RowRun {
  sessionId: string | null;
  rows: DayRow[];
}

/** Consecutive rows of the same workout, so each workout of the day gets its own heading. */
export function runsBySession(rows: readonly DayRow[]): RowRun[] {
  const runs: RowRun[] = [];
  for (const row of rows) {
    const last = runs[runs.length - 1];
    if (last && last.sessionId === row.sessionId) last.rows.push(row);
    else runs.push({ sessionId: row.sessionId, rows: [row] });
  }
  return runs;
}

/** Heavier wins, at the same weight more reps. Bodyweight: more reps. */
export function isBetterSet(a: SetRecord, b: SetRecord | null, weighted: boolean): boolean {
  if (!b) return true;
  if (weighted) {
    const wa = a.weight ?? 0;
    const wb = b.weight ?? 0;
    if (wa !== wb) return wa > wb;
  }
  return a.reps > b.reps;
}

/** The best set; the earliest one when several are equal. */
export function bestSet(sets: readonly SetRecord[], weighted: boolean): SetRecord | null {
  let best: SetRecord | null = null;
  for (const s of sets) if (isBetterSet(s, best, weighted)) best = s;
  return best;
}

/** Sets of one performance belong together: the same workout session, or the same day outside a workout. */
function performanceKey(s: SetRecord): string {
  return s.sessionId ?? `day:${dayStart(s.doneAt)}`;
}

/**
 * Sets of the latest performance of an exercise before the given session ("last time").
 * Expects sets oldest first.
 */
export function lastPerformance(sets: readonly SetRecord[], excludeSessionId?: string | null): SetRecord[] {
  for (let i = sets.length - 1; i >= 0; i--) {
    const s = sets[i];
    if (excludeSessionId && s.sessionId === excludeSessionId) continue;
    const key = performanceKey(s);
    return sets.filter((x) => performanceKey(x) === key);
  }
  return [];
}

/** The session's best set beats every earlier set, and there were earlier sets to beat. */
export function isPersonalRecord(sessionSets: readonly SetRecord[], earlierSets: readonly SetRecord[], weighted: boolean): boolean {
  const best = bestSet(sessionSets, weighted);
  const before = bestSet(earlierSets, weighted);
  return best !== null && before !== null && isBetterSet(best, before, weighted);
}

export type Metric = 'maxWeight' | 'volume' | 'maxReps' | 'totalReps';

export interface SeriesPoint {
  day: number;
  value: number;
}

/** One value per training day, oldest first. */
export function dailySeries(days: readonly DayGroup[], metric: Metric): SeriesPoint[] {
  return days
    .slice()
    .reverse()
    .map((d) => ({
      day: d.day,
      value:
        metric === 'maxWeight' ? (d.maxWeight ?? 0) : metric === 'volume' ? d.volume : metric === 'maxReps' ? d.maxReps : d.reps,
    }));
}
