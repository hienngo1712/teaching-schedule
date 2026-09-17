// Edge-safe NextAuth config — chạy được trong Next.js middleware.
// KHÔNG import gì kéo theo native module (bcrypt, prisma, ...).
// File `auth.ts` extend config này thêm Credentials provider cho route handler Node.
import type { NextAuthConfig, DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username: string
      fullName: string | null
    } & DefaultSession["user"]
  }

  interface User {
    username: string
    fullName: string | null
  }
}

type AppJWT = {
  userId?: string
  username?: string
  fullName?: string | null
}

export const authConfig = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  // Edge runtime: chưa khai báo provider — sẽ bổ sung ở `auth.ts` (Node).
  providers: [],
  callbacks: {
    authorized({ auth }) {
      // Phải kiểm tới `user`: khi cấu hình lỗi, `auth` là object chứa error nên
      // vẫn truthy (GHSA-8fpg-xm3f-6cx3) → `!!auth` sẽ cho qua.
      return !!auth?.user
    },
    async jwt({ token, user }) {
      const t = token as typeof token & AppJWT
      if (user) {
        t.userId = user.id
        t.username = (user as { username: string }).username
        t.fullName = (user as { fullName: string | null }).fullName
      }
      return t
    },
    async session({ session, token }) {
      const t = token as typeof token & AppJWT
      session.user.id = t.userId ?? ""
      session.user.username = t.username ?? ""
      session.user.fullName = t.fullName ?? null
      return session
    },
  },
} satisfies NextAuthConfig
