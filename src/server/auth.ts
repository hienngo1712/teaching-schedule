import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "@/server/auth.config"
import { authorizeCredentials } from "@/server/auth-credentials"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
})
