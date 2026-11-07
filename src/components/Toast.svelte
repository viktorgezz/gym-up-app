<script lang="ts">
  import { app } from '../lib/app.svelte';

  // A popover sits in the top layer, so a message shows above an open sheet (a plain fixed
  // element would stay under the modal dialog).
  const supported = 'showPopover' in HTMLElement.prototype;
  let el: HTMLDivElement;

  $effect(() => {
    const toast = app.toast;
    if (!supported) return;
    if (el.matches(':popover-open')) el.hidePopover();
    // Shown again for every message: it goes on top of sheets opened since the last one.
    if (toast) el.showPopover();
  });
</script>

<div bind:this={el} class="toast" class:shown={app.toast !== null} popover={supported ? 'manual' : undefined} role="status">
  {app.toast?.text ?? ''}
</div>

<style>
  .toast {
    position: fixed;
    z-index: 50;
    inset: calc(var(--safe-top) + 10px) 0 auto;
    width: fit-content;
    max-width: calc(100% - 2 * var(--gutter));
    margin: 0 auto;
    padding: 10px 18px;
    border: 0;
    border-radius: 999px;
    background: var(--surface-3);
    box-shadow: 0 8px 28px rgb(0 0 0 / 0.45);
    color: var(--text);
    font-size: calc(15 * var(--pt));
    font-weight: 600;
    text-align: center;
    pointer-events: none;
  }

  .toast.shown {
    animation: drop 0.22s ease-out;
  }

  .toast:not(.shown) {
    display: none;
  }

  @keyframes drop {
    from {
      opacity: 0;
      transform: translateY(-12px);
    }
  }
</style>
