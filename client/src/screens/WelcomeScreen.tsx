import { Link } from 'react-router-dom';

export default function WelcomeScreen() {
  return (
    <section className="auth-screen stack">
      <h1>Welcome to CrateDig</h1>
      <p className="muted">Find vinyl at independent record stores near you.</p>
      <Link to="/signup" className="button-primary button-block">
        Create account
      </Link>
      <Link to="/login" className="button-secondary button-block">
        Log in
      </Link>
      <Link to="/discover">Keep digging as a guest</Link>
    </section>
  );
}
