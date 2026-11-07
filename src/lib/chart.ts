/**
 * 3–5 round ticks covering the values, lowest first. The scale starts at 0 unless every
 * value is far from it: growth from 50 to 65 kg has to be visible, not a flat line at the top.
 */
export function niceTicks(min: number, max: number): number[] {
  if (!(max > 0)) return [0, 1];
  let lo = 0;
  if (min === max) lo = min * 0.8;
  else if (min > 0 && max - min < max * 0.5) lo = min - (max - min) / 2;
  const rough = (max - lo) / 3;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough)!;
  const start = Math.max(0, Math.floor(lo / step) * step);
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= top + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}
