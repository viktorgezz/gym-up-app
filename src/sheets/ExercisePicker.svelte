<script lang="ts">
  import { untrack } from 'svelte';
  import Icon from '../components/Icon.svelte';
  import Sheet from '../components/Sheet.svelte';
  import { groupByMuscle, groupTitle, musclesLabel } from '../core/muscles';
  import { matchesQuery, normalizeName } from '../core/text';
  import { app } from '../lib/app.svelte';
  import { weightedLabel } from '../lib/format';
  import ExerciseForm from './ExerciseForm.svelte';

  /**
   * Multi-select of exercises, grouped by muscle from the top of the body down. Returns the
   * picked ids in the order they were picked (already selected ones first).
   */
  let {
    title = 'Упражнения',
    selected = [],
    exclude = [],
    onclose,
    ondone,
  }: {
    title?: string;
    selected?: readonly string[];
    /** Hidden from the list (e.g. already in the running workout). */
    exclude?: readonly string[];
    onclose: () => void;
    ondone: (ids: string[]) => void;
  } = $props();

  // Starts from the props once; the sheet is re-created every time it opens.
  let picked = $state<string[]>(untrack(() => [...selected]));
  let query = $state('');
  let creating = $state(false);

  const pickedSet = $derived(new Set(picked));
  const excluded = $derived(new Set(exclude));
  const available = $derived(app.exercises.filter((e) => !excluded.has(e.id)));
  // An exercise for several muscles shows in each of their groups; ticking it anywhere ticks it everywhere.
  const groups = $derived(groupByMuscle(available.filter((e) => matchesQuery(e.name, query))));
  const exactMatch = $derived(app.exercises.some((e) => normalizeName(e.name) === normalizeName(query)));

  function toggle(id: string) {
    picked = pickedSet.has(id) ? picked.filter((x) => x !== id) : [...picked, id];
  }
</script>

<Sheet {title} {onclose}>
  {#snippet left()}
    <button class="link" onclick={onclose}>Отмена</button>
  {/snippet}
  {#snippet right()}
    <button class="link strong" onclick={() => ondone(picked)}>Готово{picked.length ? ` (${picked.length})` : ''}</button>
  {/snippet}

  <div class="picker">
    {#if app.exercises.length > 0}
      <label class="search">
        <Icon name="search" size={20} />
        <span class="sr-only">Поиск</span>
        <input class="field" type="search" bind:value={query} placeholder="Поиск" autocomplete="off" enterkeyhint="search" />
      </label>
    {/if}

    <button class="btn btn-block create" onclick={() => (creating = true)}>
      <Icon name="plus" size={20} />
      {query.trim() && !exactMatch ? `Создать «${query.trim()}»` : 'Создать упражнение'}
    </button>

    {#if app.exercises.length === 0}
      <p class="muted nothing">Упражнений пока нет — создайте первое.</p>
    {/if}

    {#each groups as group (group.muscle ?? 'none')}
      <section>
        <h3 class="eyebrow section-title">{groupTitle(group.muscle)}</h3>
        <div class="card group">
          {#each group.items as ex (ex.id)}
            {@const on = pickedSet.has(ex.id)}
            <button class="item" role="checkbox" aria-checked={on} onclick={() => toggle(ex.id)}>
              <span class="check" class:on>{#if on}<Icon name="check" size={16} stroke={3} />{/if}</span>
              <span class="item-text">
                <span class="item-title">{ex.name}</span>
                <span class="muted small">
                  {ex.muscles.length > 1 ? `${musclesLabel(ex.muscles)} · ` : ''}{weightedLabel(ex.weighted)}
                </span>
              </span>
            </button>
          {/each}
        </div>
      </section>
    {/each}

    {#if query.trim() && groups.length === 0 && available.length > 0}
      <p class="muted nothing">Ничего не найдено.</p>
    {/if}
  </div>
</Sheet>

{#if creating}
  <ExerciseForm
    initialName={exactMatch ? '' : query.trim()}
    onclose={() => (creating = false)}
    onsaved={(e) => {
      picked = [...picked, e.id];
      query = '';
    }}
  />
{/if}

<style>
  .picker {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-top: 4px;
  }

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
  }

  .create {
    color: var(--accent-text);
  }

  .item {
    justify-content: flex-start;
  }

  .check {
    display: grid;
    place-items: center;
    flex: none;
    width: 26px;
    height: 26px;
    border: 2px solid var(--text-3);
    border-radius: 50%;
    color: var(--on-accent);
  }

  .check.on {
    border-color: var(--accent);
    background: var(--accent);
  }

  .nothing {
    text-align: center;
  }
</style>
