import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/settings';
import type { Exercise, Session, SetRecord, Workout } from '../core/types';
import { BACKUP_SCHEMA_VERSION, BackupError, createBackup, parseBackup, restoreBackup } from './backup';
import { GymDB, beginSession, endSession, loadAll, putExercise, putSet, putWorkout, resetAll, saveSettings } from './db';

const bench: Exercise = {
  id: 'bench',
  name: 'Жим лёжа',
  muscles: ['chest', 'triceps'],
  weighted: true,
  createdAt: 1,
};
const pullups: Exercise = { id: 'pullups', name: 'Подтягивания', muscles: ['back'], weighted: false, createdAt: 2 };
const upper: Workout = { id: 'upper', name: 'Верх', exerciseIds: ['bench', 'pullups'], order: 0, createdAt: 3 };
const session: Session = { id: 's1', workoutId: 'upper', workoutName: 'Верх', startedAt: 1000, finishedAt: null };
const sets: SetRecord[] = [
  { id: 'a', exerciseId: 'bench', reps: 10, weight: 60, doneAt: 1100, sessionId: 's1' },
  { id: 'b', exerciseId: 'pullups', reps: 12, weight: null, doneAt: 1200, sessionId: 's1' },
];

async function seed() {
  await putExercise(bench);
  await putExercise(pullups);
  await putWorkout(upper);
  await beginSession(session, {
    sessionId: 's1',
    workoutId: 'upper',
    workoutName: 'Верх',
    exerciseIds: ['bench', 'pullups'],
    index: 1,
    startedAt: 1000,
    rest: { startedAt: 1200, endsAt: 91_200 },
  });
  for (const s of sets) await putSet(s);
}

const file = (extra: object) =>
  JSON.stringify({
    app: 'gym-up',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exercises: [bench],
    workouts: [],
    sessions: [],
    sets: [],
    ...extra,
  });

beforeEach(() => resetAll());

describe('db', () => {
  it('keeps the workout in progress, rest included, until it ends', async () => {
    await seed();
    expect((await loadAll()).active).toMatchObject({ index: 1, rest: { endsAt: 91_200 } });
    await endSession({ ...session, finishedAt: 2000 });
    const data = await loadAll();
    expect(data.active).toBeNull();
    expect(data.sessions[0].finishedAt).toBe(2000);
  });

  it('moves exercises stored with one muscle group to a list of groups', async () => {
    // A database written by the first version: one `muscle` per exercise.
    const old = new Dexie('gym-up-migration');
    old.version(1).stores({ exercises: 'id', workouts: 'id', sessions: 'id, workoutId', sets: 'id, exerciseId, sessionId, doneAt', kv: 'key' });
    await old.table('exercises').bulkPut([
      { id: 'squat', name: 'Присед', muscle: 'legs', weighted: true, createdAt: 1 },
      { id: 'odd', name: 'Странное', muscle: 'neck', weighted: true, createdAt: 2 },
    ]);
    old.close();

    const upgraded = new GymDB('gym-up-migration');
    const rows = await upgraded.exercises.toArray();
    upgraded.close();
    expect(rows.find((e) => e.id === 'squat')).toEqual({ id: 'squat', name: 'Присед', muscles: ['legs'], weighted: true, createdAt: 1 });
    // An unknown group is dropped, not the exercise: it stays findable under "Без группы".
    expect(rows.find((e) => e.id === 'odd')?.muscles).toEqual([]);
  });
});

describe('backup', () => {
  it('round-trips through JSON', async () => {
    await seed();
    await saveSettings({ ...DEFAULT_SETTINGS, weightStep: 1.25 });
    const json = JSON.stringify(await createBackup());

    await resetAll();
    await restoreBackup(parseBackup(json));

    const data = await loadAll();
    expect(data.exercises.find((e) => e.id === 'bench')?.muscles).toEqual(['chest', 'triceps']);
    expect(data.workouts[0].exerciseIds).toEqual(['bench', 'pullups']);
    expect(data.sets).toEqual(sets);
    expect(data.sessions.map((s) => s.id)).toEqual(['s1']);
    expect(data.settings.weightStep).toBe(1.25);
    // The workout in progress is not part of a backup.
    expect(data.active).toBeNull();
  });

  it('imports a backup from the first version, with one muscle group per exercise', () => {
    const v1 = JSON.stringify({
      app: 'gym-up',
      schemaVersion: 1,
      exercises: [{ id: 'bench', name: 'Жим лёжа', muscle: 'chest', weighted: true, createdAt: 1 }],
      workouts: [],
      sessions: [],
      sets: [],
    });
    expect(parseBackup(v1).exercises[0].muscles).toEqual(['chest']);
  });

  it('keeps groups in order from the top of the body down', () => {
    const backup = parseBackup(file({ exercises: [{ ...bench, muscles: ['triceps', 'chest', 'triceps'] }] }));
    expect(backup.exercises[0].muscles).toEqual(['chest', 'triceps']);
  });

  it('rejects foreign or broken files', () => {
    expect(() => parseBackup('nope')).toThrow(BackupError);
    expect(() => parseBackup('{"app":"other"}')).toThrow(/не резервная копия/);
    expect(() => parseBackup(file({ schemaVersion: 99 }))).toThrow(/более новой версией/);
    expect(() => parseBackup(file({ exercises: [{ ...bench, muscles: ['neck'] }] }))).toThrow(/упражнения/);
    expect(() => parseBackup(file({ exercises: [{ ...bench, muscles: [] }] }))).toThrow(/упражнения/);
    expect(() => parseBackup(file({ sets: [{ id: 's', exerciseId: 'bench', reps: 0, weight: 10, doneAt: 1 }] }))).toThrow(
      /подходы/,
    );
  });

  it('drops references to exercises that are not in the file', () => {
    const backup = parseBackup(
      file({
        workouts: [{ ...upper }],
        sets: [
          { id: 'a', exerciseId: 'bench', reps: 5, weight: 80, doneAt: 1 },
          { id: 'b', exerciseId: 'gone', reps: 5, weight: 80, doneAt: 2 },
        ],
      }),
    );
    expect(backup.workouts[0].exerciseIds).toEqual(['bench']);
    expect(backup.sets.map((s) => s.id)).toEqual(['a']);
  });

  it('falls back to default settings for malformed values', () => {
    const backup = parseBackup(file({ settings: { soundOn: 'yes', weightStep: 3, defaultRestSec: 'x' } }));
    expect(backup.settings).toEqual(DEFAULT_SETTINGS);
  });
});
