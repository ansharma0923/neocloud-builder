import { auth } from '@/app/api/auth/[...nextauth]/route';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Get the authenticated user from the session.
 * Returns null if not authenticated.
 */
export async function getAuthenticatedUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as { id: string; email: string; name?: string };
}

/**
 * Require authentication for an API handler.
 * Returns 401 if not authenticated.
 */
export function requireAuth(
  handler: (req: NextRequest, context: { params: Record<string, string> }, userId: string) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: { params: Record<string, string> }) => {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handler(req, context, user.id);
  };
}
