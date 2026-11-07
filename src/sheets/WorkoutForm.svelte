<script lang="ts">
  import { untrack } from 'svelte';
  import Icon from '../components/Icon.svelte';
  import Sheet from '../components/Sheet.svelte';
  import SortableList from '../components/SortableList.svelte';
  import { MAX_NAME } from '../core/limits';
  import { mergeSelection } from '../core/list';
  import { musclesLabel } from '../core/muscles';
  import type { Exercise, Workout } from '../core/types';
  import { app } from '../lib/app.svelte';
  import { ask } from '../lib/confirm.svelte';
  import ExercisePicker from './ExercisePicker.svelte';

  /** Create a workout (name + exercises), or edit one when `workout` is given. */
  let {
    workout,
    onclose,
    onsaved,
  }: {
    workout?: Workout;
    onclose: () => void;
    onsaved?: (workout: Workout) => void;
  } = $props();

  // Form state starts from the props once; the sheet is re-created for every edit.
  const original = untrack(() => workout);
  let name = $state(original?.name ?? '');
  let ids = $state.raw<string[]>(original ? original.exerciseIds.filter((id) => app.exerciseById.has(id)) : []);
  let picking = $state(false);
  let saving = $state(false);
  /** Save was tapped without a name: say so. */
  let tried = $state(false);
  let nameInput: HTMLInputElement;

  const items = $derived(ids.map((id) => app.exerciseById.get(id)).filter((e): e is Exercise => e !== undefined));
  const nameMissing = $derived(name.trim().length === 0);

  async function save() {
    if (saving) return;
    if (nameMissing) {
      tried = true;
      nameInput.focus();
      return;
    }
    saving = true;
    try {
      const exerciseIds = items.map((e) => e.id);
      if (original) {
        await app.updateWorkout(original.id, { name, exerciseIds });
        onsaved?.(original);
      } else {
        // Not `onsaved?.(await create())`: without a listener that would skip creating altogether.
        const created = await app.createWorkout(name, exerciseIds);
        onsaved?.(created);
      }
      onclose();
    } finally {
      saving = false;
    }
  }

  async function remove() {
    if (!original) return;
    const ok = await ask(`Удалить тренировку «${original.name}»? Упражнения и их история останутся.`, {
      confirmLabel: 'Удалить тренировку',
      danger: true,
    });
    if (!ok) return;
    onclose();
    await app.deleteWorkout(original.id);
  }
</script>

<Sheet title={original ? 'Изменить тренировку' : 'Новая тренировка'} {onclose}>
  {#snippet left()}
    <button class="link" onclick={onclose}>Отмена</button>
  {/snippet}
  {#snippet right()}
    <button class="link strong" disabled={saving} onclick={save}>{original ? 'Готово' : 'Создать'}</button>
  {/snippet}

  <div class="form">
    <label class="block">
      <span class="eyebrow">Название</span>
      <input
        bind:this={nameInput}
        class="field"
        class:invalid={tried && nameMissing}
        bind:value={name}
        maxlength={MAX_NAME}
        placeholder="Например, грудь и трицепс"
        autocomplete="off"
        autocapitalize="sentences"
        enterkeyhint="done"
        onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      {#if tried && nameMissing}<span class="error small">Введите название</span>{/if}
    </label>

    <div class="block">
      <span class="eyebrow">Упражнения · {items.length}</span>
      {#if items.length > 0}
        <div class="exercises">
        <SortableList
          items={items}
          key={(e) => e.id}
          label={(e) => `Переместить «${e.name}»`}
          onreorder={(list) => (ids = list.map((e) => e.id))}
        >
          {#snippet row(ex, i)}
            <div class="row">
              <button class="remove" type="button" aria-label="Убрать «{ex.name}»" onclick={() => (ids = ids.filter((x) => x !== ex.id))}>
                <Icon name="removeCircle" size={24} />
              </button>
              <span class="idx num">{i + 1}</span>
              <span class="item-text">
                <span class="item-title">{ex.name}</span>
                <span class="muted small">{musclesLabel(ex.muscles)}</span>
              </span>
            </div>
          {/snippet}
        </SortableList>
        </div>
      {:else}
        <p class="muted small empty-note">Добавьте упражнения — тренировка просто хранит их в нужном порядке.</p>
      {/if}
      <button class="btn btn-block add" onclick={() => (picking = true)}>
        <Icon name="plus" size={20} /> Добавить упражнения
      </button>
    </div>

    {#if original}
      <button class="btn btn-danger btn-block" onclick={remove}><Icon name="trash" size={20} /> Удалить тренировку</button>
    {/if}
  </div>
</Sheet>

{#if picking}
  <ExercisePicker
    selected={ids}
    onclose={() => (picking = false)}
    ondone={(picked) => {
      ids = mergeSelection(ids, picked);
      picking = false;
    }}
  />
{/if}

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding-top: 8px;
  }

  .field.invalid {
    box-shadow: 0 0 0 2px var(--danger);
  }

  .error {
    margin-left: 4px;
    color: var(--danger);
    font-weight: 600;
  }

  .exercises {
    padding: 0 12px 0 4px;
    border-radius: var(--radius);
    background: var(--surface);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 56px;
    padding: 6px 0;
  }

  .remove {
    display: grid;
    place-items: center;
    flex: none;
    width: 40px;
    height: 44px;
    border: 0;
    background: none;
    color: var(--danger);
  }

  .idx {
    flex: none;
    width: 20px;
    color: var(--text-3);
    font-weight: 700;
    text-align: center;
  }

  .empty-note {
    margin: 0 4px;
  }

  .add {
    color: var(--accent-text);
  }
</style>
