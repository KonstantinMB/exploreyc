// Chronological ordering for YC batch names.
// Handles long forms ("Winter 2025") and short forms ("W21", "S05", "SP25", "F24", "IK12").
// Unparseable names get key -1 so they sort to the start and are never dropped.

const SEASON_INDEX: Record<string, number> = {
  winter: 0,
  w: 0,
  ik: 0, // early "IKxx" batches ran in winter
  spring: 1,
  sp: 1,
  summer: 2,
  s: 2,
  fall: 3,
  f: 3,
};

export function batchSortKey(batch: string): number {
  if (!batch) return -1;
  const trimmed = batch.trim();

  const long = trimmed.match(/^(Winter|Spring|Summer|Fall)\s+(\d{4})$/i);
  if (long) {
    return parseInt(long[2], 10) * 10 + SEASON_INDEX[long[1].toLowerCase()];
  }

  const short = trimmed.match(/^(IK|SP|W|S|F)(\d{2})$/i);
  if (short) {
    const year = 2000 + parseInt(short[2], 10);
    return year * 10 + SEASON_INDEX[short[1].toLowerCase()];
  }

  return -1;
}

export function sortBatchesChronologically(batches: string[]): string[] {
  return [...batches].sort((a, b) => {
    const ka = batchSortKey(a);
    const kb = batchSortKey(b);
    if (ka === kb) return a.localeCompare(b);
    return ka - kb;
  });
}
