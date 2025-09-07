import { auth } from '@clerk/nextjs/server';

export async function isAdmin() {
  const { sessionClaims } = await auth();
  const userRole = (sessionClaims?.metadata as any)?.role;
  return userRole === 'admin';
}

export async function getCurrentUser() {
  const { userId } = await auth();
  return userId;
}
