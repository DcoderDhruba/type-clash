export interface Rankable {
  /** null means the player never reported a result (did not finish). */
  wpm: number | null;
  accuracy: number | null;
}

/**
 * Places for a finished race, in the same order as `entries`. Faster wins; on equal
 * speed the more accurate wins; equal speed and accuracy share a place (1, 1, 3).
 * A player with no result gets null, and if nobody typed anything nobody is ranked.
 */
export function rankResults(entries: Rankable[]): (number | null)[] {
  const places: (number | null)[] = entries.map(() => null);

  const finished = entries
    .map((entry, index) => ({ index, wpm: entry.wpm, accuracy: entry.accuracy ?? 0 }))
    .filter((entry): entry is { index: number; wpm: number; accuracy: number } => entry.wpm !== null);

  if (finished.length === 0 || Math.max(...finished.map((entry) => entry.wpm)) <= 0) return places;

  finished.sort((a, b) => b.wpm - a.wpm || b.accuracy - a.accuracy);
  finished.forEach((entry, position) => {
    const previous = finished[position - 1];
    const tied = previous && previous.wpm === entry.wpm && previous.accuracy === entry.accuracy;
    places[entry.index] = tied ? places[previous.index] : position + 1;
  });
  return places;
}
