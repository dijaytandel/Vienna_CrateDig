import { Link } from 'react-router-dom';
import { CLAIM_LABELS, getMyClaim } from '../api/verification';
import { useAsync } from '../lib/useAsync';

/** Store-manager application status on Profile; silent when there is none or it fails. */
export default function StoreClaimStatus() {
  const mine = useAsync((signal) => getMyClaim(signal), []);
  const claim = mine.data?.claim;
  if (!claim) {
    return mine.data ? (
      <p>
        <Link to="/merchant/verify">Become a store manager</Link>
      </p>
    ) : null;
  }
  return (
    <p>
      Store verification: <strong>{CLAIM_LABELS[claim.status]}</strong> · {claim.businessName}{' '}
      <Link to="/merchant/verify">Details</Link>
    </p>
  );
}
