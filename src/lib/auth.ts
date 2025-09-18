import { auth } from '@clerk/nextjs/server';

interface SessionMetadata {
  role?: 'admin' | 'user' | string;
}

export async function isAdmin() {
  const { sessionClaims } = await auth();
  const userRole =
    (sessionClaims?.publicMetadata as SessionMetadata | undefined)?.role ??
    (sessionClaims?.metadata as SessionMetadata | undefined)?.role;
  return userRole === 'admin';
}

export async function getCurrentUser() {
  const { userId } = await auth();
  return userId;
}
