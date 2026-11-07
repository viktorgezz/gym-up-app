import Dexie, { type EntityTable } from 'dexie';
import { withDefaults } from '../core/settings';
import type { ActiveWorkout, Exercise, Session, SetRecord, Settings, Workout } from '../core/types';
import { toActive, toMuscles } from './validate';

type KvKey = 'settings' | 'active';

interface KvRow {
  key: KvKey;
  value: unknown;
}

const SCHEMA = {
  exercises: 'id',
  workouts: 'id',
  sessions: 'id, workoutId',
  sets: 'id, exerciseId, sessionId, doneAt',
  kv: 'key',
};

/** Everything lives in this IndexedDB database on the device; nothing is sent anywhere. */
export class GymDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  sets!: EntityTable<SetRecord, 'id'>;
  kv!: EntityTable<KvRow, 'key'>;

  constructor(name = 'gym-up') {
    super(name);
    this.version(1).stores(SCHEMA);
    // v2: an exercise has a list of muscle groups instead of one.
    this.version(2)
      .stores(SCHEMA)
      .upgrade((tx) =>
        tx
          .table('exercises')
          .toCollection()
          .modify((e: Record<string, unknown>) => {
            e.muscles = toMuscles(e) ?? [];
            delete e.muscle;
          }),
      );
  }
}

export const db = new GymDB();

const allTables = () => [db.exercises, db.workouts, db.sessions, db.sets, db.kv];

export interface Snapshot {
  settings: Settings;
  exercises: Exercise[];
  /** Sorted by `order`. */
  workouts: Workout[];
  /** Oldest first. */
  sessions: Session[];
  /** Oldest first. */
  sets: SetRecord[];
  active: ActiveWorkout | null;
}

export function loadAll(): Promise<Snapshot> {
  return db.transaction('r', allTables(), async () => {
    const [exercises, workouts, sessions, sets, settings, active] = await Promise.all([
      db.exercises.toArray(),
      db.workouts.toArray(),
      db.sessions.toArray(),
      db.sets.orderBy('doneAt').toArray(),
      db.kv.get('settings'),
      db.kv.get('active'),
    ]);
    return {
      settings: withDefaults(settings?.value),
      exercises,
      workouts: workouts.sort((a, b) => a.order - b.order),
      sessions: sessions.sort((a, b) => a.startedAt - b.startedAt),
      sets,
      active: toActive(active?.value),
    };
  });
}

export const saveSettings = (settings: Settings) => db.kv.put({ key: 'settings', value: settings });
export const saveActive = (active: ActiveWorkout) => db.kv.put({ key: 'active', value: active });
export const clearActive = () => db.kv.delete('active');

export const putExercise = (e: Exercise) => db.exercises.put(e);
export const putWorkout = (w: Workout) => db.workouts.put(w);
export const putWorkouts = (list: Workout[]) => db.workouts.bulkPut(list);
export const deleteWorkout = (id: string) => db.workouts.delete(id);
export const putSet = (s: SetRecord) => db.sets.put(s);
export const deleteSet = (id: string) => db.sets.delete(id);

/** The exercise, its whole history, and its place in every workout. */
export function deleteExerciseCascade(id: string, changedWorkouts: Workout[]) {
  return db.transaction('rw', db.exercises, db.workouts, db.sets, async () => {
    await db.exercises.delete(id);
    await db.sets.where('exerciseId').equals(id).delete();
    await db.workouts.bulkPut(changedWorkouts);
  });
}

export function beginSession(session: Session, active: ActiveWorkout) {
  return db.transaction('rw', db.sessions, db.kv, async () => {
    await db.sessions.put(session);
    await saveActive(active);
  });
}

export function endSession(session: Session) {
  return db.transaction('rw', db.sessions, db.kv, async () => {
    await db.sessions.put(session);
    await clearActive();
  });
}

/** A workout finished without a single set leaves nothing behind. */
export function discardSession(sessionId: string) {
  return db.transaction('rw', db.sessions, db.kv, async () => {
    await db.sessions.delete(sessionId);
    await clearActive();
  });
}

export function resetAll() {
  return db.transaction('rw', allTables(), async () => {
    await Promise.all(allTables().map((t) => t.clear()));
  });
}
