<script lang="ts">
  import { untrack } from 'svelte';
  import { useRegisterSW } from 'virtual:pwa-register/svelte';
  import ConfirmSheet from './components/ConfirmSheet.svelte';
  import MiniBar from './components/MiniBar.svelte';
  import TabBar from './components/TabBar.svelte';
  import Toast from './components/Toast.svelte';
  import { app, type Tab } from './lib/app.svelte';
  import ActiveScreen from './screens/ActiveScreen.svelte';
  import ExerciseScreen from './screens/ExerciseScreen.svelte';
  import ExercisesScreen from './screens/ExercisesScreen.svelte';
  import SettingsScreen from './screens/SettingsScreen.svelte';
  import SummaryScreen from './screens/SummaryScreen.svelte';
  import WorkoutScreen from './screens/WorkoutScreen.svelte';
  import WorkoutsScreen from './screens/WorkoutsScreen.svelte';
  import { keepScreenOn } from './services/wakeLock';

  const { needRefresh, updateServiceWorker } = useRegisterSW({
    // iOS keeps the app in memory for days without reloading it: look for a new
    // version every time it comes back to the foreground, not only at launch.
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) registration.update().catch(() => {});
      });
    },
  });

  app.init();

  // --- clock ------------------------------------------------------------------
  // Ticks while a workout runs: ~10 fps during a rest (the ring), once a second otherwise
  // (the workout time). Lives here, not on the workout screen, so the rest ends and beeps
  // on any screen. The rest is stored as its end time: after iOS froze the app in the
  // background, the first tick already shows the right value.
  $effect(() => {
    const active = app.active;
    if (!active) return;
    const rest = active.rest;
    let lastSecond = Infinity;
    let lastPaint = 0;
    let frame = 0;
    let interval = 0;

    const tick = () => {
      const t = Date.now();
      if (!rest) {
        app.now = t;
        return;
      }
      if (app.active?.rest !== rest) return;
      const remaining = rest.endsAt - t;
      const second = Math.ceil(remaining / 1000);
      if (second !== lastSecond || t - lastPaint >= 100) {
        app.now = t;
        lastPaint = t;
      }
      if (second !== lastSecond && second >= 1 && second <= 3 && lastSecond !== Infinity) app.restTick();
      lastSecond = second;
      if (remaining <= 0) app.restElapsed();
    };

    if (rest) {
      const loop = () => {
        tick();
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
    } else {
      interval = window.setInterval(tick, 1000);
    }

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      lastSecond = Infinity;
      tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    untrack(tick);

    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  });

  // --- screen on during a workout ---------------------------------------------
  const running = $derived(app.active !== null);
  $effect(() => {
    if (running && app.settings.keepAwake) return keepScreenOn();
  });

  /** "Today" and "3 days ago" are right after the app sat in the background overnight. */
  function onVisibility() {
    if (document.visibilityState === 'visible') app.now = Date.now();
  }

  // --- scroll position per screen ---------------------------------------------
  let scroller = $state<HTMLElement>();
  const route = $derived(app.route);
  const depth = $derived(app.stacks[app.tab].length);
  const screenKey = $derived(`${app.tab}/${depth}/${route ? `${route.name}:${route.id}` : 'root'}`);

  const saved = new Map<string, number>();
  let shown = { tab: 'workouts' as Tab, depth: 0, key: '' };

  // Before the screen changes: remember where the old one was scrolled to.
  $effect.pre(() => {
    void screenKey;
    untrack(() => {
      if (scroller && shown.key) saved.set(`${shown.tab}/${shown.depth}`, scroller.scrollTop);
    });
  });

  // After: a newly opened screen starts at the top, Back and tab switches return to where it was.
  $effect(() => {
    const key = screenKey;
    untrack(() => {
      const tab = app.tab;
      const forward = tab === shown.tab && depth > shown.depth;
      if (forward) {
        for (const k of [...saved.keys()]) {
          const [t, d] = k.split('/');
          if (t === tab && Number(d) >= depth) saved.delete(k);
        }
      }
      scroller?.scrollTo(0, forward ? 0 : (saved.get(`${tab}/${depth}`) ?? 0));
      shown = { tab, depth, key };
    });
  });
</script>

<svelte:document onvisibilitychange={onVisibility} />

{#if app.error}
  <div class="fatal" role="alert">
    <p>{app.error}</p>
    <button class="btn btn-primary" onclick={() => location.reload()}>Перезагрузить</button>
  </div>
{:else if app.ready}
  {#if app.mode === 'active' && app.active}
    <ActiveScreen />
  {:else if app.mode === 'summary' && app.summaryId}
    <SummaryScreen />
  {:else}
    <!-- With the workout minimized the rest still beeps: any tap re-enables audio after iOS suspended it. -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="shell" onclick={() => app.active && app.unlockSound()}>
      <div class="statusbar" aria-hidden="true"></div>
      <div class="content" bind:this={scroller}>
        {#key screenKey}
          {#if route?.name === 'workout'}
            <WorkoutScreen id={route.id} />
          {:else if route?.name === 'exercise'}
            <ExerciseScreen id={route.id} />
          {:else if app.tab === 'exercises'}
            <ExercisesScreen />
          {:else if app.tab === 'settings'}
            <SettingsScreen />
          {:else}
            <WorkoutsScreen />
          {/if}
        {/key}
      </div>
      {#if app.active}<MiniBar />{/if}
      <TabBar />
    </div>
  {/if}
{/if}

{#if $needRefresh && app.mode !== 'active'}
  <div class="update" role="status">
    <span>Доступна новая версия</span>
    <button class="btn btn-primary btn-sm" onclick={() => updateServiceWorker(true)}>Обновить</button>
  </div>
{/if}

<Toast />
<ConfirmSheet />

<style>
  .shell {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  /* Content scrolling under the status bar would collide with the clock and battery. */
  .statusbar {
    position: absolute;
    z-index: 10;
    top: 0;
    left: 0;
    right: 0;
    height: var(--safe-top);
    background: color-mix(in srgb, var(--bg) 82%, transparent);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    pointer-events: none;
  }

  .content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .fatal {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    height: 100%;
    padding: var(--gutter);
    text-align: center;
  }

  .update {
    position: fixed;
    z-index: 20;
    left: calc(env(safe-area-inset-left) + var(--gutter));
    right: calc(env(safe-area-inset-right) + var(--gutter));
    bottom: calc(var(--safe-bottom) + var(--tabbar-h) + 20px);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 10px 10px 16px;
    border-radius: 18px;
    background: var(--surface-2);
    box-shadow: 0 8px 32px rgb(0 0 0 / 0.35);
    font-weight: 600;
  }
</style>
