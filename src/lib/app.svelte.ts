import { newId } from '../core/ids';
import { sortMuscles, type MuscleId } from '../core/muscles';
import { adjustRest as adjustRestFn, clampRestSec, startRest as startRestFn } from '../core/rest';
import { DEFAULT_SETTINGS } from '../core/settings';
import { lastPerformance } from '../core/stats';
import type { ActiveWorkout, Exercise, Session, SetRecord, Settings, Workout } from '../core/types';
import { restoreBackup, type Backup } from '../data/backup';
import * as store from '../data/db';
import { playGo, playSaved, playTick, unlockAudio } from '../services/audio';
import { isStandalone, requestPersistentStorage } from '../services/device';

export type Tab = 'workouts' | 'exercises' | 'settings';
export type Route = { name: 'workout'; id: string } | { name: 'exercise'; id: string };
/** tabs: the regular app; active: the workout screen; summary: after Finish. */
export type Mode = 'tabs' | 'active' | 'summary';

export const TAB_TITLES: Record<Tab, string> = {
  workouts: 'Тренировки',
  exercises: 'Упражнения',
  settings: 'Настройки',
};

/** A workout started longer ago than this isn't reopened at launch; the mini bar offers it instead. */
export const STALE_ACTIVE_MS = 6 * 60 * 60 * 1000;
/** How long "Rest is over" stays on screen. */
export const REST_NOTICE_MS = 10_000;

export interface ExerciseInput {
  name: string;
  muscles: readonly MuscleId[];
  weighted: boolean;
}

const EMPTY_STACKS: Record<Tab, Route[]> = { workouts: [], exercises: [], settings: [] };
const NO_SETS: readonly SetRecord[] = [];

function groupSets(sets: readonly SetRecord[]): Map<string, SetRecord[]> {
  const map = new Map<string, SetRecord[]>();
  for (const s of sets) {
    let list = map.get(s.exerciseId);
    if (!list) map.set(s.exerciseId, (list = []));
    list.push(s);
  }
  return map;
}

class AppStore {
  ready = $state(false);
  /** Set when local storage could not be opened; the app can't work without it. */
  error = $state<string | null>(null);
  standalone = $state(false);

  mode = $state<Mode>('tabs');
  tab = $state<Tab>('workouts');
  /** Screens opened on top of each tab, like a navigation stack in an iOS tab. */
  stacks = $state.raw<Record<Tab, Route[]>>(EMPTY_STACKS);

  // Raw state: replaced as a whole, never mutated, so it can go to IndexedDB as-is.
  settings = $state.raw<Settings>(DEFAULT_SETTINGS);
  exercises = $state.raw<Exercise[]>([]);
  /** Sorted by `order`. */
  workouts = $state.raw<Workout[]>([]);
  /** Oldest first. */
  sessions = $state.raw<Session[]>([]);
  /** Every logged set, oldest first. */
  sets = $state.raw<SetRecord[]>([]);
  active = $state.raw<ActiveWorkout | null>(null);
  summaryId = $state<string | null>(null);

  /** Wall clock for the countdown and the workout time; App ticks it while a workout runs. */
  now = $state(Date.now());
  /** The rest that just ended: "Rest is over" stays visible for a while. */
  restNotice = $state.raw<{ endedAt: number; shownAt: number } | null>(null);
  toast = $state.raw<{ id: number; text: string } | null>(null);

  exerciseById = $derived(new Map(this.exercises.map((e) => [e.id, e] as const)));
  sessionById = $derived(new Map(this.sessions.map((s) => [s.id, s] as const)));
  /** Each exercise's history, oldest first. */
  setsByExercise = $derived(groupSets(this.sets));
  route = $derived(this.stacks[this.tab].at(-1) ?? null);

  private finishing = false;
  private storageAsked = false;
  private toastSeq = 0;

  async init() {
    try {
      this.standalone = isStandalone();
      const data = await store.loadAll();
      this.settings = data.settings;
      this.exercises = data.exercises;
      this.workouts = data.workouts;
      this.sessions = data.sessions;
      this.sets = data.sets;
      this.active = data.active;
      this.restNotice = null;
      this.stacks = EMPTY_STACKS;
      this.now = Date.now();
      // After iOS unloaded the app mid-workout, open straight back into it.
      this.mode = data.active && !this.isStale(data.active) ? 'active' : 'tabs';
      this.ready = true;
    } catch (err) {
      console.error(err);
      this.error = 'Не удалось открыть данные тренировок на этом устройстве.';
    }
  }

  isStale(a: ActiveWorkout, now = Date.now()): boolean {
    return now - a.startedAt > STALE_ACTIVE_MS;
  }

  // --- navigation ----------------------------------------------------------

