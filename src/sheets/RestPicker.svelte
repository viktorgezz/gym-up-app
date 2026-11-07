<script lang="ts">
  import { untrack } from 'svelte';
  import Icon from '../components/Icon.svelte';
  import Sheet from '../components/Sheet.svelte';
  import { REST_MAX_SEC, REST_MIN_SEC, REST_PRESETS, REST_STEP_SEC, clampRestSec } from '../core/rest';
  import type { Exercise } from '../core/types';
  import { app } from '../lib/app.svelte';
  import { formatSec } from '../lib/format';

  /** Pick a rest length: a preset starts at once, or set your own with ±15 s. */
  let { exercise, onclose }: { exercise: Exercise | null; onclose: () => void } = $props();

  const suggested = untrack(() => exercise?.restSec) ?? app.settings.defaultRestSec;
  let custom = $state(suggested);

  function start(sec: number) {
    app.startRest(sec);
    onclose();
  }
</script>

<Sheet title="Таймер отдыха" size="bottom" {onclose}>
  <div class="picker">
    <div class="presets">
      {#each REST_PRESETS as sec (sec)}
        <button class="preset num" class:on={sec === suggested} onclick={() => start(sec)}>{formatSec(sec)}</button>
      {/each}
    </div>

    <div class="custom">
      <button
        class="icon-btn"
        aria-label="Меньше на {REST_STEP_SEC} секунд"
        disabled={custom <= REST_MIN_SEC}
        onclick={() => (custom = clampRestSec(custom - REST_STEP_SEC))}
      >
        <Icon name="minus" />
      </button>
      <span class="value num" aria-live="polite">{formatSec(custom)}</span>
      <button
        class="icon-btn"
        aria-label="Больше на {REST_STEP_SEC} секунд"
        disabled={custom >= REST_MAX_SEC}
        onclick={() => (custom = clampRestSec(custom + REST_STEP_SEC))}
      >
        <Icon name="plus" />
      </button>
    </div>

    <button class="btn btn-primary btn-lg btn-block" onclick={() => start(custom)}>
      <Icon name="timer" size={22} /> Начать отдых {formatSec(custom)}
    </button>
    <p class="muted small note">
      Отсчёт продолжится, даже если открыть другое приложение. Сигнал звучит поверх музыки, когда Gym Up на экране.
    </p>
  </div>
</Sheet>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .presets {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .preset {
    min-height: 52px;
    border: 0;
    border-radius: 14px;
    background: var(--surface-2);
    font-size: 20px;
    font-weight: 700;
  }

  .preset.on {
    background: var(--accent-soft);
    color: var(--accent-text);
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }

  .preset:active {
    transform: scale(0.97);
  }

  .custom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px;
    border-radius: 18px;
    background: var(--surface-2);
  }

  .custom .icon-btn {
    background: var(--surface-3);
  }

  .value {
    font-size: 34px;
    font-weight: 700;
  }

  .note {
    margin: 0 4px;
    text-align: center;
  }
</style>
