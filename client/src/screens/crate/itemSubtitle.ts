import type { CrateItem } from '../../api/crate';
import { conditionLabel, formatUsd } from '../../lib/format';

export function itemSubtitle(item: CrateItem) {
  if (item.listType === 'collection') {
    return item.purchasePriceUsd == null
      ? 'Price not recorded'
      : `Paid ${formatUsd(item.purchasePriceUsd)}`;
  }
  const wants = [
    item.conditionGrade ? `${conditionLabel(item.conditionGrade)} or better` : null,
    ...item.specialAttributes,
  ].filter(Boolean);
  return wants.length ? wants.join(' · ') : 'Any pressing';
}
