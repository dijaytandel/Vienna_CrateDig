import { badgeColor } from '../../theme/badgeColor';
import { storeLetter } from './format';

export default function StoreIcon({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <span
      className="store-icon"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.45, background: badgeColor(name, '') }}
    >
      {storeLetter(name)}
    </span>
  );
}

export function VerifiedCheck() {
  return (
    <span className="verified-check" role="img" aria-label="Verified store" title="Verified store">
      ✓
    </span>
  );
}
