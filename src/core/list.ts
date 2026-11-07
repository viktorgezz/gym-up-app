/** Copy of the list with the item at `from` moved to `to`. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = list.slice();
  if (from === to || from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Result of a multi-select picker applied to an ordered list: kept items stay where they
 * were, newly picked ones go to the end in the order they were picked.
 */
export function mergeSelection(current: readonly string[], picked: readonly string[]): string[] {
  const pickedSet = new Set(picked);
  const kept = current.filter((id) => pickedSet.has(id));
  const keptSet = new Set(kept);
  return [...kept, ...[...new Set(picked)].filter((id) => !keptSet.has(id))];
}
