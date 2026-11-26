const AUTH_PAGES = ['/login', '/signup', '/welcome'];

/** Only same-app paths are allowed as a post-login target. */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return '/discover';
  }
  const path = raw.split(/[?#]/)[0];
  return AUTH_PAGES.includes(path) ? '/discover' : raw;
}

export const loginPath = (next: string) => `/login?next=${encodeURIComponent(next)}`;
