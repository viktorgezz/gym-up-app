<script lang="ts">
  import type { Snippet } from 'svelte';
  import { app } from '../lib/app.svelte';
  import Icon from './Icon.svelte';

  let { actions }: { actions?: Snippet } = $props();
</script>

<header class="navbar">
  <button class="back" onclick={() => app.back()}>
    <Icon name="chevronLeft" size={26} stroke={2.4} />
    <span>{app.backLabel}</span>
  </button>
  <div class="actions">{@render actions?.()}</div>
</header>

<style>
  .navbar {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: calc(var(--safe-top) + 2px) 8px 2px 2px;
    background: color-mix(in srgb, var(--bg) 82%, transparent);
    backdrop-filter: blur(20px) saturate(1.4);
    -webkit-backdrop-filter: blur(20px) saturate(1.4);
  }

  .back {
    display: flex;
    align-items: center;
    min-width: 0;
    min-height: 44px;
    padding: 0 8px 0 0;
    border: 0;
    background: none;
    color: var(--accent-text);
    font-size: calc(17 * var(--pt));
  }

  .back span {
    max-width: 52vw;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .back:active {
    opacity: 0.6;
  }

  .actions {
    display: flex;
    flex: none;
  }
</style>
