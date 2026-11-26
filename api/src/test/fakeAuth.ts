import type { AuthService, AuthUser } from '../auth/service.js';

/** Tokens are user ids; `stores` maps verified managers to their store. */
export function fakeAuth(
  users: Record<string, AuthUser['role']> = { alice: 'collector' },
  stores: Record<string, string> = {},
): AuthService {
  return {
    userFromToken: async (token) => (users[token] ? { id: token, role: users[token] } : null),
    verifiedStoreId: async (userId) => stores[userId] ?? null,
  };
}

export const AS_ALICE = ['Authorization', 'Bearer alice'] as const;
