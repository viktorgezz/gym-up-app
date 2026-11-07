<script lang="ts">
  import { untrack } from 'svelte';
  import Icon from '../components/Icon.svelte';
  import Segmented from '../components/Segmented.svelte';
  import Sheet from '../components/Sheet.svelte';
  import { MAX_NAME } from '../core/limits';
  import { MUSCLES, musclesLabel, type MuscleId } from '../core/muscles';
  import { normalizeName } from '../core/text';
  import type { Exercise } from '../core/types';
  import { app } from '../lib/app.svelte';
  import { ask } from '../lib/confirm.svelte';
  import { countLabel, SETS } from '../lib/format';

  /** Create an exercise, or edit one when `exercise` is given. */
  let {
    exercise,
    initialName = '',
    onclose,
    onsaved,
  }: {
    exercise?: Exercise;
    initialName?: string;
    onclose: () => void;
    onsaved?: (exercise: Exercise) => void;
  } = $props();

  // Form state starts from the props once; the sheet is re-created for every edit.
  const original = untrack(() => exercise);
  let name = $state(original?.name ?? untrack(() => initialName));
  let muscles = $state.raw<MuscleId[]>(original ? [...original.muscles] : []);
  let weighted = $state(original?.weighted ?? true);
  let saving = $state(false);
  /** Save was tapped with something missing: say what. */
  let tried = $state(false);

  let nameInput: HTMLInputElement;
  let musclesBox: HTMLElement;

  const trimmed = $derived(name.trim());
  const nameMissing = $derived(trimmed.length === 0);
  const musclesMissing = $derived(muscles.length === 0);
  const duplicate = $derived(
    !nameMissing && app.exercises.some((e) => e.id !== original?.id && normalizeName(e.name) === normalizeName(trimmed)),
  );
  const typeOptions = [
    { value: true, label: 'С весом' },
    { value: false, label: 'Без веса' },
  ];

  function toggle(id: MuscleId) {
    muscles = muscles.includes(id) ? muscles.filter((m) => m !== id) : [...muscles, id];
  }

  async function save() {
    if (saving) return;
    // The save button stays enabled: a dimmed button gives no clue what is missing,
    // and on iPhone the keyboard covers the muscle list.
    if (nameMissing || musclesMissing) {
      tried = true;
      if (nameMissing) nameInput.focus();
      else {
        nameInput.blur();
        musclesBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    saving = true;
    try {
      const input = { name: trimmed, muscles, weighted };
      if (original) {
        await app.updateExercise(original.id, input);
        onsaved?.(app.exerciseById.get(original.id) ?? original);
      } else {
        // Not `onsaved?.(await create())`: without a listener that would skip creating altogether.
        const created = await app.createExercise(input);
        onsaved?.(created);
      }
      onclose();
    } finally {
      saving = false;
    }
  }

  async function remove() {
    if (!original) return;
    const sets = app.historyOf(original.id).length;
    const ok = await ask(
      `Удалить «${original.name}»? Оно исчезнет из всех тренировок${sets ? `, история (${countLabel(sets, SETS)}) удалится` : ''}.`,
      { confirmLabel: 'Удалить упражнение', danger: true },
    );
    if (!ok) return;
    onclose();
    await app.deleteExercise(original.id);
  }
</script>

<Sheet title={original ? 'Упражнение' : 'Новое упражнение'} {onclose}>
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
        placeholder="Например, жим лёжа"
        autocomplete="off"
        autocapitalize="sentences"
        enterkeyhint="done"
        onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      {#if tried && nameMissing}
        <span class="error small">Введите название</span>
      {:else if duplicate}
        <span class="warn small">Упражнение с таким названием уже есть.</span>
      {/if}
    </label>

    <div class="block">
      <span class="eyebrow">Тип</span>
      <Segmented options={typeOptions} bind:value={weighted} label="Тип упражнения" />
      <span class="muted small hint">
        {weighted ? 'Записываются вес и повторения.' : 'Записываются только повторения.'}
      </span>
    </div>

    <fieldset class="block" bind:this={musclesBox}>
      <legend class="eyebrow">Группы мышц</legend>
      {#if tried && musclesMissing}
        <span class="error small">Выберите хотя бы одну группу</span>
      {:else}
        <span class="muted small hint">
          {musclesMissing ? 'Можно выбрать несколько' : `Выбрано: ${musclesLabel(muscles)}`}
        </span>
      {/if}
      <div class="card group muscles" class:invalid={tried && musclesMissing}>
        {#each MUSCLES as m (m.id)}
          {@const on = muscles.includes(m.id)}
          <button type="button" role="checkbox" aria-checked={on} class="item" class:on onclick={() => toggle(m.id)}>
            <span>{m.name}</span>
            <span class="check" class:on>{#if on}<Icon name="check" size={16} stroke={3} />{/if}</span>
          </button>
        {/each}
      </div>
    </fieldset>

    {#if original}
      <button class="btn btn-danger btn-block" onclick={remove}><Icon name="trash" size={20} /> Удалить упражнение</button>
    {/if}
  </div>
</Sheet>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding-top: 8px;
  }

  .warn {
    margin-left: 4px;
    color: var(--gold);
  }

  .error {
    margin-left: 4px;
    color: var(--danger);
    font-weight: 600;
  }

  .hint {
    margin-left: 4px;
  }

  legend {
    margin-bottom: 8px;
  }

  .field.invalid {
    box-shadow: 0 0 0 2px var(--danger);
  }

  .muscles {
    margin-top: 2px;
  }

  .muscles.invalid {
    box-shadow: inset 0 0 0 2px var(--danger);
  }

  .muscles .item {
    min-height: 48px;
  }

  .muscles .item.on {
    color: var(--accent-text);
    font-weight: 600;
  }

  .check {
    display: grid;
    place-items: center;
    flex: none;
    width: 24px;
    height: 24px;
    border: 2px solid var(--text-3);
    border-radius: 7px;
    color: var(--on-accent);
  }

  .check.on {
    border-color: var(--accent);
    background: var(--accent);
  }
</style>
