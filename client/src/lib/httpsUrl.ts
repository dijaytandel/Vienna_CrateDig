/** Error text for an optional https:// link field, or null when it is fine. */
export function photoUrlError(value: string) {
  const url = value.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return 'Photo link must start with https://';
  } catch {
    return 'Enter a full link, like https://example.com/photo.jpg';
  }
  return null;
}
