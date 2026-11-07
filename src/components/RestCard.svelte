<script lang="ts">
  import { REST_STEP_SEC, restRemainingMs, restTotalMs } from '../core/rest';
  import { app, REST_NOTICE_MS } from '../lib/app.svelte';
  import { formatClock } from '../lib/format';
  import Icon from './Icon.svelte';
  import RestRing from './RestRing.svelte';

  /** The running rest, or "Rest is over" for a few seconds after it. */
  const rest = $derived(app.active?.rest ?? null);
  const remaining = $derived(restRemainingMs(rest, app.now));
  const total = $derived(rest ? restTotalMs(rest) : 1);
  const notice = $derived(app.restNotice && app.now - app.restNotice.shownAt < REST_NOTICE_MS ? app.restNotice : null);
  /** It ended while the app was in the background. */
  const late = $derived(notice ? notice.shownAt - notice.endedAt > 3000 : false);
</script>

{#if rest}
  <section class="rest card" aria-label="Отдых">
    <RestRing remainingMs={remaining} totalMs={total} />
    <div class="side">
      <p class="eyebrow">Отдых · {formatClock(total)}</p>
      <div class="adjust">
        <button class="btn btn-sm" onclick={() => app.adjustRest(-REST_STEP_SEC)}>−{REST_STEP_SEC} с</button>
        <button class="btn btn-sm" onclick={() => app.adjustRest(REST_STEP_SEC)}>+{REST_STEP_SEC} с</button>
      </div>
      <button class="btn btn-sm skip" onclick={() => app.skipRest()}><Icon name="skip" size={16} /> Пропустить</button>
    </div>
  </section>
{:else if notice}
  <section class="rest card done" role="status">
    <RestRing remainingMs={0} totalMs={1} done />
    <div class="side">
      <p class="title">Отдых окончен</p>
      <p class="muted small">{late ? `Закончился ${formatClock(notice.shownAt - notice.endedAt)} назад` : 'Пора делать подход'}</p>
      <button class="btn btn-sm" onclick={() => app.dismissRestNotice()}>OK</button>
    </div>
  </section>
{/if}

<style>
  .rest {
    --ring-size: 104px;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 16px;
  }

  .side {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  .adjust {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .btn-sm {
    padding: 0 8px;
  }

  .skip {
    background: var(--accent-soft);
    color: var(--accent-text);
  }

  .done {
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }

  .title {
    font-size: calc(19 * var(--pt));
    font-weight: 700;
  }

  .done .btn-sm {
    align-self: flex-start;
    min-width: 72px;
  }
</style>
