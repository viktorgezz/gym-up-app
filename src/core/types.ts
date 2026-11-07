import type { MuscleId } from './muscles';

export interface Exercise {
  id: string;
  name: string;
  /** One or more groups, from the top of the body down. */
  muscles: MuscleId[];
  /** Logged with a weight in kg; bodyweight exercises log reps only. */
  weighted: boolean;
  /** Rest last started after this exercise, seconds: offered first next time. */
  restSec?: number;
  createdAt: number;
}

/** A named, ordered list of exercises. One exercise can be in many workouts. */
export interface Workout {
  id: string;
  name: string;
  /** Exercises in the order they are done. */
  exerciseIds: string[];
  /** Position in the list on the main screen. */
  order: number;
  createdAt: number;
}

/**
 * One set. It belongs to the exercise, not to a workout: the history of an exercise is
 * the same whichever workout it was done in.
 */
export interface SetRecord {
  id: string;
  exerciseId: string;
  reps: number;
  /** kg; null for bodyweight exercises. */
  weight: number | null;
  doneAt: number;
  /** The workout session it was logged in; absent when logged outside a workout. */
  sessionId?: string;
}

/** One run of a workout, from Start to Finish. */
export interface Session {
  id: string;
  workoutId: string;
  /** Name at the time, so history still reads right after a rename or a delete. */
  workoutName: string;
  startedAt: number;
  finishedAt: number | null;
}

/** A rest is stored as its end time, so it stays right while iOS freezes the app. */
export interface Rest {
  startedAt: number;
  endsAt: number;
}

/** The workout in progress. Persisted, so it survives iOS unloading the app in the background. */
export interface ActiveWorkout {
  sessionId: string;
  workoutId: string;
  workoutName: string;
  /** Taken from the workout at start; exercises can be added for this session only. */
  exerciseIds: string[];
  index: number;
  startedAt: number;
  rest: Rest | null;
}

export interface Settings {
  soundOn: boolean;
  /** Keep the screen on while a workout is running. */
  keepAwake: boolean;
  /** kg added or removed by the ± buttons. */
  weightStep: number;
  /** Rest offered for an exercise that has none of its own yet, seconds. */
  defaultRestSec: number;
}
