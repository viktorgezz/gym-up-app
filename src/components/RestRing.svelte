<script lang="ts">
  import { formatClock } from '../lib/format';

  let { remainingMs, totalMs, done = false }: { remainingMs: number; totalMs: number; done?: boolean } = $props();

  const R = 45;
  const C = 2 * Math.PI * R;
  const fraction = $derived(done ? 1 : totalMs > 0 ? Math.min(1, remainingMs / totalMs) : 0);
</script>

<div class="ring" class:done role="timer" aria-label="Отдых: осталось {formatClock(remainingMs)}">
  <svg viewBox="0 0 100 100" aria-hidden="true">
    <circle class="track" cx="50" cy="50" r={R} />
    <circle class="fill" cx="50" cy="50" r={R} stroke-dasharray={C} stroke-dashoffset={C * (1 - fraction)} />
  </svg>
  <span class="time num">{done ? '0:00' : formatClock(remainingMs)}</span>
</div>

<style>
  .ring {
    position: relative;
    flex: none;
    width: var(--ring-size, 112px);
    aspect-ratio: 1;
    container-type: inline-size;
  }

  svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }

  circle {
    fill: none;
    stroke-width: 7;
  }

  .track {
    stroke: var(--surface-3);
  }

  .fill {
    stroke: var(--accent);
    stroke-linecap: round;
  }

  .time {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    /* Scales with the ring. */
    font-size: 24cqi;
    font-weight: 700;
    letter-spacing: -0.03em;
  }

  .done .fill {
    animation: pulse 1s ease-in-out 3;
  }

  @keyframes pulse {
    50% {
      opacity: 0.35;
    }
  }
</style>
