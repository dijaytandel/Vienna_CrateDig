import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { safeNext } from '../auth/next';
import Button from '../components/ui/Button';
import { MIN_PASSWORD, validateSignup } from './validateSignup';

export default function SignupScreen() {
  const { session, signUp } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [error, setError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to={next} replace />;
  if (confirmEmail) {
    return (
      <section className="auth-screen">
        <h1>Check your email</h1>
        <p className="muted">Follow the link we sent you to confirm your account, then log in.</p>
      </section>
    );
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(
      [...new FormData(e.currentTarget)].map(([k, v]) => [k, String(v)]),
    ) as Record<string, string>;
    f.zip = f.zip.trim();
    const invalid = validateSignup(f);
    if (invalid) return setError(invalid);
    setBusy(true);
    const result = await signUp({
      displayName: f.displayName.trim(),
      email: f.email.trim(),
      password: f.password,
      zip: f.zip || undefined,
    });
    setBusy(false);
    if (result.error) setError(result.error);
    else if (result.needsConfirmation) setConfirmEmail(true);
    else navigate(next, { replace: true });
  };

  return (
    <section className="auth-screen">
      <h1>Create Account</h1>
      <form onSubmit={onSubmit} className="stack" noValidate>
        <label className="field">
          Display name
          <input
            className="input"
            name="displayName"
            maxLength={60}
            autoComplete="nickname"
            required
          />
        </label>
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
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            required
          />
        </label>
        <label className="field">
          Confirm password
          <input
            className="input"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
          />
        </label>
        <label className="field">
          ZIP code (optional)
          <input
            className="input"
            name="zip"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            pattern="\d{5}"
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <Button type="submit" block disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <p className="muted">
        Already have an account? <Link to={`/login?next=${encodeURIComponent(next)}`}>Log in</Link>
      </p>
    </section>
  );
}
