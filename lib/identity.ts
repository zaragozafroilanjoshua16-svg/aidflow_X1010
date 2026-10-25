import "server-only";
import { auth, authReady } from "@/auth";
import { database } from "@/lib/db";
import { requireActor, type Actor } from "@/lib/identity-policy";
export async function currentUser(): Promise<
  (Actor & { name: string; email: string }) | null
> {
  if (!authReady()) return null;
  const session = await auth();
  if (!session?.user?.id) return null;
  const row = (
    await database().query("SELECT id,role,name,email FROM users WHERE id=$1", [
      session.user.id,
    ])
  ).rows[0];
  return row || null;
}
export async function requireUser() {
  return requireActor(await currentUser());
}
export async function requireAdmin() {
  return requireActor(await currentUser(), true);
}
