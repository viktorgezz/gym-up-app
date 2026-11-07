<script lang="ts">
  import { formatInputNumber, parseDecimal } from '../lib/format';
  import Icon from './Icon.svelte';

  /**
   * A number with − and + around it. The number itself is a field: tap it to type any
   * value (decimal keyboard for weights). NaN while the field is empty.
   */
  let {
    value = $bindable(),
    min = 0,
    max = 999,
    step = 1,
    decimals = 0,
    label,
    big = false,
  }: {
    value: number;
    min?: number;
    max?: number;
    step?: number;
    /** Digits allowed after the comma. */
    decimals?: number;
    label: string;
    big?: boolean;
  } = $props();

  let focused = $state(false);
  let text = $state('');

  // Typed text stays as typed ("62," while typing); otherwise show the value.
  $effect(() => {
    if (!focused) text = formatInputNumber(value);
  });

  const factor = $derived(10 ** decimals);
  const round = (n: number) => Math.round(n * factor) / factor;
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  /** ± snaps to the step grid: 61 with step 2.5 goes to 62.5 or 60. */
  function bump(direction: 1 | -1) {
    const base = Number.isFinite(value) ? value : min;
    const eps = 1e-9;
    const next =
      direction > 0 ? (Math.floor(base / step + eps) + 1) * step : (Math.ceil(base / step - eps) - 1) * step;
    value = clamp(round(next));
    text = formatInputNumber(value);
  }

  function onInput(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    let raw = input.value.replace(/\./g, ',').replace(/[^\d,]/g, '');
    if (decimals === 0) raw = raw.replace(/,/g, '');
    else {
      const comma = raw.indexOf(',');
      if (comma >= 0) raw = raw.slice(0, comma + 1) + raw.slice(comma + 1).replace(/,/g, '').slice(0, decimals);
    }
    raw = raw.slice(0, 7);
    // Drop junk from the field itself: when the number doesn't change, `text` won't repaint it.
    if (input.value !== raw) input.value = raw;
    text = raw;
    value = parseDecimal(raw);
  }

  function onFocus(e: FocusEvent) {
    focused = true;
    const input = e.currentTarget as HTMLInputElement;
    // iOS ignores select() inside the focus event itself.
    requestAnimationFrame(() => input.select());
  }

  function onBlur() {
    focused = false;
    value = clamp(round(Number.isFinite(value) ? value : min));
    text = formatInputNumber(value);
  }
</script>

<div class="stepper" class:big>
  <button
    class="icon-btn"
    type="button"
    aria-label="Уменьшить: {label}"
    disabled={Number.isFinite(value) && value <= min}
    onclick={() => bump(-1)}
  >
    <Icon name="minus" size={big ? 28 : 24} />
  </button>
  <label class="field-wrap">
    <span class="sr-only">{label}</span>
    <input
      class="num"
      inputmode={decimals > 0 ? 'decimal' : 'numeric'}
      pattern={decimals > 0 ? undefined : '[0-9]*'}
      enterkeyhint="done"
      autocomplete="off"
      value={text}
      oninput={onInput}
      onfocus={onFocus}
      onblur={onBlur}
      onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  </label>
  <button
    class="icon-btn"
    type="button"
    aria-label="Увеличить: {label}"
    disabled={Number.isFinite(value) && value >= max}
    onclick={() => bump(1)}
  >
    <Icon name="plus" size={big ? 28 : 24} />
  </button>
</div>

<style>
  .stepper {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .field-wrap {
    flex: 1;
    min-width: 0;
  }

  input {
    width: 100%;
    min-width: 0;
    padding: 0;
    border: 0;
    border-radius: 12px;
    background: none;
    text-align: center;
    font-size: 28px;
    font-weight: 700;
    outline: none;
  }

  input:focus {
    background: var(--surface-2);
  }

  .big .icon-btn {
    width: 60px;
    height: 60px;
  }

  .big input {
    font-size: 52px;
    line-height: 1.15;
    letter-spacing: -0.03em;
  }
</style>
