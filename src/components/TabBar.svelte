<script lang="ts">
  import { app, TAB_TITLES, type Tab } from '../lib/app.svelte';
  import Icon, { type IconName } from './Icon.svelte';

  const tabs: { id: Tab; icon: IconName }[] = [
    { id: 'workouts', icon: 'dumbbell' },
    { id: 'exercises', icon: 'list' },
    { id: 'settings', icon: 'settings' },
  ];
</script>

<nav class="tabbar">
  {#each tabs as tab (tab.id)}
    <button
      class="tab"
      class:active={app.tab === tab.id}
      aria-current={app.tab === tab.id ? 'page' : undefined}
      onclick={() => app.selectTab(tab.id)}
    >
      <Icon name={tab.icon} size={24} />
      <span>{TAB_TITLES[tab.id]}</span>
    </button>
  {/each}
</nav>

<style>
  .tabbar {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    flex: none;
    padding: 4px 8px calc(var(--safe-bottom) + 2px);
    background: color-mix(in srgb, var(--bg) 82%, transparent);
    backdrop-filter: blur(20px) saturate(1.4);
    -webkit-backdrop-filter: blur(20px) saturate(1.4);
    border-top: 0.5px solid var(--line);
  }

  .tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-height: var(--tabbar-h);
    border: 0;
    background: none;
    color: var(--text-3);
    font-size: 11px;
    font-weight: 600;
  }

  .tab.active {
    color: var(--text);
  }

  .tab.active :global(svg) {
    color: var(--accent-text);
  }
</style>
