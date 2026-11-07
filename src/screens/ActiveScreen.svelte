<script lang="ts">
  import { fly } from 'svelte/transition';
  import ExerciseStats from '../components/ExerciseStats.svelte';
  import Icon from '../components/Icon.svelte';
  import RestCard from '../components/RestCard.svelte';
  import Sheet from '../components/Sheet.svelte';
  import { musclesLabel } from '../core/muscles';
  import { restRemainingMs } from '../core/rest';
  import { lastPerformance } from '../core/stats';
  import type { SetRecord } from '../core/types';
  import { app } from '../lib/app.svelte';
  import { ask } from '../lib/confirm.svelte';
  import { countLabel, formatClock, formatDay, formatElapsed, formatSetShort, SETS, weightedLabel } from '../lib/format';
  import ExercisePicker from '../sheets/ExercisePicker.svelte';
  import RestPicker from '../sheets/RestPicker.svelte';
  import SetForm from '../sheets/SetForm.svelte';

  // The store clears the workout in the same tick it leaves this screen; keep the last one
  // so the outgoing render never sees null.
  const initial = app.active!;
  const a = $derived(app.active ?? initial);

  const current = $derived(app.exerciseById.get(a.exerciseIds[a.index] ?? '') ?? null);
  const next = $derived(app.exerciseById.get(a.exerciseIds[a.index + 1] ?? '') ?? null);
  const total = $derived(a.exerciseIds.length);
  const isLast = $derived(a.index >= total - 1);

  const sessionSets = $derived(app.sets.filter((s) => s.sessionId === a.sessionId));
  const doneIds = $derived(new Set(sessionSets.map((s) => s.exerciseId)));
  const today = $derived(current ? sessionSets.filter((s) => s.exerciseId === current.id) : []);
  const previous = $derived(current ? lastPerformance(app.historyOf(current.id), a.sessionId) : []);
  const stale = $derived(app.isStale(a, app.now));

  // Sheets
  let recording = $state(false);
  let editingSet = $state<SetRecord | null>(null);
  let choosingRest = $state(false);
  let showingStats = $state(false);
  let showingList = $state(false);
  let adding = $state(false);

  /** Which way the exercise slides in. */
  let direction = $state(1);
  let lastIndex = initial.index;
  $effect.pre(() => {
    direction = a.index >= lastIndex ? 1 : -1;
    lastIndex = a.index;
  });

  async function finish() {
    const n = sessionSets.length;
    const ok = await ask(
      n > 0
        ? `Завершить тренировку? Записано ${countLabel(n, SETS)}.`
        : 'Завершить тренировку? Подходов не записано — в истории она не сохранится.',
      { confirmLabel: 'Завершить', danger: n === 0 },
    );
    if (ok) await app.finishWorkout();
  }

  function jump(index: number) {
    app.goToExercise(index);
    showingList = false;
  }
</script>

