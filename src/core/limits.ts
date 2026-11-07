export const MAX_REPS = 999;
export const MAX_WEIGHT = 1000;
export const MAX_NAME = 80;

/** Offered for the very first set of an exercise. */
export const FIRST_WEIGHT = 20;
export const FIRST_REPS = 10;

export const WEIGHT_STEPS = [0.5, 1, 1.25, 2, 2.5, 5];

export function isValidReps(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= MAX_REPS;
}

export function isValidWeight(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= MAX_WEIGHT;
}

/** kg to two decimals: 1.25 kg plates exist, float noise doesn't. */
export function roundWeight(n: number): number {
  return Math.round(n * 100) / 100;
}
