import { describe, expect, it } from 'vitest';
import { initials } from './initials';

describe('initials', () => {
  it.each([
    [['Miles Davis', 'Kind of Blue'], 'MK'],
    [['!!!', 'Thr!!!er'], 'TH'],
    [['Björk', 'Ēlan'], 'BĒ'],
    [['Prince'], 'PR'],
    [[''], '?'],
  ])('%j → %s', (parts, expected) => {
    expect(initials(...parts)).toBe(expected);
  });
});
