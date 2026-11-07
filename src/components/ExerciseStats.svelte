<script lang="ts">
  import { musclesLabel } from '../core/muscles';
  import {
    bestSet,
    dailySeries,
    dayRowsNewestFirst,
    groupByDay,
    runsBySession,
    type DayGroup,
    type Metric,
  } from '../core/stats';
  import type { Exercise, SetRecord } from '../core/types';
  import { app } from '../lib/app.svelte';
  import { scrollParent } from '../lib/dom';
  import {
    countLabel,
    DAYS,
    formatDay,
    formatDayShort,
    formatNumber,
    formatSetLong,
    formatTime,
    plural,
    REPS,
    SETS,
    weightedLabel,
  } from '../lib/format';
  import SetForm from '../sheets/SetForm.svelte';
  import Chart from './Chart.svelte';
  import Icon from './Icon.svelte';
  import Segmented from './Segmented.svelte';

  /** Everything logged for one exercise, whatever workout it was done in. */
  let { exercise }: { exercise: Exercise } = $props();

  /** Days on the chart; the full history is in the list below it. */
  const CHART_DAYS = 30;

  const history = $derived(app.historyOf(exercise.id));
  const days = $derived(groupByDay(history));
  const best = $derived(bestSet(history, exercise.weighted));

  const metricOptions = $derived<{ value: Metric; label: string }[]>(
    exercise.weighted
      ? [
          { value: 'maxWeight', label: 'Макс. вес' },
          { value: 'volume', label: 'Объём' },
        ]
      : [
          { value: 'maxReps', label: 'Лучший подход' },
          { value: 'totalReps', label: 'Всего за день' },
        ],
  );
  let chosenMetric = $state<Metric | null>(null);
  // The type can change in the edit form: fall back to the first metric that fits.
  const metric = $derived(
    chosenMetric && metricOptions.some((o) => o.value === chosenMetric) ? chosenMetric : metricOptions[0].value,
  );
  const unit = $derived(metric === 'maxWeight' || metric === 'volume' ? 'кг' : 'повт.');
  const points = $derived(
    dailySeries(days, metric)
      .slice(-CHART_DAYS)
      .map((p) => ({ label: formatDayShort(p.day), detail: formatDay(p.day, app.now), value: p.value })),
  );

  /**
   * History is drawn a page of days at a time: years of sets would otherwise be thousands
   * of rows on screen at once. The next page is added as the end of the list comes near.
   */
  const PAGE_DAYS = 10;
  /** How far below the visible area the next page starts loading, px. */
  const PRELOAD_PX = 800;
  /** "из 21 дня", "из 60 дней". */
  const DAYS_OF = ['дня', 'дней', 'дней'] as const;

  let shownDays = $state(PAGE_DAYS);
  const visibleDays = $derived(days.slice(0, shownDays));
  const hiddenDays = $derived(Math.max(0, days.length - shownDays));
  let sentinel = $state<HTMLElement | null>(null);

  // Re-armed after every page: a new observer reports at once if the end is still close,
  // so a tall screen fills up without waiting for a scroll.
  $effect(() => {
    void shownDays;
    const el = sentinel;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) shownDays += PAGE_DAYS;
      },
      // The list scrolls inside the screen (or the sheet), not the window: watch that box.
      { root: scrollParent(el), rootMargin: `0px 0px ${PRELOAD_PX}px 0px` },
    );
    observer.observe(el);
    return () => observer.disconnect();
  });

  /** Sets of one day shown at first; each "Показать ещё" adds up to as many again. */
  const PAGE_SETS = 10;
  /** How many sets are open in each day, by the day's start; PAGE_SETS when not there. */
  let openSets = $state.raw<Record<number, number>>({});

  const setsShown = (day: number) => openSets[day] ?? PAGE_SETS;

  function showMoreSets(day: number) {
    openSets = { ...openSets, [day]: setsShown(day) + PAGE_SETS };
  }

  let editing = $state<SetRecord | null>(null);
  let adding = $state(false);

  /** Heading of one workout within a day: its name and when it started. */
  function partTitle(day: DayGroup, sessionId: string | null): string {
    const first = day.parts.find((p) => p.sessionId === sessionId)?.sets[0];
    const at = first ? ` · ${formatTime(first.doneAt)}` : '';
    if (!sessionId) return `Без тренировки${at}`;
    const session = app.sessionById.get(sessionId);
    return `${session?.workoutName || 'Тренировка'}${at}`;
  }
</script>

