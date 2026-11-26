import type { CatalogResult } from '../api/catalog';
import AlbumBadge from './ui/AlbumBadge';

export default function CatalogResultButton({
  result,
  onSelect,
}: {
  result: CatalogResult;
  onSelect: () => void;
}) {
  return (
    <button type="button" className="store-card result-button" onClick={onSelect}>
      <AlbumBadge
        artistName={result.artistName}
        albumTitle={result.albumTitle}
        coverArtUrl={result.coverArtUrl}
      />
      <span className="store-card-body">
        <span className="store-card-name">{result.albumTitle}</span>
        <span className="muted">
          {result.artistName}
          {result.releaseYear ? ` · ${result.releaseYear}` : ''}
        </span>
      </span>
    </button>
  );
}
