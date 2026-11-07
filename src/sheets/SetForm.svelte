<script lang="ts">
  import { untrack } from 'svelte';
  import Icon from '../components/Icon.svelte';
  import Sheet from '../components/Sheet.svelte';
  import Stepper from '../components/Stepper.svelte';
  import { FIRST_REPS, FIRST_WEIGHT, isValidReps, isValidWeight, MAX_REPS, MAX_WEIGHT, roundWeight } from '../core/limits';
  import type { Exercise, SetRecord } from '../core/types';
  import { app } from '../lib/app.svelte';
  import { ask } from '../lib/confirm.svelte';
  import { formatDay, formatTime } from '../lib/format';

  /** Log a set of the exercise, or edit/delete an existing one when `set` is given. */
  let {
    exercise,
    set,
    title,
    onclose,
  }: {
    exercise: Exercise;
    set?: SetRecord;
    title?: string;
    onclose: () => void;
  } = $props();

  // Values start from the props once; the sheet is re-created for every set.
  const original = untrack(() => set);
  // A bodyweight exercise can still have old sets with a weight (it was switched): keep it editable.
  const showWeight = untrack(() => exercise.weighted) || (original !== undefined && original.weight !== null);
  const suggestion = original ?? untrack(() => app.suggestSet(exercise.id));

  let weight = $state(suggestion.weight ?? FIRST_WEIGHT);
  let reps = $state(suggestion.reps ?? FIRST_REPS);
  let saving = $state(false);

  const valid = $derived(isValidReps(reps) && (!showWeight || isValidWeight(weight)));

  async function save() {
    if (!valid || saving) return;
    saving = true;
    try {
      const w = showWeight ? roundWeight(weight) : null;
      if (original) await app.updateSet(original.id, { reps, weight: w });
      else await app.logSet(exercise.id, reps, w);
      onclose();
    } finally {
      saving = false;
    }
  }

  async function remove() {
    if (!original) return;
    if (!(await ask('Удалить этот подход из истории?', { confirmLabel: 'Удалить подход', danger: true }))) return;
    await app.deleteSet(original.id);
    onclose();
  }
</script>

<Sheet title={title ?? (original ? 'Изменить подход' : 'Записать подход')} size="bottom" {onclose}>
  <div class="form">
    <p class="exercise">
      <span class="name">{exercise.name}</span>
      {#if original}<span class="muted small">{formatDay(original.doneAt)}, {formatTime(original.doneAt)}</span>{/if}
    </p>

    {#if showWeight}
      <div class="field-block">
        <span class="eyebrow">Вес, кг</span>
        <Stepper bind:value={weight} min={0} max={MAX_WEIGHT} step={app.settings.weightStep} decimals={2} label="вес, кг" big />
      </div>
    {/if}

    <div class="field-block">
      <span class="eyebrow">Повторения</span>
      <Stepper bind:value={reps} min={1} max={MAX_REPS} label="повторения" big />
    </div>

    <button class="btn btn-primary btn-lg btn-block" disabled={!valid || saving} onclick={save}>
      <Icon name="check" size={22} stroke={2.6} /> Сохранить
    </button>
    {#if original}
      <button class="btn btn-danger btn-block" onclick={remove}><Icon name="trash" size={20} /> Удалить подход</button>
    {/if}
  </div>
</Sheet>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .exercise {
    display: flex;
    flex-direction: column;
    margin: -4px 4px 0;
  }

  .name {
    color: var(--text-2);
    font-weight: 600;
  }

  .field-block {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px 12px;
    border-radius: 20px;
    background: var(--surface-2);
  }

  .field-block .eyebrow {
    text-align: center;
  }

  .field-block :global(.icon-btn) {
    background: var(--surface-3);
  }

  .form > .btn-primary {
    margin-top: 4px;
  }
</style>
