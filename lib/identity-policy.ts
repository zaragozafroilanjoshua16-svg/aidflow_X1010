export type Actor = { id: string; role: "USER" | "ADMIN" };
export class AccessError extends Error {
  constructor(readonly status: number) {
    super(
      status === 401
        ? "Google sign-in required."
        : "Administrator access required.",
    );
  }
}
export function allowGoogleProfile(
  provider: string,
  profile: unknown,
): boolean {
  if (!profile || typeof profile !== "object") return false;
  const p = profile as Record<string, unknown>;
  return (
    provider === "google" &&
    p.email_verified === true &&
    typeof p.email === "string" &&
    p.email.includes("@")
  );
}
export function safeRedirect(url: string, origin: string): string {
  try {
    const target = new URL(url, origin);
    return target.origin === origin ? target.href : `${origin}/`;
  } catch {
    return `${origin}/`;
  }
}
export function requireActor(actor: Actor | null, admin = false): Actor {
  if (!actor?.id) throw new AccessError(401);
  if (admin && actor.role !== "ADMIN") throw new AccessError(403);
  return actor;
}
