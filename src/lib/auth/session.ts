import { LOCAL_USER_ID, LOCAL_USER_EMAIL, LOCAL_USER_NAME } from './local-user';

export interface LocalUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Returns the local user. No session checking — single-user local app.
 */
export async function getAuthenticatedUser(): Promise<LocalUser> {
  return {
    id: LOCAL_USER_ID,
    email: LOCAL_USER_EMAIL,
    name: LOCAL_USER_NAME,
  };
}

/**
 * Wraps an API handler, injecting the local user ID.
 * Kept for API route compatibility — never returns 401.
 */
import { NextRequest, NextResponse } from 'next/server';

export function requireAuth(
  handler: (req: NextRequest, context: { params: Record<string, string> }, userId: string) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: { params: Record<string, string> }) => {
    return handler(req, context, LOCAL_USER_ID);
  };
}
