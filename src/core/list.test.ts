import { describe, expect, it } from 'vitest';
import { mergeSelection, moveItem } from './list';

describe('moveItem', () => {
  it('moves down and up', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('leaves the list alone for a bad index', () => {
    expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
  });
});

describe('mergeSelection', () => {
  it('keeps the order of kept items and appends new ones in pick order', () => {
    expect(mergeSelection(['a', 'b', 'c'], ['c', 'x', 'a', 'y'])).toEqual(['a', 'c', 'x', 'y']);
  });

  it('drops unpicked items', () => {
    expect(mergeSelection(['a', 'b'], [])).toEqual([]);
  });
});
