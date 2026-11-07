<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import { groupByMuscle, groupTitle, musclesLabel } from '../core/muscles';
  import { matchesQuery } from '../core/text';
  import { app } from '../lib/app.svelte';
  import { formatRelative, formatSetLong, weightedLabel } from '../lib/format';
  import ExerciseForm from '../sheets/ExerciseForm.svelte';

  let query = $state('');
  let creating = $state(false);

  // An exercise for several muscles is listed under each of them.
  const groups = $derived(groupByMuscle(app.exercises.filter((e) => matchesQuery(e.name, query))));
</script>

<div class="screen">
  <header class="page-head">
    <h1 class="large-title">Упражнения</h1>
    {#if app.exercises.length > 0}
      <button class="icon-btn accent" aria-label="Новое упражнение" onclick={() => (creating = true)}>
        <Icon name="plus" stroke={2.6} />
      </button>
    {/if}
  </header>

  {#if app.exercises.length === 0}
    <div class="card empty">
      <h2>Упражнений пока нет</h2>
      <p class="muted">
        У каждого упражнения своя история весов и повторений — общая для всех тренировок, где оно встречается.
      </p>
      <button class="btn btn-primary btn-block" onclick={() => (creating = true)}>
        <Icon name="plus" stroke={2.6} /> Создать упражнение
      </button>
    </div>
  {:else}
    <label class="search">
      <Icon name="search" size={20} />
      <span class="sr-only">Поиск</span>
      <input class="field" type="search" bind:value={query} placeholder="Поиск" autocomplete="off" enterkeyhint="search" />
    </label>

    {#each groups as group (group.muscle ?? 'none')}
      <section>
        <h2 class="eyebrow section-title">{groupTitle(group.muscle)}</h2>
        <div class="card group">
          {#each group.items as ex (ex.id)}
            {@const last = app.lastSetOf(ex.id)}
            <button class="item" onclick={() => app.openExercise(ex.id)}>
              <span class="item-text">
                <span class="item-title">{ex.name}</span>
                <span class="muted small">
                  {#if last}
                    {formatSetLong(last)} · {formatRelative(last.doneAt, app.now)}
                  {:else}
                    {ex.muscles.length > 1 ? `${musclesLabel(ex.muscles)} · ` : ''}{weightedLabel(ex.weighted)}
                  {/if}
                </span>
              </span>
              <span class="chevron"><Icon name="chevronRight" size={20} /></span>
            </button>
          {/each}
        </div>
      </section>
    {:else}
      <p class="muted nothing">Ничего не найдено.</p>
    {/each}
  {/if}
</div>

{#if creating}
  <ExerciseForm onclose={() => (creating = false)} />
{/if}

<style>
  .search {
    position: relative;
    display: block;
    color: var(--text-3);
  }

  .search :global(svg) {
    position: absolute;
    top: 50%;
    left: 12px;
    transform: translateY(-50%);
    pointer-events: none;
  }

  .search .field {
    padding-left: 40px;
    background: var(--surface);
  }

  .nothing {
    text-align: center;
  }
</style>
