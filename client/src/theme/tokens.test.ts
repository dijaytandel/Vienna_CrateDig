import { describe, expect, it } from 'vitest';
import { COLORS, contrastRatio } from './tokens';

describe('theme tokens', () => {
  it('locks the approved navy and burnt orange', () => {
    expect(COLORS.bg).toBe('#0F172A');
    expect(COLORS.accent).toBe('#F97316');
  });

  it.each([
    ['body text on background', COLORS.text, COLORS.bg],
    ['body text on surface', COLORS.text, COLORS.surface],
    ['muted text on background', COLORS.muted, COLORS.bg],
    ['muted text on surface', COLORS.muted, COLORS.surface],
    ['button label on accent', COLORS.bg, COLORS.accent],
    ['accent links on background', COLORS.accent, COLORS.bg],
  ])('%s meets WCAG AA (4.5:1)', (_, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
