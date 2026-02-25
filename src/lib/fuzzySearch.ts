export interface SearchableItem {
  text: string;
  secondary?: string;
}

export interface SearchResult<T> {
  item: T;
  score: number;
}

/**
 * Normalize text by lowercasing and replacing common separators with spaces.
 */
function normalize(str: string): string {
  return str.toLowerCase().replace(/[-_.]/g, ' ');
}

/**
 * Score a query against a single text string.
 * Returns 0 if no match is found.
 */
function scoreText(text: string, query: string): number {
  const normalizedText = normalize(text);
  const normalizedQuery = normalize(query);

  if (normalizedQuery.length === 0) {
    return 0;
  }

  // Exact substring match
  const substringIndex = normalizedText.indexOf(normalizedQuery);
  if (substringIndex !== -1) {
    if (substringIndex === 0) {
      // Starts at the very beginning of the text
      return 1000;
    }
    // Check if substring starts at a word boundary
    const charBefore = normalizedText[substringIndex - 1];
    if (charBefore === ' ') {
      return 800;
    }
    // Substring match elsewhere
    return 500 + Math.max(0, 100 - substringIndex);
  }

  // Fuzzy character-by-character match
  let queryIdx = 0;
  let totalGap = 0;
  let lastMatchPos = -1;
  let matchedChars = 0;

  for (let i = 0; i < normalizedText.length && queryIdx < normalizedQuery.length; i++) {
    if (normalizedText[i] === normalizedQuery[queryIdx]) {
      if (lastMatchPos !== -1) {
        const gap = i - lastMatchPos - 1;
        totalGap += gap;
      }
      lastMatchPos = i;
      matchedChars++;
      queryIdx++;
    }
  }

  // All query characters must be found in order
  if (queryIdx < normalizedQuery.length) {
    return 0;
  }

  // Score based on ratio of matched characters and penalize by gaps
  const ratio = matchedChars / normalizedQuery.length; // always 1.0 since we matched all
  const gapPenalty = Math.min(totalGap * 5, 200);
  const baseScore = 200;
  const score = Math.max(1, baseScore * ratio - gapPenalty);

  return score;
}

export function fuzzySearch<T extends SearchableItem>(
  items: T[],
  query: string,
): SearchResult<T>[] {
  // Empty query: return all items with score 0
  if (query.length === 0) {
    return items.map((item) => ({ item, score: 0 }));
  }

  const results: SearchResult<T>[] = [];

  for (const item of items) {
    const textScore = scoreText(item.text, query);
    const secondaryScore = item.secondary
      ? scoreText(item.secondary, query)
      : 0;
    const bestScore = Math.max(textScore, secondaryScore);

    if (bestScore > 0) {
      results.push({ item, score: bestScore });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}
