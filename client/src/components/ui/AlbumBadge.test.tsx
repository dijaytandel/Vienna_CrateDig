import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { badgeColor } from '../../theme/badgeColor';
import AlbumBadge from './AlbumBadge';

describe('AlbumBadge', () => {
  it('shows two letters from artist and album when there is no cover', () => {
    render(<AlbumBadge artistName="Miles Davis" albumTitle="Kind of Blue" />);
    expect(screen.getByRole('img', { name: 'Kind of Blue by Miles Davis' })).toHaveTextContent(
      'MK',
    );
  });

  it('derives the same color for the same album every time', () => {
    expect(badgeColor('Miles Davis', 'Kind of Blue')).toBe(
      badgeColor('miles davis', 'kind of blue'),
    );
    expect(badgeColor('Miles Davis', 'Kind of Blue')).not.toBe(badgeColor('Nirvana', 'Nevermind'));
    expect(badgeColor('Miles Davis', 'Kind of Blue')).toMatch(/^hsl\(\d{1,3} 55% 30%\)$/);
  });

  it('shows the cover image and falls back to the badge if it fails to load', () => {
    render(
      <AlbumBadge artistName="Nirvana" albumTitle="Nevermind" coverArtUrl="https://x.test/a.jpg" />,
    );
    const img = screen.getByRole('img', { name: 'Nevermind by Nirvana' });
    expect(img.tagName).toBe('IMG');
    fireEvent.error(img);
    expect(screen.getByRole('img', { name: 'Nevermind by Nirvana' })).toHaveTextContent('NN');
  });
});
