<script lang="ts" generics="T">
  import { tick, type Snippet } from 'svelte';
  import { moveItem } from '../core/list';
  import { scrollParent } from '../lib/dom';
  import Icon from './Icon.svelte';

  /**
   * A list reordered by dragging the ≡ handle (or with ↑/↓ on a focused handle).
   * Pointer events, not HTML drag-and-drop: on iPhone the handle must start a drag on
   * touch right away, without a long press and without scrolling the page.
   *
   * The parent applies the new order synchronously in `onreorder`.
   */
  let {
    items,
    key,
    label,
    row,
    onreorder,
    class: className = '',
  }: {
    items: readonly T[];
    key: (item: T) => string;
    /** Accessible name of the handle, e.g. "Переместить «Жим лёжа»". */
    label: (item: T) => string;
    row: Snippet<[T, number]>;
    onreorder: (items: T[]) => void;
    class?: string;
  } = $props();

  interface Drag {
    from: number;
    to: number;
    /** Offset of the lifted row from its place, px. */
    dy: number;
    /** Row positions when it was picked up (viewport px). */
    tops: number[];
    heights: number[];
    gap: number;
    dropping: boolean;
  }

  /** The lifted row glides into its slot this long before the list is reordered. */
  const DROP_MS = 160;
  /** Distance from the scroller's edge where dragging scrolls the list. */
  const EDGE_PX = 72;

  let list: HTMLUListElement;
  let drag = $state.raw<Drag | null>(null);
  let settling = $state(false);
  let pointerId = -1;
  let startY = 0;
  let lastY = 0;
  let scroller: HTMLElement | null = null;
  let startScroll = 0;
  let frame = 0;

  function onPointerDown(e: PointerEvent, index: number) {
    if (drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rects = Array.from(list.children, (r) => r.getBoundingClientRect());
    pointerId = e.pointerId;
    startY = lastY = e.clientY;
    scroller = scrollParent(list);
    startScroll = scroller?.scrollTop ?? 0;
    drag = {
      from: index,
      to: index,
      dy: 0,
      tops: rects.map((r) => r.top),
      heights: rects.map((r) => r.height),
      gap: rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0,
      dropping: false,
    };
    frame = requestAnimationFrame(autoScroll);
  }

  function update() {
    if (!drag || drag.dropping) return;
    const { from, tops, heights } = drag;
    const last = tops.length - 1;
    const scrolled = (scroller?.scrollTop ?? 0) - startScroll;
    // Keep the row near the list: up to half its height past either end, enough for its
    // centre to pass the middle of the first or last row.
    const slack = heights[from] / 2;
    const minDy = tops[0] - tops[from] - slack;
    const maxDy = tops[last] + heights[last] - (tops[from] + heights[from]) + slack;
    const dy = Math.min(maxDy, Math.max(minDy, lastY - startY + scrolled));
    const center = tops[from] + heights[from] / 2 + dy;
    let to = from;
    for (let i = from + 1; i <= last && center > tops[i] + heights[i] / 2; i++) to = i;
    for (let i = from - 1; i >= 0 && center < tops[i] + heights[i] / 2; i--) to = i;
    drag = { ...drag, dy, to };
  }

  function autoScroll() {
    if (!drag) return;
    if (scroller && !drag.dropping) {
      const r = scroller.getBoundingClientRect();
      let speed = 0;
      if (lastY < r.top + EDGE_PX) speed = -Math.ceil((r.top + EDGE_PX - lastY) / 5);
      else if (lastY > r.bottom - EDGE_PX) speed = Math.ceil((lastY - (r.bottom - EDGE_PX)) / 5);
      if (speed !== 0) {
        const before = scroller.scrollTop;
        scroller.scrollTop += speed;
        if (scroller.scrollTop !== before) update();
      }
    }
    frame = requestAnimationFrame(autoScroll);
  }

  function onPointerMove(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    lastY = e.clientY;
    update();
  }

  /** Where the lifted row ends up when dropped at `to`. */
  function slotOffset(d: Drag): number {
    const { from, to, tops, heights } = d;
    return to > from ? tops[to] + heights[to] - (tops[from] + heights[from]) : tops[to] - tops[from];
  }

  function onPointerUp(e: PointerEvent) {
    if (e.pointerId !== pointerId || !drag || drag.dropping) return;
    pointerId = -1;
    const dropped: Drag = { ...drag, dropping: true };
    dropped.dy = slotOffset(dropped);
    drag = dropped;
    setTimeout(() => commit(dropped), DROP_MS);
  }

  function commit(d: Drag) {
    cancelAnimationFrame(frame);
    // Rows are already drawn where the new order puts them: swap without animating.
    settling = true;
    drag = null;
    if (d.from !== d.to) onreorder(moveItem(items, d.from, d.to));
    requestAnimationFrame(() => requestAnimationFrame(() => (settling = false)));
  }

  function shift(i: number): number {
    if (!drag) return 0;
    const { from, to, heights, gap, dy } = drag;
    if (i === from) return dy;
    const size = heights[from] + gap;
    if (from < to && i > from && i <= to) return -size;
    if (to < from && i >= to && i < from) return size;
    return 0;
  }

  async function onKeyDown(e: KeyboardEvent, index: number) {
    const delta = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
    const to = index + delta;
    if (delta === 0 || to < 0 || to >= items.length || drag) return;
    e.preventDefault();
    const id = key(items[index]);
    onreorder(moveItem(items, index, to));
    await tick();
    list.querySelector<HTMLElement>(`[data-key="${CSS.escape(id)}"] .handle`)?.focus();
  }
</script>

<ul class="sortable {className}" class:settling class:dragging={drag !== null} bind:this={list}>
  {#each items as item, i (key(item))}
    <li
      data-key={key(item)}
      class:lifted={drag?.from === i}
      class:dropping={drag?.dropping === true && drag.from === i}
      style:transform={drag ? `translateY(${shift(i)}px)` : undefined}
    >
      <div class="content">{@render row(item, i)}</div>
      <button
        class="handle"
        type="button"
        aria-label={label(item)}
        onpointerdown={(e) => onPointerDown(e, i)}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
        onpointercancel={onPointerUp}
        onkeydown={(e) => onKeyDown(e, i)}
      >
        <Icon name="grip" size={22} />
      </button>
    </li>
  {/each}
</ul>

<style>
  .sortable {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    position: relative;
    display: flex;
    align-items: center;
    background: var(--sortable-bg, var(--surface));
    transition: transform 0.18s ease;
  }

  li + li {
    border-top: 0.5px solid var(--line);
  }

  .content {
    flex: 1;
    min-width: 0;
  }

  .lifted {
    z-index: 2;
    transition: none;
    border-radius: 14px;
    background: var(--surface-2);
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.45);
  }

  .lifted.dropping {
    transition: transform 0.16s ease;
  }

  .lifted + li {
    border-top-color: transparent;
  }

  .settling li {
    transition: none;
  }

  .handle {
    display: grid;
    place-items: center;
    flex: none;
    width: 44px;
    height: 48px;
    margin-right: -10px;
    border: 0;
    background: none;
    color: var(--text-3);
    cursor: grab;
    /* The finger drags the row instead of scrolling the page. */
    touch-action: none;
  }

  .dragging .handle {
    cursor: grabbing;
  }

  .lifted .handle {
    color: var(--accent-text);
  }
</style>
