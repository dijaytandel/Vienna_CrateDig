import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Pill, PillGroup } from './Pill';

const RADII = [
  { value: 5, label: '5 mi' },
  { value: 10, label: '10 mi' },
  { value: 25, label: '25 mi' },
] as const;

function Radius() {
  const [r, setR] = useState<number>(10);
  return <PillGroup label="Radius" options={RADII} value={r} onChange={setR} />;
}

describe('pills', () => {
  it('selects exactly one radius', () => {
    render(<Radius />);
    expect(screen.getByRole('radio', { name: '10 mi' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: '25 mi' }));
    expect(screen.getByRole('radio', { name: '25 mi' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '10 mi' })).not.toBeChecked();
  });

  it('exposes toggle state', () => {
    render(<Pill selected>Jazz</Pill>);
    expect(screen.getByRole('button', { name: 'Jazz' })).toHaveAttribute('aria-pressed', 'true');
  });
});
