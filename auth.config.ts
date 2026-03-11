import type { NextAuthConfig } from "next-auth";

// Edge-compatible config (no DB imports)
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" as const },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
