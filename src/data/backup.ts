import { withDefaults } from '../core/settings';
import type { Exercise, Session, SetRecord, Settings, Workout } from '../core/types';
import { db, loadAll } from './db';
import { isObject, toExercise, toSession, toSet, toWorkout } from './validate';

export const BACKUP_APP = 'gym-up';
/** 2: an exercise has `muscles` (a list). Version 1 files with a single `muscle` still import. */
export const BACKUP_SCHEMA_VERSION = 2;

/** A plain JSON file: the user keeps it in Files, AirDrops it, or edits it by hand. */
export interface Backup {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  exportedAt: string;
  settings: Settings;
  exercises: Exercise[];
  workouts: Workout[];
  sessions: Session[];
  sets: SetRecord[];
}

export async function createBackup(now = new Date()): Promise<Backup> {
  const data = await loadAll();
  return {
    app: BACKUP_APP,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    settings: data.settings,
    exercises: data.exercises,
    workouts: data.workouts,
    sessions: data.sessions,
    sets: data.sets,
  };
}

export class BackupError extends Error {}

function parseList<T>(value: unknown, parse: (v: unknown) => T | null, what: string): T[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new BackupError(`В копии повреждён раздел «${what}».`);
  const items = value.map(parse);
  if (items.some((i) => i === null)) throw new BackupError(`В копии есть повреждённые записи: ${what}.`);
  return items as T[];
}

/** Last one wins when an id repeats. */
function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((i) => [i.id, i])).values()];
}

export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('Файл не похож на резервную копию: это не JSON.');
  }
  if (!isObject(data) || data.app !== BACKUP_APP) throw new BackupError('Это не резервная копия Gym Up.');
  if (typeof data.schemaVersion !== 'number' || data.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new BackupError('Копия сделана более новой версией приложения. Сначала обновите Gym Up.');
  }

  const exercises = uniqueById(parseList(data.exercises, toExercise, 'упражнения'));
  const known = new Set(exercises.map((e) => e.id));
  const workouts = uniqueById(parseList(data.workouts, toWorkout, 'тренировки'))
    .sort((a, b) => a.order - b.order)
    .map((w, i) => ({ ...w, order: i, exerciseIds: w.exerciseIds.filter((id) => known.has(id)) }));
  const sessions = uniqueById(parseList(data.sessions, toSession, 'история тренировок')).sort(
    (a, b) => a.startedAt - b.startedAt,
  );
  // A set of an exercise that isn't in the file has nowhere to show up.
  const sets = uniqueById(parseList(data.sets, toSet, 'подходы'))
    .filter((s) => known.has(s.exerciseId))
    .sort((a, b) => a.doneAt - b.doneAt);

  return {
    app: BACKUP_APP,
    schemaVersion: data.schemaVersion,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
    settings: withDefaults(data.settings),
    exercises,
    workouts,
    sessions,
    sets,
  };
}

/** Replace all local data with the backup. A workout in progress is dropped. */
export function restoreBackup(backup: Backup) {
  const tables = [db.exercises, db.workouts, db.sessions, db.sets, db.kv];
  return db.transaction('rw', tables, async () => {
    await Promise.all(tables.map((t) => t.clear()));
    await db.kv.put({ key: 'settings', value: backup.settings });
    await db.exercises.bulkPut(backup.exercises);
    await db.workouts.bulkPut(backup.workouts);
    await db.sessions.bulkPut(backup.sessions);
    await db.sets.bulkPut(backup.sets);
  });
}

export function backupFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `gym-up-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}