<!-- Every tap unlocks audio again: after iOS kills the app, it reopens straight into the workout. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="active" onclick={() => app.unlockSound()}>
  <header class="top">
    <button class="icon-btn" aria-label="Свернуть тренировку" onclick={() => app.minimize()}>
      <Icon name="chevronDown" size={26} />
    </button>
    <div class="title">
      <p class="workout-name">{a.workoutName}</p>
      <p class="clock muted num">{stale ? `с ${formatDay(a.startedAt, app.now)}` : formatElapsed(app.now - a.startedAt)}</p>
    </div>
    <button class="btn btn-sm finish" onclick={finish}>Завершить</button>
  </header>

  <button class="track" aria-label="Список упражнений тренировки" onclick={() => (showingList = true)}>
    {#each a.exerciseIds as id, i (id)}
      <span class:done={doneIds.has(id)} class:current={i === a.index}></span>
    {/each}
  </button>

  <main class="stage">
    {#if current}
      {#key current.id}
        <div class="exercise" in:fly={{ x: 40 * direction, duration: 220 }}>
          <button class="counter eyebrow" onclick={() => (showingList = true)}>
            Упражнение {a.index + 1} из {total} <Icon name="chevronDown" size={14} stroke={2.6} />
          </button>
          <h1>{current.name}</h1>
          <p class="muted">{musclesLabel(current.muscles)} · {weightedLabel(current.weighted)}</p>
        </div>
      {/key}

      <RestCard />

      <section class="info">
        <h2 class="eyebrow">Сегодня</h2>
        {#if today.length > 0}
          <ol class="chips">
            {#each today as s, i (s.id)}
              <li>
                <button class="set-chip" onclick={() => (editingSet = s)} aria-label="Подход {i + 1}: {formatSetShort(s)}, изменить">
                  <span class="n num">{i + 1}</span>
                  <span class="num">{formatSetShort(s)}</span>
                </button>
              </li>
            {/each}
          </ol>
        {:else}
          <p class="muted">Подходов пока нет</p>
        {/if}
      </section>

      {#if previous.length > 0}
        <section class="info">
          <h2 class="eyebrow">Прошлый раз · {formatDay(previous[0].doneAt, app.now)}</h2>
          <p class="previous num">{previous.map(formatSetShort).join(' · ')}</p>
        </section>
      {/if}
    {:else}
      <div class="card empty">
        <h2>В тренировке нет упражнений</h2>
        <p class="muted">Добавьте упражнение, чтобы записывать подходы.</p>
        <button class="btn" onclick={() => (adding = true)}><Icon name="plus" size={20} /> Добавить упражнение</button>
      </div>
    {/if}
  </main>

  {#if current}
    <footer class="actions">
      <button class="btn btn-primary btn-lg btn-block record" onclick={() => (recording = true)}>
        <Icon name="plus" size={24} stroke={2.6} /> Записать подход
      </button>
      <div class="pair">
        <button class="btn btn-lg" onclick={() => (choosingRest = true)}>
          <Icon name="timer" size={22} />
          {a.rest ? formatClock(restRemainingMs(a.rest, app.now)) : 'Отдых'}
        </button>
        <button class="btn btn-lg" onclick={() => (showingStats = true)}>
          <Icon name="chart" size={22} /> Статистика
        </button>
      </div>
      {#if isLast}
        <button class="btn btn-lg btn-block next" onclick={finish}>
          <Icon name="check" size={22} stroke={2.6} /> Завершить тренировку
        </button>
      {:else}
        <button class="btn btn-lg btn-block next" onclick={() => app.nextExercise()}>
          <span class="next-label"><span class="muted">Далее:</span> {next?.name ?? ''}</span>
          <Icon name="arrowRight" size={22} />
        </button>
      {/if}
    </footer>
  {/if}
</div>

{#if recording && current}
  <SetForm exercise={current} title="Подход {today.length + 1}" onclose={() => (recording = false)} />
{/if}
{#if editingSet && current}
  <SetForm exercise={current} set={editingSet} onclose={() => (editingSet = null)} />
{/if}
{#if choosingRest}
  <RestPicker exercise={current} onclose={() => (choosingRest = false)} />
{/if}
{#if showingStats && current}
  <Sheet title={current.name} onclose={() => (showingStats = false)}>
    {#snippet left()}
      {#if a.rest}
        <span class="rest-pill num">{formatClock(restRemainingMs(a.rest, app.now))}</span>
      {/if}
    {/snippet}
    {#snippet right()}
      <button class="link strong" onclick={() => (showingStats = false)}>Готово</button>
    {/snippet}
    <div class="stats-sheet"><ExerciseStats exercise={current} /></div>
  </Sheet>
{/if}
{#if showingList}
  <Sheet title="Упражнения тренировки" size="bottom" onclose={() => (showingList = false)}>
    <ol class="session-list">
      {#each a.exerciseIds as id, i (id)}
        {@const ex = app.exerciseById.get(id)}
        {#if ex}
          {@const n = sessionSets.filter((s) => s.exerciseId === id).length}
          <li>
            <button class="item" class:current={i === a.index} onclick={() => jump(i)}>
              <span class="idx num">{i + 1}</span>
              <span class="item-text">
                <span class="item-title">{ex.name}</span>
                <span class="muted small">{n > 0 ? countLabel(n, SETS) : musclesLabel(ex.muscles)}</span>
              </span>
              {#if n > 0}<span class="tick"><Icon name="check" size={20} stroke={2.6} /></span>{/if}
            </button>
          </li>
        {/if}
      {/each}
    </ol>
    <button class="btn btn-block add" onclick={() => (adding = true)}>
      <Icon name="plus" size={20} /> Добавить упражнение
    </button>
  </Sheet>
{/if}
{#if adding}
  <ExercisePicker
    title="Добавить"
    exclude={a.exerciseIds}
    onclose={() => (adding = false)}
    ondone={(ids) => {
      app.addToSession(ids);
      adding = false;
      showingList = false;
    }}
  />
{/if}

<style>
  .active {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 640px;
    height: 100%;
    margin: 0 auto;
    padding: calc(var(--safe-top) + 6px) var(--gutter) calc(var(--safe-bottom) + 10px);
  }

  .top {
    display: grid;
    grid-template-columns: 44px 1fr auto;
    align-items: center;
    gap: 10px;
  }

  .title {
    min-width: 0;
    text-align: center;
  }

  .workout-name {
    overflow: hidden;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .clock {
    font-size: calc(14 * var(--pt));
  }

  .finish {
    background: var(--accent-soft);
    color: var(--accent-text);
  }

  .track {
    display: flex;
    gap: 4px;
    width: 100%;
    margin-top: 6px;
    padding: 10px 0;
    border: 0;
    background: none;
  }

  .track span {
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: var(--surface-2);
  }

  .track span.done {
    background: var(--accent);
    opacity: 0.45;
  }

  .track span.current {
    background: var(--accent);
    opacity: 1;
  }

  .stage {
    display: flex;
    flex-direction: column;
    gap: 18px;
    flex: 1;
    min-height: 0;
    margin: 0 calc(-1 * var(--gutter));
    padding: 6px var(--gutter) 16px;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .exercise {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .counter {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 28px;
    padding: 0;
    border: 0;
    background: none;
  }

  h1 {
    font-family: var(--font-display);
    font-size: clamp(26px, 8vw, 34px);
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.02em;
    overflow-wrap: anywhere;
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .set-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 14px 0 8px;
    border: 0;
    border-radius: 12px;
    background: var(--accent-soft);
    color: var(--accent-text);
    font-size: 18px;
    font-weight: 700;
  }

  .set-chip .n {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 8px;
    background: rgb(0 0 0 / 0.25);
    font-size: 13px;
  }

  .previous {
    color: var(--text-2);
    font-size: 18px;
    font-weight: 600;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 10px;
  }

  .record {
    min-height: 64px;
    font-size: 20px;
  }

  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .pair .btn {
    padding: 0 10px;
  }

  .next {
    justify-content: space-between;
    padding: 0 16px 0 20px;
  }

  .next-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rest-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: 8px;
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent-text);
    font-weight: 700;
  }

  .stats-sheet {
    padding-top: 10px;
  }

  .session-list {
    margin: 0 0 12px;
    padding: 0;
    list-style: none;
  }

  .session-list li + li {
    border-top: 0.5px solid var(--line);
  }

  .session-list .item {
    gap: 12px;
    padding: 8px 4px;
  }

  .session-list .item.current {
    color: var(--accent-text);
  }

  .idx {
    flex: none;
    width: 22px;
    color: var(--text-3);
    font-weight: 700;
    text-align: center;
  }

  .tick {
    display: grid;
    color: var(--accent-text);
  }

  .add {
    color: var(--accent-text);
  }

  /* Phone on its side: the exercise on the left, the four actions on the right. */
  @media (orientation: landscape) and (max-height: 500px) {
    .active {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(260px, 38%);
      grid-template-rows: auto auto minmax(0, 1fr);
      grid-template-areas:
        'top top'
        'track track'
        'stage actions';
      column-gap: 20px;
      max-width: none;
    }

    .top {
      grid-area: top;
    }

    .track {
      grid-area: track;
      padding: 6px 0;
    }

    .stage {
      grid-area: stage;
      margin: 0;
      padding: 0 0 8px;
    }

    .actions {
      grid-area: actions;
      justify-content: center;
      padding-top: 0;
    }
  }

  /* Short screens (iPhone SE): tighter so all four actions stay visible. */
  @media (max-height: 700px) {
    .stage {
      gap: 12px;
    }

    .record {
      min-height: 56px;
    }

    .actions .btn-lg {
      min-height: 50px;
    }
  }
</style>
