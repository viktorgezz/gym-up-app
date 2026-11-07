<script lang="ts">
  import { app } from '../lib/app.svelte';

  const KEY = 'gym-up:install-hint-dismissed';

  function wasDismissed(): boolean {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  }

  let dismissed = $state(wasDismissed());

  function dismiss() {
    dismissed = true;
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // Private mode: the hint just comes back next time.
    }
  }
</script>

{#if !app.standalone && !dismissed}
  <aside class="card hint">
    <p class="title">Установите на экран «Домой»</p>
    <p class="muted small">
      В Safari нажмите <strong>•••</strong> → <strong>Поделиться</strong> → <strong>На экран «Домой»</strong>, оставьте
      включённым «Открыть как веб-приложение» и запускайте Gym Up с иконки. У вкладки Safari и у приложения разные
      хранилища данных.
    </p>
    <button class="link" onclick={dismiss}>Понятно</button>
  </aside>
{/if}

<style>
  .hint {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding: 16px 16px 8px;
    border: 1px solid var(--accent-soft);
  }

  .title {
    font-weight: 700;
  }

  strong {
    color: var(--text);
  }

  .link {
    margin-left: -8px;
  }
</style>
