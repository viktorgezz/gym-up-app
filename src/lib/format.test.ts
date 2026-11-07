import { describe, expect, it } from 'vitest';
import {
  countLabel,
  formatClock,
  formatDay,
  formatElapsed,
  formatInputNumber,
  formatRelative,
  formatSetLong,
  formatSetShort,
  parseDecimal,
  SETS,
} from './format';

describe('format', () => {
  it('uses Russian plural forms', () => {
    expect([1, 2, 5, 11, 21, 22, 25].map((n) => countLabel(n, SETS))).toEqual([
      '1 подход',
      '2 подхода',
      '5 подходов',
      '11 подходов',
      '21 подход',
      '22 подхода',
      '25 подходов',
    ]);
  });

  it('formats sets with and without weight', () => {
    expect(formatSetShort({ weight: 62.5, reps: 8 })).toBe('62,5 × 8');
    expect(formatSetShort({ weight: null, reps: 15 })).toBe('15 повт.');
    expect(formatSetLong({ weight: 60, reps: 10 })).toBe('60 кг × 10');
    expect(formatSetLong({ weight: null, reps: 3 })).toBe('3 повтора');
  });

  it('reads weights typed with a comma or a dot', () => {
    expect(parseDecimal('62,5')).toBe(62.5);
    expect(parseDecimal('62.5')).toBe(62.5);
    expect(parseDecimal('')).toBeNaN();
    expect(formatInputNumber(1.25)).toBe('1,25');
  });

  it('formats clocks', () => {
    expect(formatClock(90_000)).toBe('1:30');
    expect(formatClock(400)).toBe('0:01');
    expect(formatClock(-5)).toBe('0:00');
    expect(formatElapsed(3_723_000)).toBe('1:02:03');
    expect(formatElapsed(65_000)).toBe('1:05');
  });

  it('names days relative to today', () => {
    const now = new Date('2026-11-07T12:00').getTime();
    expect(formatDay(new Date('2026-11-07T08:00').getTime(), now)).toBe('Сегодня');
    expect(formatDay(new Date('2026-11-06T23:00').getTime(), now)).toBe('Вчера');
    expect(formatRelative(new Date('2026-11-04T10:00').getTime(), now)).toBe('3 дня назад');
  });
});
