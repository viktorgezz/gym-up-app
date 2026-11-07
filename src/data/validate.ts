import { MAX_NAME, MAX_REPS, MAX_WEIGHT } from '../core/limits';
import { isMuscleId, sortMuscles, type MuscleId } from '../core/muscles';
import { clampRestSec } from '../core/rest';
import type { ActiveWorkout, Exercise, Session, SetRecord, Workout } from '../core/types';

/**
 * Checks for data that comes from outside the app's own writes: a backup file, or a
 * stored record from an older version. Each returns a clean copy, or null when the
 * value can't be used.
 */

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 100;
const isName = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const cleanName = (s: string) => s.trim().slice(0, MAX_NAME);

/**
 * The exercise's groups. Data from version 1 (backups made before several groups were
 * allowed) has a single `muscle` instead.
 */
export function toMuscles(v: Record<string, unknown>): MuscleId[] | null {
  const raw: unknown[] | null = Array.isArray(v.muscles) ? v.muscles : v.muscle !== undefined ? [v.muscle] : null;
  if (!raw || raw.length === 0 || !raw.every(isMuscleId)) return null;
  return sortMuscles(raw);
}

export function toExercise(v: unknown): Exercise | null {
  if (!isObject(v) || !isId(v.id) || !isName(v.name) || typeof v.weighted !== 'boolean') return null;
  const muscles = toMuscles(v);
  if (!muscles) return null;
  return {
    id: v.id,
    name: cleanName(v.name),
    muscles,
    weighted: v.weighted,
    createdAt: isNum(v.createdAt) ? v.createdAt : 0,
    ...(isNum(v.restSec) && { restSec: clampRestSec(v.restSec) }),
  };
}

export function toWorkout(v: unknown): Workout | null {
  if (!isObject(v) || !isId(v.id) || !isName(v.name) || !Array.isArray(v.exerciseIds) || !v.exerciseIds.every(isId)) {
    return null;
  }
  return {
    id: v.id,
    name: cleanName(v.name),
    exerciseIds: [...new Set(v.exerciseIds as string[])],
    order: isNum(v.order) ? v.order : 0,
    createdAt: isNum(v.createdAt) ? v.createdAt : 0,
  };
}

export function toSession(v: unknown): Session | null {
  if (!isObject(v) || !isId(v.id) || !isId(v.workoutId) || !isNum(v.startedAt)) return null;
  if (v.finishedAt !== null && !isNum(v.finishedAt)) return null;
  return {
    id: v.id,
    workoutId: v.workoutId,
    workoutName: typeof v.workoutName === 'string' ? cleanName(v.workoutName) : '',
    startedAt: v.startedAt,
    finishedAt: v.finishedAt as number | null,
  };
}

export function toSet(v: unknown): SetRecord | null {
  if (!isObject(v) || !isId(v.id) || !isId(v.exerciseId) || !isNum(v.doneAt)) return null;
  if (!Number.isInteger(v.reps) || (v.reps as number) < 1 || (v.reps as number) > MAX_REPS) return null;
  if (v.weight !== null && !(isNum(v.weight) && v.weight >= 0 && v.weight <= MAX_WEIGHT)) return null;
  if (v.sessionId !== undefined && !isId(v.sessionId)) return null;
  return {
    id: v.id,
    exerciseId: v.exerciseId,
    reps: v.reps as number,
    weight: v.weight as number | null,
    doneAt: v.doneAt,
    ...(v.sessionId !== undefined && { sessionId: v.sessionId as string }),
  };
}

/** The stored in-progress workout; dropped if a newer or broken version wrote something else. */
export function toActive(v: unknown): ActiveWorkout | null {
  if (!isObject(v) || !isId(v.sessionId) || !isId(v.workoutId) || !isNum(v.startedAt)) return null;
  if (!Array.isArray(v.exerciseIds) || !v.exerciseIds.every(isId) || !Number.isInteger(v.index)) return null;
  const rest =
    isObject(v.rest) && isNum(v.rest.startedAt) && isNum(v.rest.endsAt)
      ? { startedAt: v.rest.startedAt, endsAt: v.rest.endsAt }
      : null;
  const ids = v.exerciseIds as string[];
  return {
    sessionId: v.sessionId,
    workoutId: v.workoutId,
    workoutName: typeof v.workoutName === 'string' ? v.workoutName : '',
    exerciseIds: ids,
    index: Math.min(Math.max(0, v.index as number), Math.max(0, ids.length - 1)),
    startedAt: v.startedAt,
    rest,
  };
}
