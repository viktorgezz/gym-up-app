<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  /**
   * A modal sheet, open while it is mounted: render it inside {#if}. A modal <dialog>
   * keeps focus inside and makes the page behind it inert; sheets opened from a sheet
   * stack on top of it.
   */
  let {
    title,
    size = 'full',
    onclose,
    left,
    right,
    children,
  }: {
    title: string;
    /** full: a page that slides up over the app; bottom: a short card above the home indicator. */
    size?: 'full' | 'bottom';
    onclose: () => void;
    /** Header buttons; a full sheet gets "Закрыть" on the left, a bottom one a close icon on the right. */
    left?: Snippet;
    right?: Snippet;
    children: Snippet;
  } = $props();

  let dialog: HTMLDialogElement;
  const titleId = `sheet-${Math.random().toString(36).slice(2, 9)}`;

  onMount(() => {
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  });

  /** Escape (hardware keyboard) counts as Cancel. */
  function onCancel(e: Event) {
    e.preventDefault();
    onclose();
  }

  function onBackdrop(e: MouseEvent) {
    if (e.target === dialog) onclose();
  }
</script>

<!-- The dialog itself takes focus (autofocus), not its first field: no keyboard pops up by itself. -->
<!-- svelte-ignore a11y_autofocus, a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog bind:this={dialog} class={size} aria-labelledby={titleId} autofocus oncancel={onCancel} onclick={onBackdrop}>
  <div class="sheet">
    <header>
      <div class="side">
        {#if left}
          {@render left()}
        {:else if size === 'full'}
          <button class="link" onclick={onclose}>Закрыть</button>
        {/if}
      </div>
      <h2 id={titleId}>{title}</h2>
      <div class="side end">
        {#if right}
          {@render right()}
        {:else if size === 'bottom'}
          <button class="icon-btn close" aria-label="Закрыть" onclick={onclose}><Icon name="close" size={18} /></button>
        {/if}
      </div>
    </header>
    <div class="body">
      {@render children()}
    </div>
  </div>
</dialog>

<style>
  dialog {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text);
    overflow: hidden;
  }

  dialog:focus {
    outline: none;
  }

  dialog::backdrop {
    background: rgb(0 0 0 / 0.55);
  }

  .sheet {
    position: absolute;
    display: flex;
    flex-direction: column;
    background: #161618;
    overflow: hidden;
    /* One step lighter inside a sheet, so cards, fields and buttons stand out from it. */
    --surface: #222225;
    --surface-2: #2d2d31;
    --surface-3: #3a3a3f;
  }

  .full .sheet {
    inset: calc(var(--safe-top) + 10px) 0 0;
    border-radius: 18px 18px 0 0;
    animation: slide-up 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .bottom .sheet {
    left: 0;
    right: 0;
    bottom: calc(max(var(--safe-bottom), var(--kb, 0px)) + 8px);
    width: min(100% - 16px - env(safe-area-inset-left) - env(safe-area-inset-right), 520px);
    max-height: calc(100% - var(--safe-top) - var(--kb, 0px) - 24px);
    margin-inline: auto;
    border-radius: 28px;
    animation: rise 0.24s ease-out;
    transition: bottom 0.2s ease;
  }

  header {
    display: grid;
    /* The buttons keep their width; a long title gets an ellipsis instead. */
    grid-template-columns: minmax(max-content, 1fr) minmax(0, auto) minmax(max-content, 1fr);
    align-items: center;
    gap: 8px;
    flex: none;
    min-height: 56px;
    padding: 6px 8px;
  }

  .bottom header {
    padding: 10px 12px 2px 20px;
  }

  h2 {
    min-width: 0;
    overflow: hidden;
    font-size: calc(17 * var(--pt));
    font-weight: 700;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bottom h2 {
    grid-column: 1 / 3;
    max-width: none;
    font-size: calc(20 * var(--pt));
    text-align: left;
  }

  .bottom .side:first-child {
    display: none;
  }

  .side {
    display: flex;
    min-width: 0;
  }

  .side.end {
    justify-content: flex-end;
  }

  .close {
    width: 32px;
    height: 32px;
    color: var(--text-2);
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    padding: 4px var(--gutter) calc(var(--safe-bottom) + 24px);
  }

  .bottom .body {
    padding-bottom: 20px;
  }

  @keyframes slide-up {
    from {
      transform: translateY(100%);
    }
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(24px);
    }
  }
</style>
