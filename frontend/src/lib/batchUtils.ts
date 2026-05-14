// Helper functions for working with YC batch names

export interface BatchInfo {
  name: string;
  count: number;
}

// Convert batch name to sortable number (e.g., "Winter 2024" -> 202401, "Summer 2024" -> 202402)
function batchToSortableNumber(batchName: string): number {
  const match = batchName.match(/(Winter|Summer)\s+(\d{4})/);
  if (!match) return 0;

  const season = match[1];
  const year = parseInt(match[2]);

  // Winter comes first in the year (01), Summer comes second (02)
  const seasonNumber = season === 'Winter' ? 1 : 2;

  return year * 100 + seasonNumber;
}

// Get sorted batches by chronological order (newest first)
export function getSortedBatches(batches: Record<string, number>): BatchInfo[] {
  return Object.entries(batches)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => batchToSortableNumber(b.name) - batchToSortableNumber(a.name));
}

// Get the second-most recent batch
export function getSecondMostRecentBatch(batches?: Record<string, number>): BatchInfo | null {
  if (!batches) return null;

  const sorted = getSortedBatches(batches);
  return sorted.length >= 2 ? sorted[1] : (sorted.length === 1 ? sorted[0] : null);
}

// Get the most recent batch
export function getMostRecentBatch(batches?: Record<string, number>): BatchInfo | null {
  if (!batches) return null;

  const sorted = getSortedBatches(batches);
  return sorted.length > 0 ? sorted[0] : null;
}

// Convert full batch name to short format (e.g., "Winter 2024" -> "W24")
export function batchToShortFormat(batchName: string): string {
  const match = batchName.match(/(Winter|Summer)\s+(\d{4})/);
  if (match) {
    const season = match[1] === 'Winter' ? 'W' : 'S';
    const year = match[2].slice(-2);
    return `${season}${year}`;
  }
  return batchName;
}
