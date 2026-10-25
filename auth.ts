import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import PostgresAdapter from "@auth/pg-adapter";
import { database } from "@/lib/db";
import { allowGoogleProfile, safeRedirect } from "@/lib/identity-policy";

export function authReady() {
  return Boolean(
    process.env.AUTH_SECRET &&
      process.env.AUTH_GOOGLE_ID &&
      process.env.AUTH_GOOGLE_SECRET &&
      process.env.DATABASE_URL &&
      process.env.AIDFLOW_PUBLIC_ORIGIN,
  );
}
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: process.env.DATABASE_URL ? PostgresAdapter(database()) : undefined,
  providers: authReady()
    ? [
        Google({
          clientId: process.env.AUTH_GOOGLE_ID,
          clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
      ]
    : [],
  session: { strategy: "database", maxAge: 60 * 60 * 24 },
  trustHost: true,
  pages: { signIn: "/signin", error: "/signin" },
  logger: {
    error() {
      /* Never print provider errors, tokens or session material. */
    },
  },
  callbacks: {
    signIn({ account, profile }) {
      return allowGoogleProfile(account?.provider || "", profile);
    },
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
    redirect({ url }) {
      return safeRedirect(
        url,
        process.env.AIDFLOW_PUBLIC_ORIGIN || "http://localhost:3000",
      );
    },
  },
}));
