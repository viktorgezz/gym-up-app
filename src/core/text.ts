const collator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true });

export function compareNames(a: string, b: string): number {
  return collator.compare(a, b);
}

/** For search and duplicate checks: case, «ё» and extra spaces don't matter. */
export function normalizeName(s: string): string {
  return s.toLocaleLowerCase('ru').replaceAll('ё', 'е').replace(/\s+/g, ' ').trim();
}

export function matchesQuery(name: string, query: string): boolean {
  const q = normalizeName(query);
  return q === '' || normalizeName(name).includes(q);
}
