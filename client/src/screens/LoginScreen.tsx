import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { safeNext } from '../auth/next';
import Button from '../components/ui/Button';

export default function LoginScreen() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to={next} replace />;

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const result = await signIn(String(form.get('email')), String(form.get('password')));
    setBusy(false);
    if (result.error) setError(result.error);
    else navigate(next, { replace: true });
  };

  return (
    <section className="auth-screen">
      <h1>Log In</h1>
      <form onSubmit={onSubmit} className="stack">
        <label className="field">
          Email
          <input className="input" name="email" type="email" autoComplete="email" required />
        </label>
        <label className="field">
          Password
          <input
            className="input"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <Button type="submit" block disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
      <p className="muted">
        New here? <Link to={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link>
      </p>
    </section>
  );
}
