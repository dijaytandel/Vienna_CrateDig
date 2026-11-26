/** FNV-1a, so the same album always maps to the same hue. */
function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function badgeColor(artistName: string, albumTitle: string) {
  const key = `${artistName}|${albumTitle}`.trim().toLowerCase();
  return `hsl(${hash(key) % 360} 55% 30%)`;
}
