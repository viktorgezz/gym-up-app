<script lang="ts" module>
  export interface ChartPoint {
    /** Short axis label. */
    label: string;
    /** Longer tooltip/table label. */
    detail: string;
    value: number;
  }
</script>

<script lang="ts">
  import { niceTicks } from '../lib/chart';
  import { formatNumber } from '../lib/format';

  let { points, unit, title }: { points: ChartPoint[]; unit: string; title: string } = $props();

  const H = 184;
  const PAD = { top: 16, right: 24, bottom: 26, left: 40 };

  let width = $state(320);
  let active = $state<number | null>(null);

  const ticks = $derived(niceTicks(Math.min(...points.map((p) => p.value)), Math.max(...points.map((p) => p.value))));
  const yMin = $derived(ticks[0]);
  const yMax = $derived(ticks[ticks.length - 1]);
  const plotW = $derived(Math.max(1, width - PAD.left - PAD.right));
  const plotH = H - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : (plotW * i) / (points.length - 1));
  const y = (v: number) => PAD.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;
  const baseline = $derived(y(yMin));

  const linePath = $derived(points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(''));
  const areaPath = $derived(
    points.length > 1 ? `${linePath}L${x(points.length - 1)},${baseline}L${x(0)},${baseline}Z` : '',
  );

  /** Show every label when they fit, otherwise thin them out evenly. */
  const labelEvery = $derived(Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(plotW / 40)))));

  function nearest(clientX: number, rect: DOMRect): number {
    const px = clientX - rect.left;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    return best;
  }

  function onPointer(e: PointerEvent) {
    active = nearest(e.clientX, (e.currentTarget as SVGElement).getBoundingClientRect());
  }

  const tip = $derived(active === null || !points[active] ? null : { p: points[active], x: x(active), y: y(points[active].value) });
  const last = $derived(points.at(-1));
</script>

<figure class="chart">
  <figcaption class="eyebrow">{title}</figcaption>
  <div class="plot" bind:clientWidth={width}>
    <svg
      {width}
      height={H}
      role="img"
      aria-label="{title}: {points.map((p) => `${p.detail} ${formatNumber(p.value)}`).join(', ')}"
      onpointerdown={onPointer}
      onpointermove={onPointer}
      onpointerleave={() => (active = null)}
    >
      {#each ticks as t (t)}
        <line class="grid" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
        <text class="tick" x={PAD.left - 8} y={y(t)} dy="0.32em" text-anchor="end">{formatNumber(t)}</text>
      {/each}

      {#each points as p, i (i)}
        {#if i % labelEvery === 0 || i === points.length - 1}
          <text class="tick" x={x(i)} y={H - 6} text-anchor="middle">{p.label}</text>
        {/if}
      {/each}

      {#if tip}<line class="crosshair" x1={tip.x} x2={tip.x} y1={PAD.top} y2={baseline} />{/if}
      {#if areaPath}<path class="area" d={areaPath} />{/if}
      <path class="line" d={linePath} />
      {#each points as p, i (i)}
        <circle class="dot" cx={x(i)} cy={y(p.value)} r={active === i ? 6 : points.length > 24 ? 2.5 : 4} />
      {/each}
      {#if last && active === null}
        <text class="end-label" x={x(points.length - 1)} y={y(last.value) - 12} text-anchor="middle">
          {formatNumber(last.value)}
        </text>
      {/if}
    </svg>

    {#if tip}
      <div class="tooltip" style:left="{Math.min(Math.max(tip.x, 70), width - 70)}px" style:top="{tip.y - 12}px">
        <strong class="num">{formatNumber(tip.p.value)} {unit}</strong>
        <span>{tip.p.detail}</span>
      </div>
    {/if}
  </div>

  <details>
    <summary>Показать данные</summary>
    <table>
      <tbody>
        {#each points.slice().reverse() as p, i (i)}
          <tr><td>{p.detail}</td><td class="num">{formatNumber(p.value)} {unit}</td></tr>
        {/each}
      </tbody>
    </table>
  </details>
</figure>

<style>
  .chart {
    margin: 0;
  }

  .plot {
    position: relative;
    margin-top: 12px;
    touch-action: pan-y;
  }

  svg {
    display: block;
    overflow: visible;
  }

  .grid {
    stroke: var(--grid);
    stroke-width: 1;
  }

  .crosshair {
    stroke: var(--text-3);
    stroke-width: 1;
  }

  .tick {
    fill: var(--text-3);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }

  .end-label {
    fill: var(--text);
    font-size: 13px;
    font-weight: 700;
  }

  .line {
    fill: none;
    stroke: var(--chart);
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .area {
    fill: var(--chart);
    opacity: 0.1;
  }

  .dot {
    fill: var(--chart);
    stroke: var(--surface);
    stroke-width: 2;
  }

  .tooltip {
    position: absolute;
    transform: translate(-50%, -100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 10px;
    border-radius: 10px;
    background: var(--surface-3);
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.3);
    pointer-events: none;
    white-space: nowrap;
  }

  .tooltip strong {
    font-size: 17px;
  }

  .tooltip span {
    font-size: 12px;
    color: var(--text-2);
  }

  details {
    margin-top: 8px;
    font-size: 14px;
    color: var(--text-2);
  }

  summary {
    display: flex;
    align-items: center;
    min-height: 36px;
    cursor: pointer;
    list-style: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  td {
    padding: 6px 0;
    border-top: 0.5px solid var(--line);
  }

  td:last-child {
    text-align: right;
    color: var(--text);
  }
</style>
