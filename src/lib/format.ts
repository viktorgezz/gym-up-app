import { daysBetween } from '../core/stats';

const LOCALE = 'ru-RU';
const numberFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });
const pluralRules = new Intl.PluralRules(LOCALE);

export type Forms = readonly [one: string, few: string, many: string];

export const SETS: Forms = ['подход', 'подхода', 'подходов'];
export const REPS: Forms = ['повтор', 'повтора', 'повторов'];
export const EXERCISES: Forms = ['упражнение', 'упражнения', 'упражнений'];
export const DAYS: Forms = ['день', 'дня', 'дней'];

/** Russian plural form for a whole number: 1 подход, 2 подхода, 5 подходов. */
export function plural(n: number, forms: Forms): string {
  if (!Number.isInteger(n)) return forms[1];
  const rule = pluralRules.select(n);
  return rule === 'one' ? forms[0] : rule === 'few' ? forms[1] : forms[2];
}

export function countLabel(n: number, forms: Forms): string {
  return `${n} ${plural(n, forms)}`;
}

/** 62,5 · 1 820 (Russian separators). */
export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

/** For an input field: no thousands separator, comma for decimals. */
export function formatInputNumber(n: number): string {
  return Number.isFinite(n) ? String(n).replace('.', ',') : '';
}

/** "62,5" or "62.5" → 62.5; empty or junk → NaN. */
export function parseDecimal(text: string): number {
  const t = text.trim().replace(',', '.');
  if (t === '' || t === '.') return NaN;
  return Number(t);
}

type SetLike = { weight: number | null; reps: number };

/** "60 × 10" for a weighted set, "10 повт." for bodyweight. */
export function formatSetShort(s: SetLike): string {
  return s.weight === null ? `${s.reps} повт.` : `${formatNumber(s.weight)} × ${s.reps}`;
}

/** "60 кг × 10" or "12 повторов". */
export function formatSetLong(s: SetLike): string {
  return s.weight === null ? countLabel(s.reps, REPS) : `${formatNumber(s.weight)} кг × ${s.reps}`;
}

/** m:ss, rounding up so a countdown shows 0:01 until it is really over. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function formatSec(sec: number): string {
  return formatClock(sec * 1000);
}

/** Workout time: 7:05, 1:02:03. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export function formatDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 1) return 'меньше минуты';
  if (min < 60) return `${min} мин`;
  const rest = min % 60;
  return rest ? `${Math.floor(min / 60)} ч ${rest} мин` : `${Math.floor(min / 60)} ч`;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Сегодня", "Вчера", "Пт, 7 нояб." (with the year when it isn't this year). */
export function formatDay(ts: number, now = Date.now()): string {
  const diff = daysBetween(ts, now);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Вчера';
  const sameYear = new Date(ts).getFullYear() === new Date(now).getFullYear();
  return capitalize(
    new Date(ts).toLocaleDateString(LOCALE, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      ...(sameYear ? {} : { year: 'numeric' }),
    }),
  );
}

/** "7.11" for chart axes. */
export function formatDayShort(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** "сегодня", "вчера", "3 дня назад", "12 окт.". */
export function formatRelative(ts: number, now = Date.now()): string {
  const diff = daysBetween(ts, now);
  if (diff <= 0) return 'сегодня';
  if (diff === 1) return 'вчера';
  if (diff < 7) return `${countLabel(diff, DAYS)} назад`;
  const sameYear = new Date(ts).getFullYear() === new Date(now).getFullYear();
  return new Date(ts).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
}

export function weightedLabel(weighted: boolean): string {
  return weighted ? 'с весом' : 'без веса';
}