<div class="stats">
  <p class="muted meta">{musclesLabel(exercise.muscles)} · {weightedLabel(exercise.weighted)}</p>

  {#if history.length === 0}
    <div class="card empty">
      <h2>Подходов пока нет</h2>
      <p class="muted">Записывайте вес и повторения во время тренировки — здесь появятся история и график.</p>
      <button class="btn" onclick={() => (adding = true)}><Icon name="plus" size={20} /> Записать подход</button>
    </div>
  {:else}
    <section class="tiles">
      <div class="card tile">
        <span class="eyebrow">Рекорд</span>
        <span class="value num">{best ? formatSetLong(best) : '—'}</span>
        {#if best}<span class="muted small">{formatDay(best.doneAt, app.now)}</span>{/if}
      </div>
      <div class="card tile">
        <span class="eyebrow">Всего</span>
        <span class="value num">{history.length}</span>
        <span class="muted small">{plural(history.length, SETS)} за {countLabel(days.length, DAYS)}</span>
      </div>
    </section>

    {#if days.length >= 2}
      <section class="card chart">
        <Segmented options={metricOptions} bind:value={() => metric, (v) => (chosenMetric = v)} label="Что показать на графике" />
        <Chart {points} {unit} title="По дням · последние {Math.min(days.length, CHART_DAYS)}" />
      </section>
    {/if}

    <section class="history">
      <div class="history-head">
        <h2 class="eyebrow">История</h2>
        <button class="link" onclick={() => (adding = true)}><Icon name="plus" size={18} /> Подход</button>
      </div>

      {#each visibleDays as day (day.day)}
        <!-- Newest set first; a long day opens 10 sets at a time. -->
        {@const rows = dayRowsNewestFirst(day)}
        {@const limit = setsShown(day.day)}
        {@const left = rows.length - limit}
        <article class="card day">
          <header>
            <h3>{formatDay(day.day, app.now)}</h3>
            <span class="muted small num">
              {countLabel(day.sets, SETS)} ·
              {#if day.volume > 0}{formatNumber(day.volume)} кг{:else}{day.reps} {plural(day.reps, REPS)}{/if}
            </span>
          </header>
          {#each runsBySession(rows.slice(0, limit)) as run, ri (`${run.sessionId ?? 'none'}-${ri}`)}
            {#if day.parts.length > 1}<p class="part eyebrow">{partTitle(day, run.sessionId)}</p>{/if}
            <ol class="sets">
              {#each run.rows as row (row.set.id)}
                <li>
                  <button
                    class="set"
                    onclick={() => (editing = row.set)}
                    aria-label="Подход {row.n}: {formatSetLong(row.set)}, изменить"
                  >
                    <span class="n num">{row.n}</span>
                    <span class="v num">{formatSetLong(row.set)}</span>
                    {#if best && row.set.id === best.id}<span class="pr" title="Рекорд"><Icon name="trophy" size={16} /></span>{/if}
                    <span class="t muted num">{formatTime(row.set.doneAt)}</span>
                  </button>
                </li>
              {/each}
            </ol>
          {/each}
          {#if left > 0}
            <button class="btn btn-sm btn-block more-sets" onclick={() => showMoreSets(day.day)}>
              Показать ещё {Math.min(PAGE_SETS, left)}
              {#if left > PAGE_SETS}<span class="muted">· осталось {left}</span>{/if}
            </button>
          {/if}
        </article>
      {/each}

      {#if hiddenDays > 0}
        <div class="more" bind:this={sentinel}>
          <button class="btn btn-sm" onclick={() => (shownDays += PAGE_DAYS)}>Показать ещё</button>
          <span class="muted small">показано {visibleDays.length} из {days.length} {plural(days.length, DAYS_OF)}</span>
        </div>
      {/if}
    </section>
  {/if}
</div>

{#if editing}
  <SetForm {exercise} set={editing} onclose={() => (editing = null)} />
{/if}
{#if adding}
  <SetForm {exercise} onclose={() => (adding = false)} />
{/if}

<style>
  .stats {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .meta {
    margin-top: -10px;
  }

  .tiles {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .tile {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    padding: 14px 16px;
  }

  .value {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.2;
  }

  .chart {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 16px;
  }

  .history {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .history-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0 0 -6px 4px;
  }

  .history-head .link {
    font-size: calc(15 * var(--pt));
    font-weight: 600;
  }

  .day {
    padding: 14px 16px 6px;
    /* Days scrolled far out of view skip layout and paint (Safari 18+). */
    content-visibility: auto;
    contain-intrinsic-size: auto 200px;
  }

  .more-sets {
    margin: 6px 0 10px;
    color: var(--accent-text);
  }

  .more-sets .muted {
    font-weight: 500;
  }

  .more {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 4px 0 12px;
  }

  .day header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 4px;
  }

  h3 {
    font-size: calc(17 * var(--pt));
    font-weight: 700;
  }

  .part {
    margin: 10px 0 2px;
    color: var(--accent-text);
    font-size: 11px;
  }

  .sets {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .set {
    display: grid;
    grid-template-columns: 24px 1fr auto auto;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 44px;
    border: 0;
    border-top: 0.5px solid var(--line);
    background: none;
    text-align: left;
  }

  li:first-child .set {
    border-top: 0;
  }

  .n {
    color: var(--text-3);
    font-weight: 700;
  }

  .v {
    font-size: calc(17 * var(--pt));
    font-weight: 600;
  }

  .pr {
    display: grid;
    color: var(--gold);
  }

  .t {
    grid-column: 4;
    font-size: calc(14 * var(--pt));
  }
</style>
