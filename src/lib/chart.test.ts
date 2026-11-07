import { describe, expect, it } from 'vitest';
import { niceTicks } from './chart';

describe('niceTicks', () => {
  it('zooms in on values far from zero', () => {
    expect(niceTicks(50, 65)).toEqual([40, 50, 60, 70]);
    expect(niceTicks(12, 15)).toEqual([10, 12, 14, 16]);
  });

  it('starts at zero when the values spread widely', () => {
    expect(niceTicks(10, 100)).toEqual([0, 50, 100]);
  });

  it('handles a single value and empty data', () => {
    const flat = niceTicks(60, 60);
    expect(flat[0]).toBeLessThan(60);
    expect(flat.at(-1)).toBeGreaterThanOrEqual(60);
    expect(niceTicks(0, 0)).toEqual([0, 1]);
  });
});
