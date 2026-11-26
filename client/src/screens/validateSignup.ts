export const MIN_PASSWORD = 8;

export function validateSignup(f: Record<string, string>) {
  if (!f.displayName.trim()) return 'Enter a display name.';
  if (f.password.length < MIN_PASSWORD) {
    return `Use a password of at least ${MIN_PASSWORD} characters.`;
  }
  if (f.password !== f.confirm) return 'Passwords do not match.';
  if (f.zip && !/^\d{5}$/.test(f.zip)) return 'ZIP code must be exactly 5 digits.';
  return null;
}
