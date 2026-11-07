<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import NavBar from '../components/NavBar.svelte';
  import SortableList from '../components/SortableList.svelte';
  import { mergeSelection } from '../core/list';
  import { musclesLabel } from '../core/muscles';
  import type { Exercise } from '../core/types';
  import { app } from '../lib/app.svelte';
  import { ask } from '../lib/confirm.svelte';
  import { countLabel, EXERCISES, formatRelative, formatSetLong } from '../lib/format';
  import ExercisePicker from '../sheets/ExercisePicker.svelte';
  import WorkoutForm from '../sheets/WorkoutForm.svelte';

  let { id }: { id: string } = $props();

  const workout = $derived(app.workouts.find((w) => w.id === id));
  const exercises = $derived(
    workout ? workout.exerciseIds.map((x) => app.exerciseById.get(x)).filter((e): e is Exercise => e !== undefined) : [],
  );
  const runningHere = $derived(app.active?.workoutId === id);
  const last = $derived(app.lastSessionOf(id));

  let editing = $state(false);
  let picking = $state(false);

  /** New order from dragging, saved at once. */
  function reorder(list: Exercise[]) {
    if (workout) app.updateWorkout(workout.id, { exerciseIds: list.map((e) => e.id) });
  }

  async function start() {
    if (!workout) return;
    if (runningHere) return app.resume();
    if (app.active) {
      const ok = await ask(`Сейчас идёт «${app.active.workoutName}». Завершить её и начать «${workout.name}»?`, {
        confirmLabel: 'Завершить и начать',
      });
      if (!ok) return;
      await app.finishWorkout({ summary: false });
    }
    await app.startWorkout(workout.id);
  }
</script>

{#if workout}
  <NavBar>
    {#snippet actions()}
      <button class="link" onclick={() => (editing = true)}>Изменить</button>
    {/snippet}
  </NavBar>

  <div class="screen with-nav">
    <div>
      <h1 class="large-title">{workout.name}</h1>
      <p class="muted meta">
        {countLabel(exercises.length, EXERCISES)}{#if runningHere}{' · '}<span class="live">идёт сейчас</span>{:else if last}{' · '}последняя {formatRelative(last.startedAt, app.now)}{/if}
      </p>
    </div>

    {#if exercises.length > 0}
      <div class="list">
        <SortableList items={exercises} key={(e) => e.id} label={(e) => `Переместить «${e.name}»`} onreorder={reorder}>
          {#snippet row(ex, i)}
            {@const lastSet = app.lastSetOf(ex.id)}
            <button class="exercise" onclick={() => app.openExercise(ex.id)}>
              <span class="idx num">{i + 1}</span>
              <span class="item-text">
                <span class="item-title">{ex.name}</span>
                <span class="muted small">
                  {musclesLabel(ex.muscles)}{#if lastSet}{' · '}{formatSetLong(lastSet)}, {formatRelative(lastSet.doneAt, app.now)}{/if}
                </span>
              </span>
            </button>
          {/snippet}
        </SortableList>
      </div>
      <p class="muted small hint">Нажмите на упражнение, чтобы открыть его статистику. Порядок — перетаскиванием за ≡</p>
    {:else}
      <div class="card empty">
        <h2>Упражнений пока нет</h2>
        <p class="muted">Добавьте упражнения, и тренировку можно будет начать.</p>
      </div>
    {/if}

    <button class="btn btn-block add" onclick={() => (picking = true)}>
      <Icon name="plus" size={20} /> Добавить упражнение
    </button>

    <div class="start">
      <button class="btn btn-primary btn-lg btn-block" disabled={exercises.length === 0} onclick={start}>
        <Icon name="play" size={20} stroke={2.4} />
        {runningHere ? 'Продолжить тренировку' : 'Начать тренировку'}
      </button>
    </div>
  </div>

  {#if editing}
    <WorkoutForm {workout} onclose={() => (editing = false)} />
  {/if}
  {#if picking}
    <ExercisePicker
      selected={workout.exerciseIds}
      onclose={() => (picking = false)}
      ondone={(picked) => {
        app.updateWorkout(id, { exerciseIds: mergeSelection(workout.exerciseIds, picked) });
        picking = false;
      }}
    />
  {/if}
{/if}

<style>
  .meta {
    margin-top: 4px;
  }

  .live {
    color: var(--accent-text);
    font-weight: 600;
  }

  .list {
    padding: 0 12px 0 16px;
    border-radius: var(--radius);
    background: var(--surface);
  }

  .exercise {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 64px;
    padding: 10px 0;
    border: 0;
    background: none;
    text-align: left;
  }

  .idx {
    flex: none;
    width: 22px;
    color: var(--text-3);
    font-weight: 700;
    text-align: center;
  }

  .hint {
    margin-top: -8px;
    padding: 0 8px;
    text-align: center;
  }

  .add {
    color: var(--accent-text);
  }

  /* Stays above the tab bar while the list scrolls under it. */
  .start {
    position: sticky;
    bottom: 0;
    margin: 0 calc(-1 * var(--gutter)) -32px;
    padding: 12px var(--gutter) 16px;
    background: linear-gradient(to bottom, transparent, var(--bg) 22%);
  }
</style>
