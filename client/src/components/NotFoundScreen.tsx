import { Link } from 'react-router-dom';

export default function NotFoundScreen() {
  return (
    <section>
      <h1>Page not found</h1>
      <p className="muted">Nothing in this crate.</p>
      <Link to="/discover" className="button-primary">
        Back to Discover
      </Link>
    </section>
  );
}
