const firstLetter = (s: string) => s.match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase() ?? '';

/** Two letters: the first letter of each part, or the first two letters of a single part. */
export function initials(...parts: string[]) {
  const letters = parts.map(firstLetter).filter(Boolean);
  if (letters.length >= 2) return letters.slice(0, 2).join('');
  const word = parts.join(' ').match(/[\p{L}\p{N}]/gu) ?? [];
  return (word.slice(0, 2).join('') || '?').toUpperCase();
}
