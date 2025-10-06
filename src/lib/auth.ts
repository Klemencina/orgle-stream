import { auth, clerkClient } from '@clerk/nextjs/server';

interface SessionMetadata {
  role?: 'admin' | 'user' | string;
}

export async function isAdmin() {
  const { sessionClaims, userId } = await auth();
  const claimRole =
    (sessionClaims?.publicMetadata as SessionMetadata | undefined)?.role ??
    (sessionClaims?.metadata as SessionMetadata | undefined)?.role;
  if (claimRole === 'admin') return true;

  if (!userId) return false;

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const userRole = (user.publicMetadata as SessionMetadata | undefined)?.role;
    return userRole === 'admin';
  } catch {
    return false;
  }
}

export async function getCurrentUser() {
  const { userId } = await auth();
  return userId;
}