  selectTab(tab: Tab) {
    if (this.tab !== tab) this.tab = tab;
    // A tap on the current tab goes back to its first screen, as on iOS.
    else if (this.stacks[tab].length > 0) this.setStack(tab, []);
  }

  private setStack(tab: Tab, routes: Route[]) {
    this.stacks = { ...this.stacks, [tab]: routes };
  }

  push(route: Route) {
    this.setStack(this.tab, [...this.stacks[this.tab], route]);
  }

  back() {
    const stack = this.stacks[this.tab];
    if (stack.length > 0) this.setStack(this.tab, stack.slice(0, -1));
  }

  openWorkout(id: string) {
    this.push({ name: 'workout', id });
  }

  openExercise(id: string) {
    this.push({ name: 'exercise', id });
  }

  /** Title of the screen Back returns to. */
  get backLabel(): string {
    const prev = this.stacks[this.tab].at(-2);
    if (prev?.name === 'workout') return this.workouts.find((w) => w.id === prev.id)?.name ?? 'Назад';
    if (prev?.name === 'exercise') return this.exerciseById.get(prev.id)?.name ?? 'Назад';
    return TAB_TITLES[this.tab];
  }

  /** Close screens of something that was deleted (and everything opened from them). */
  private dropRoutes(match: (r: Route) => boolean) {
    let changed = false;
    const next = { ...this.stacks };
    for (const tab of Object.keys(next) as Tab[]) {
      const i = next[tab].findIndex(match);
      if (i >= 0) {
        next[tab] = next[tab].slice(0, i);
        changed = true;
      }
    }
    if (changed) this.stacks = next;
  }

  // --- reading -------------------------------------------------------------

  historyOf(exerciseId: string): readonly SetRecord[] {
    return this.setsByExercise.get(exerciseId) ?? NO_SETS;
  }

  lastSetOf(exerciseId: string): SetRecord | null {
    return this.historyOf(exerciseId).at(-1) ?? null;
  }

  /** The latest run of a workout that has at least one set. */
  lastSessionOf(workoutId: string): Session | null {
    for (let i = this.sessions.length - 1; i >= 0; i--) {
      const s = this.sessions[i];
      if (s.workoutId === workoutId && s.id !== this.active?.sessionId && s.finishedAt !== null) return s;
    }
    return null;
  }

  /** Values to prefill a new set with: the previous set today, else the first set last time. */
  suggestSet(exerciseId: string): { weight: number | null; reps: number | null } {
    const history = this.historyOf(exerciseId);
    const sessionId = this.active?.sessionId ?? null;
    const today = sessionId ? history.filter((s) => s.sessionId === sessionId) : [];
    const source = today.at(-1) ?? lastPerformance(history, sessionId)[0];
    return source ? { weight: source.weight, reps: source.reps } : { weight: null, reps: null };
  }

  // --- writing -------------------------------------------------------------

  /** The UI is updated first; a failed write (e.g. the disk is full) is reported, not hidden. */
  private async write(op: Promise<unknown>) {
    try {
      await op;
    } catch (err) {
      console.error(err);
      this.showToast('Не удалось сохранить. Проверьте свободное место на iPhone.');
    }
  }

  private protectStorage() {
    if (this.storageAsked) return;
    this.storageAsked = true;
    void requestPersistentStorage();
  }

  showToast(text: string) {
    const id = ++this.toastSeq;
    this.toast = { id, text };
    setTimeout(() => {
      if (this.toast?.id === id) this.toast = null;
    }, 2200);
  }

  // --- exercises -----------------------------------------------------------

  async createExercise(input: ExerciseInput): Promise<Exercise> {
    const exercise: Exercise = {
      id: newId(),
      name: input.name.trim(),
      muscles: sortMuscles(input.muscles),
      weighted: input.weighted,
      createdAt: Date.now(),
    };
    this.exercises = [...this.exercises, exercise];
    await this.write(store.putExercise(exercise));
    this.protectStorage();
    return exercise;
  }

  async updateExercise(id: string, patch: Partial<ExerciseInput> & { restSec?: number }) {
    const current = this.exerciseById.get(id);
    if (!current) return;
    const next: Exercise = {
      ...current,
      ...(patch.name !== undefined && { name: patch.name.trim() }),
      ...(patch.muscles !== undefined && { muscles: sortMuscles(patch.muscles) }),
      ...(patch.weighted !== undefined && { weighted: patch.weighted }),
      ...(patch.restSec !== undefined && { restSec: patch.restSec }),
    };
    this.exercises = this.exercises.map((e) => (e.id === id ? next : e));
    await this.write(store.putExercise(next));
  }

