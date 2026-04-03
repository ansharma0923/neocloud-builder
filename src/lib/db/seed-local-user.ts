import { prisma } from '@/lib/db/client';
import { LOCAL_USER_ID, LOCAL_USER_EMAIL, LOCAL_USER_NAME } from '@/lib/auth/local-user';

let seeded = false;

export async function ensureLocalUser() {
  if (seeded) return;
  await prisma.user.upsert({
    where: { id: LOCAL_USER_ID },
    update: {},
    create: {
      id: LOCAL_USER_ID,
      email: LOCAL_USER_EMAIL,
      name: LOCAL_USER_NAME,
    },
  });
  seeded = true;
}
