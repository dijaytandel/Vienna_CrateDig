import { describe, expect, it } from 'vitest';
import { safeNext } from './next';

describe('safeNext', () => {
  it.each([
    ['/report', '/report'],
    ['/stores/abc?tab=sightings', '/stores/abc?tab=sightings'],
    [null, '/discover'],
    ['https://evil.test', '/discover'],
    ['//evil.test', '/discover'],
    ['/\\evil.test', '/discover'],
    ['/login?next=/report', '/discover'],
  ])('%s → %s', (raw, expected) => {
    expect(safeNext(raw)).toBe(expected);
  });
});
