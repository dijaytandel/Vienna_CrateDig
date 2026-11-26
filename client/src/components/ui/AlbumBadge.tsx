import { useState } from 'react';
import { badgeColor } from '../../theme/badgeColor';
import { initials } from '../../theme/initials';

interface Props {
  artistName: string;
  albumTitle: string;
  coverArtUrl?: string | null;
  size?: number;
}

export default function AlbumBadge({ artistName, albumTitle, coverArtUrl, size = 48 }: Props) {
  const [broken, setBroken] = useState(false);
  const label = `${albumTitle} by ${artistName}`;
  const style = { width: size, height: size, fontSize: size * 0.38 };

  if (coverArtUrl && !broken) {
    return (
      <img
        className="album-badge"
        src={coverArtUrl}
        alt={label}
        style={style}
        loading="lazy"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span
      className="album-badge"
      role="img"
      aria-label={label}
      style={{ ...style, background: badgeColor(artistName, albumTitle) }}
    >
      {initials(artistName, albumTitle)}
    </span>
  );
}
