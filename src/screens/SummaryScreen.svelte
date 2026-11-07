<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import { isPersonalRecord } from '../core/stats';
  import type { Exercise, SetRecord } from '../core/types';
  import { app } from '../lib/app.svelte';
  import { formatDuration, formatSetShort, plural, SETS } from '../lib/format';

  // Read once: the summary shows the workout as it was finished.
  const session = app.sessionById.get(app.summaryId ?? '');
  const sets = session ? app.sets.filter((s) => s.sessionId === session.id) : [];
  const duration = session ? (session.finishedAt ?? Date.now()) - session.startedAt : 0;

  interface Row {
    id: string;
    exercise: Exercise | undefined;
    sets: SetRecord[];
    record: boolean;
  }

  /** Exercises in the order they were first done, with a record flag when the best set beat the history. */
  const rows: Row[] = [];
  for (const s of sets) {
    let row = rows.find((r) => r.id === s.exerciseId);
    if (!row) rows.push((row = { id: s.exerciseId, exercise: app.exerciseById.get(s.exerciseId), sets: [], record: false }));
    row.sets.push(s);
  }
  for (const row of rows) {
    const earlier = app.historyOf(row.id).filter((s) => s.sessionId !== session?.id && s.doneAt < (session?.startedAt ?? 0));
    row.record = isPersonalRecord(row.sets, earlier, row.exercise?.weighted ?? true);
  }
  const records = rows.filter((r) => r.record).length;
</script>

<div class="summary">
  <main>
    <div class="badge" aria-hidden="true"><Icon name="check" size={36} stroke={3} /></div>
    <p class="eyebrow">{session?.workoutName ?? ''}</p>
    <h1>Тренировка завершена</h1>
    {#if records > 0}
      <p class="records"><Icon name="trophy" size={18} /> {records === 1 ? 'Новый рекорд!' : `Новых рекордов: ${records}`}</p>
    {/if}

    <div class="totals">
      <div class="card total">
        <span class="value num">{formatDuration(duration)}</span>
        <span class="muted small">время</span>
      </div>
      <div class="card total">
        <span class="value num">{sets.length}</span>
        <span class="muted small">{plural(sets.length, SETS)}</span>
      </div>
    </div>

    <section class="card group list">
      {#each rows as row (row.id)}
        <div class="item">
          <span class="item-text">
            <span class="item-title">{row.exercise?.name ?? 'Удалённое упражнение'}</span>
            <span class="muted small num">{row.sets.map(formatSetShort).join(' · ')}</span>
          </span>
          {#if row.record}<span class="pr"><Icon name="trophy" size={16} /> рекорд</span>{/if}
        </div>
      {/each}
    </section>
  </main>

  <footer>
    <button class="btn btn-primary btn-lg btn-block" onclick={() => app.closeSummary()}>Готово</button>
  </footer>
</div>

<style>
  .summary {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: calc(var(--safe-top) + 24px) var(--gutter) calc(var(--safe-bottom) + 12px);
    overflow-y: auto;
  }

  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    flex: 1;
    text-align: center;
  }

  main,
  footer {
    width: 100%;
    max-width: 560px;
    margin-inline: auto;
  }

  .badge {
    display: grid;
    place-items: center;
    width: 72px;
    height: 72px;
    margin: 8px 0 8px;
    border-radius: 50%;
    background: var(--accent);
    color: var(--on-accent);
  }

  h1 {
    font-family: var(--font-display);
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }

  .records {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 999px;
    background: rgb(255 214 10 / 0.14);
    color: var(--gold);
    font-weight: 700;
  }

  .totals {
    display: flex;
    gap: 8px;
    width: 100%;
    margin-top: 12px;
  }

  .total {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    padding: 14px 8px;
  }

  .value {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.2;
  }

  .list {
    width: 100%;
    margin-top: 8px;
    text-align: left;
  }

  .pr {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex: none;
    color: var(--gold);
    font-size: calc(14 * var(--pt));
    font-weight: 700;
  }

  footer {
    padding-top: 16px;
  }
</style>
