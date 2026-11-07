<script lang="ts">
  import { restRemainingMs } from '../core/rest';
  import { app } from '../lib/app.svelte';
  import { formatClock, formatDay, formatElapsed } from '../lib/format';
  import Icon from './Icon.svelte';

  /** The running workout while the tabs are shown: one tap goes back to it. */
  const a = $derived(app.active);
  const stale = $derived(a !== null && app.isStale(a, app.now));
  const remaining = $derived(a?.rest ? restRemainingMs(a.rest, app.now) : 0);
</script>

{#if a}
  <button class="minibar" onclick={() => app.resume()}>
    <span class="dot" class:resting={a.rest !== null}></span>
    <span class="text">
      <span class="name">{a.workoutName}</span>
      <span class="state num">
        {#if a.rest}
          Отдых · {formatClock(remaining)}
        {:else if stale}
          Не завершена · {formatDay(a.startedAt, app.now)}
        {:else}
          Идёт · {formatElapsed(app.now - a.startedAt)}
        {/if}
      </span>
    </span>
    <span class="open">Открыть <Icon name="chevronRight" size={18} /></span>
  </button>
{/if}

<style>
  .minibar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: none;
    width: calc(100% - 16px);
    max-width: 624px;
    margin: 0 auto 6px;
    padding: 10px 10px 10px 16px;
    border: 0;
    border-radius: 18px;
    background: var(--surface-2);
    box-shadow: 0 -4px 24px rgb(0 0 0 / 0.35);
    text-align: left;
  }

  .dot {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--accent);
    animation: blink 2s ease-in-out infinite;
  }

  .dot.resting {
    background: var(--gold);
  }

  .text {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .name {
    overflow: hidden;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .state {
    color: var(--text-2);
    font-size: calc(14 * var(--pt));
  }

  .open {
    display: inline-flex;
    align-items: center;
    flex: none;
    color: var(--accent-text);
    font-weight: 600;
  }

  @keyframes blink {
    50% {
      opacity: 0.35;
    }
  }
</style>