  /** Removes the exercise with its history, from every workout and from the running one. */
  async deleteExercise(id: string) {
    const changed: Workout[] = [];
    this.workouts = this.workouts.map((w) => {
      if (!w.exerciseIds.includes(id)) return w;
      const next = { ...w, exerciseIds: w.exerciseIds.filter((x) => x !== id) };
      changed.push(next);
      return next;
    });
    this.exercises = this.exercises.filter((e) => e.id !== id);
    this.sets = this.sets.filter((s) => s.exerciseId !== id);

    const a = this.active;
    if (a?.exerciseIds.includes(id)) {
      const removedAt = a.exerciseIds.indexOf(id);
      const exerciseIds = a.exerciseIds.filter((x) => x !== id);
      const index = Math.min(removedAt < a.index ? a.index - 1 : a.index, Math.max(0, exerciseIds.length - 1));
      this.setActive({ ...a, exerciseIds, index });
    }
    this.dropRoutes((r) => r.name === 'exercise' && r.id === id);
    await this.write(store.deleteExerciseCascade(id, changed));
  }

  // --- workouts ------------------------------------------------------------

  async createWorkout(name: string, exerciseIds: string[]): Promise<Workout> {
    const workout: Workout = {
      id: newId(),
      name: name.trim(),
      exerciseIds: [...exerciseIds],
      order: this.workouts.reduce((max, w) => Math.max(max, w.order), -1) + 1,
      createdAt: Date.now(),
    };
    this.workouts = [...this.workouts, workout];
    await this.write(store.putWorkout(workout));
    this.protectStorage();
    return workout;
  }

  async updateWorkout(id: string, patch: { name?: string; exerciseIds?: string[] }) {
    const current = this.workouts.find((w) => w.id === id);
    if (!current) return;
    const next: Workout = {
      ...current,
      ...(patch.name !== undefined && { name: patch.name.trim() }),
      ...(patch.exerciseIds && { exerciseIds: [...patch.exerciseIds] }),
    };
    this.workouts = this.workouts.map((w) => (w.id === id ? next : w));
    await this.write(store.putWorkout(next));
  }

  /** The exercises and their history stay; past sessions keep the workout's name. */
  async deleteWorkout(id: string) {
    this.workouts = this.workouts.filter((w) => w.id !== id);
    this.dropRoutes((r) => r.name === 'workout' && r.id === id);
    await this.write(store.deleteWorkout(id));
  }

  async reorderWorkouts(ordered: Workout[]) {
    const next = ordered.map((w, i) => (w.order === i ? w : { ...w, order: i }));
    this.workouts = next;
    await this.write(store.putWorkouts(next.filter((w, i) => w !== ordered[i])));
  }

  // --- sets ----------------------------------------------------------------

  /** Saves a set to the exercise's history (and to the running workout, if there is one). */
  async logSet(exerciseId: string, reps: number, weight: number | null): Promise<SetRecord> {
    const set: SetRecord = {
      id: newId(),
      exerciseId,
      reps,
      weight,
      doneAt: Date.now(),
      ...(this.active && { sessionId: this.active.sessionId }),
    };
    this.sets = [...this.sets, set];
    this.restNotice = null;
    if (this.active && this.settings.soundOn) {
      unlockAudio();
      playSaved();
    }
    await this.write(store.putSet(set));
    this.protectStorage();
    return set;
  }

  async updateSet(id: string, patch: { reps: number; weight: number | null }) {
    const current = this.sets.find((s) => s.id === id);
    if (!current) return;
    const next = { ...current, ...patch };
    this.sets = this.sets.map((s) => (s.id === id ? next : s));
    await this.write(store.putSet(next));
  }

  async deleteSet(id: string) {
    this.sets = this.sets.filter((s) => s.id !== id);
    await this.write(store.deleteSet(id));
  }

  // --- workout in progress -------------------------------------------------

  /** With Sounds off the app never opens an audio session, so it can't touch music playing in another app. */
  unlockSound() {
    if (this.settings.soundOn) unlockAudio();
  }

  private setActive(a: ActiveWorkout | null) {
    this.active = a;
    void this.write(a ? store.saveActive(a) : store.clearActive());
  }

  async startWorkout(workoutId: string) {
    const workout = this.workouts.find((w) => w.id === workoutId);
    if (!workout || this.active) return;
    const now = Date.now();
    const session: Session = { id: newId(), workoutId, workoutName: workout.name, startedAt: now, finishedAt: null };
    const active: ActiveWorkout = {
      sessionId: session.id,
      workoutId,
      workoutName: workout.name,
      exerciseIds: workout.exerciseIds.filter((id) => this.exerciseById.has(id)),
      index: 0,
      startedAt: now,
      rest: null,
    };
    this.unlockSound();
    this.sessions = [...this.sessions, session];
    this.active = active;
    this.restNotice = null;
    this.now = now;
    this.mode = 'active';
    await this.write(store.beginSession(session, active));
    this.protectStorage();
  }

