import { compareNames } from './text';

/**
 * Muscle groups from the top of the body down. The pickers and the lists of exercises
 * keep this order, so a group is found where it is on the body.
 */
export const MUSCLES = [
  { id: 'shoulders', name: 'Плечи' },
  { id: 'chest', name: 'Грудь' },
  { id: 'back', name: 'Спина' },
  { id: 'biceps', name: 'Бицепс' },
  { id: 'triceps', name: 'Трицепс' },
  { id: 'forearms', name: 'Предплечья' },
  { id: 'lowerBack', name: 'Поясница' },
  { id: 'abs', name: 'Пресс' },
  { id: 'legs', name: 'Ноги' },
  { id: 'glutes', name: 'Ягодицы' },
  { id: 'calves', name: 'Икры' },
] as const;

export type MuscleId = (typeof MUSCLES)[number]['id'];

/** Shown for an exercise without groups (only possible in data from outside the app). */
export const NO_MUSCLE_TITLE = 'Без группы';

const NAMES = new Map<string, string>(MUSCLES.map((m) => [m.id, m.name]));
const RANK = new Map<string, number>(MUSCLES.map((m, i) => [m.id, i]));

export function isMuscleId(v: unknown): v is MuscleId {
  return typeof v === 'string' && RANK.has(v);
}

export function muscleName(id: MuscleId): string {
  return NAMES.get(id) ?? id;
}

/** Position from the top of the body: 0 for shoulders. */
export function muscleRank(id: MuscleId): number {
  return RANK.get(id) ?? MUSCLES.length;
}

/** Without repeats, from the top of the body down: the order exercises store their groups in. */
export function sortMuscles(ids: readonly MuscleId[]): MuscleId[] {
  return [...new Set(ids)].sort((a, b) => muscleRank(a) - muscleRank(b));
}

/** "Грудь, Трицепс". */
export function musclesLabel(ids: readonly MuscleId[]): string {
  return ids.length > 0 ? sortMuscles(ids).map(muscleName).join(', ') : NO_MUSCLE_TITLE;
}

export interface MuscleGroup<T> {
  /** null: the items have no group at all. */
  muscle: MuscleId | null;
  items: T[];
}

export function groupTitle(muscle: MuscleId | null): string {
  return muscle ? muscleName(muscle) : NO_MUSCLE_TITLE;
}

/**
 * Items grouped by muscle from the top of the body down, by name inside a group.
 * An exercise for several muscles is listed under each of them, so it is found from any.
 */
export function groupByMuscle<T extends { muscles: readonly MuscleId[]; name: string }>(
  items: readonly T[],
): MuscleGroup<T>[] {
  const byName = [...items].sort((a, b) => compareNames(a.name, b.name));
  const groups: MuscleGroup<T>[] = MUSCLES.map((m) => ({
    muscle: m.id,
    items: byName.filter((i) => i.muscles.includes(m.id)),
  }));
  groups.push({ muscle: null, items: byName.filter((i) => i.muscles.length === 0) });
  return groups.filter((g) => g.items.length > 0);
}

/** Every muscle the items work, from the top of the body down. */
export function musclesOf(items: readonly { muscles: readonly MuscleId[] }[]): MuscleId[] {
  return sortMuscles(items.flatMap((i) => i.muscles));
}
