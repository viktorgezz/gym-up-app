<script lang="ts" generics="T extends string | boolean">
  let {
    options,
    value = $bindable(),
    label,
  }: { options: readonly { value: T; label: string }[]; value: T; label: string } = $props();
</script>

<div class="segmented" role="radiogroup" aria-label={label} style:--count={options.length}>
  {#each options as option (String(option.value))}
    <button
      type="button"
      role="radio"
      aria-checked={value === option.value}
      class:on={value === option.value}
      onclick={() => (value = option.value)}
    >
      {option.label}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: grid;
    grid-template-columns: repeat(var(--count), 1fr);
    gap: 2px;
    padding: 2px;
    border-radius: 12px;
    background: var(--surface-2);
  }

  button {
    min-height: 36px;
    padding: 0 8px;
    border: 0;
    border-radius: 10px;
    background: none;
    color: var(--text-2);
    font-size: calc(15 * var(--pt));
    font-weight: 600;
  }

  button.on {
    background: var(--surface-3);
    color: var(--text);
    box-shadow: 0 1px 4px rgb(0 0 0 / 0.3);
  }
</style>