  resume() {
    if (!this.active) return;
    this.unlockSound();
    this.now = Date.now();
    this.mode = 'active';
  }

  /** Back to the tabs; the workout keeps running in the mini bar. */
  minimize() {
    this.mode = 'tabs';
  }

  goToExercise(index: number) {
    const a = this.active;
    if (!a || index === a.index || index < 0 || index >= a.exerciseIds.length) return;
    this.setActive({ ...a, index });
  }

  nextExercise() {
    if (this.active) this.goToExercise(this.active.index + 1);
  }

  /** Extra exercises for this session only; the workout itself is not changed. Opens the first one. */
  addToSession(ids: string[]) {
    const a = this.active;
    if (!a) return;
    const fresh = ids.filter((id) => !a.exerciseIds.includes(id) && this.exerciseById.has(id));
    if (fresh.length === 0) return;
    this.setActive({ ...a, exerciseIds: [...a.exerciseIds, ...fresh], index: a.exerciseIds.length });
  }

  startRest(sec: number) {
    const a = this.active;
    if (!a) return;
    this.unlockSound();
    const seconds = clampRestSec(sec);
    const now = Date.now();
    this.restNotice = null;
    this.now = now;
    this.setActive({ ...a, rest: startRestFn(now, seconds) });
    // Remember it for this exercise: the timer offers it first next time.
    const exercise = this.exerciseById.get(a.exerciseIds[a.index] ?? '');
    if (exercise && exercise.restSec !== seconds) void this.updateExercise(exercise.id, { restSec: seconds });
  }

  adjustRest(deltaSec: number) {
    const a = this.active;
    if (!a?.rest) return;
    this.unlockSound();
    this.setActive({ ...a, rest: adjustRestFn(a.rest, deltaSec, Date.now()) });
  }

  skipRest() {
    const a = this.active;
    if (a?.rest) this.setActive({ ...a, rest: null });
  }

  /** 3-2-1 before the end of a rest. */
  restTick() {
    if (this.settings.soundOn && document.visibilityState === 'visible') playTick();
  }

  /**
   * Called by the clock once the rest is over. Beeps only if the end is happening right now
   * on screen: after coming back from another app, a late beep would just be confusing.
   */
  restElapsed() {
    const a = this.active;
    if (!a?.rest) return;
    const now = Date.now();
    const overdue = now - a.rest.endsAt;
    if (overdue < 0) return;
    if (this.settings.soundOn && overdue < 3000 && document.visibilityState === 'visible') playGo();
    this.restNotice = { endedAt: a.rest.endsAt, shownAt: now };
    this.setActive({ ...a, rest: null });
  }

  dismissRestNotice() {
    this.restNotice = null;
  }

  /**
   * Ends the workout. Sets were saved as they were logged, so nothing else is written
   * except the session's end. A workout without sets leaves no trace.
   */
  async finishWorkout({ summary = true } = {}) {
    const a = this.active;
    if (!a || this.finishing) return;
    this.finishing = true;
    try {
      const now = Date.now();
      const sessionSets = this.sets.filter((s) => s.sessionId === a.sessionId);
      this.active = null;
      this.restNotice = null;

      if (sessionSets.length === 0) {
        this.sessions = this.sessions.filter((s) => s.id !== a.sessionId);
        this.mode = 'tabs';
        await this.write(store.discardSession(a.sessionId));
        return;
      }

      const base: Session = this.sessionById.get(a.sessionId) ?? {
        id: a.sessionId,
        workoutId: a.workoutId,
        workoutName: a.workoutName,
        startedAt: a.startedAt,
        finishedAt: null,
      };
      // Forgotten overnight: it ended with its last set, not when it was closed.
      const finishedAt = this.isStale(a, now) ? sessionSets[sessionSets.length - 1].doneAt : now;
      const session: Session = { ...base, finishedAt };
      this.sessions = this.sessionById.has(session.id)
        ? this.sessions.map((s) => (s.id === session.id ? session : s))
        : [...this.sessions, session];
      this.summaryId = summary ? session.id : null;
      this.mode = summary ? 'summary' : 'tabs';
      await this.write(store.endSession(session));
    } finally {
      this.finishing = false;
    }
  }

  closeSummary() {
    this.summaryId = null;
    this.mode = 'tabs';
  }

  // --- settings & data -----------------------------------------------------

  async updateSettings(patch: Partial<Settings>) {
    this.settings = { ...this.settings, ...patch };
    await this.write(store.saveSettings(this.settings));
  }

  async importBackup(backup: Backup) {
    await restoreBackup(backup);
    this.summaryId = null;
    await this.init();
    this.protectStorage();
  }

  async resetEverything() {
    await store.resetAll();
    this.summaryId = null;
    await this.init();
  }
}

export const app = new AppStore();
