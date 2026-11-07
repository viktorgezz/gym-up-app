<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import InstallHint from '../components/InstallHint.svelte';
  import SortableList from '../components/SortableList.svelte';
  import { muscleName, musclesOf } from '../core/muscles';
  import type { Exercise, Workout } from '../core/types';
  import { app } from '../lib/app.svelte';
  import { countLabel, EXERCISES, formatRelative } from '../lib/format';
  import WorkoutForm from '../sheets/WorkoutForm.svelte';

  let creating = $state(false);

  function info(w: Workout) {
    const exercises = w.exerciseIds.map((id) => app.exerciseById.get(id)).filter((e): e is Exercise => e !== undefined);
    return { count: exercises.length, muscles: musclesOf(exercises), last: app.lastSessionOf(w.id) };
  }
</script>

<div class="screen">
  <header class="page-head">
    <h1 class="large-title">Тренировки</h1>
    {#if app.workouts.length > 0}
      <button class="icon-btn accent" aria-label="Новая тренировка" onclick={() => (creating = true)}>
        <Icon name="plus" stroke={2.6} />
      </button>
    {/if}
  </header>

  <InstallHint />

  {#if app.workouts.length === 0}
    <div class="card empty intro">
      <div class="badge"><Icon name="dumbbell" size={30} /></div>
      <h2>Создайте первую тренировку</h2>
      <p class="muted">
        Тренировка — это список упражнений в нужном порядке. Вес и повторения записываются за упражнением, поэтому его
        прогресс один, в какой бы тренировке вы его ни делали.
      </p>
      <button class="btn btn-primary btn-lg btn-block" onclick={() => (creating = true)}>
        <Icon name="plus" stroke={2.6} /> Новая тренировка
      </button>
    </div>
  {:else}
    <div class="list">
      <SortableList
        items={app.workouts}
        key={(w) => w.id}
        label={(w) => `Переместить «${w.name}»`}
        onreorder={(list) => app.reorderWorkouts(list)}
      >
        {#snippet row(w)}
          {@const i = info(w)}
          <button class="workout" onclick={() => app.openWorkout(w.id)}>
            <span class="name">{w.name}</span>
            <span class="meta muted">
              {countLabel(i.count, EXERCISES)}{#if app.active?.workoutId === w.id}{' · '}<span class="live">идёт сейчас</span>{:else if i.last}{' · '}{formatRelative(i.last.startedAt, app.now)}{/if}
            </span>
            {#if i.muscles.length > 0}
              <span class="muscles">
                {#each i.muscles as m (m)}<span class="chip">{muscleName(m)}</span>{/each}
              </span>
            {/if}
          </button>
        {/snippet}
      </SortableList>
    </div>
    <p class="muted small hint">Порядок меняется перетаскиванием за ≡</p>
  {/if}
</div>

{#if creating}
  <WorkoutForm onclose={() => (creating = false)} onsaved={(w) => app.openWorkout(w.id)} />
{/if}

<style>
  .intro {
    gap: 12px;
    padding: 24px 20px 20px;
  }

  .badge {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: var(--accent-soft);
    color: var(--accent-text);
  }

  .list {
    padding: 0 12px 0 16px;
    border-radius: var(--radius);
    background: var(--surface);
  }

  .workout {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    width: 100%;
    min-height: 72px;
    padding: 14px 0;
    border: 0;
    background: none;
    text-align: left;
  }

  .name {
    font-size: calc(18 * var(--pt));
    font-weight: 700;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .meta {
    font-size: calc(14 * var(--pt));
  }

  .live {
    color: var(--accent-text);
    font-weight: 600;
  }

  .muscles {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }

  .hint {
    margin-top: -8px;
    text-align: center;
  }
</style>
