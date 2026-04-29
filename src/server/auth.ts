import NextAuth, { type DefaultSession } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { authorizeCredentials } from "@/server/auth-credentials"

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8h
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const username = String(credentials?.username ?? "").trim()
        const password = String(credentials?.password ?? "")
        if (!username || !password) return null

        const fwd = req.headers?.get("x-forwarded-for") ?? null
        const ip =
          fwd?.split(",")[0]?.trim() ??
          req.headers?.get("x-real-ip") ??
          null

        const user = await authorizeCredentials(username, password, ip)
        if (!user) return null
        return { id: user.id, username: user.username, fullName: user.fullName }
      },
    }),
  ],
  callbacks: {
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
})
