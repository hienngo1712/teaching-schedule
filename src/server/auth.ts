import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "@/server/auth.config"
import { authorizeCredentials } from "@/server/auth-credentials"
import { nodeJwt } from "@/server/auth-node-callbacks"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: { ...authConfig.callbacks, jwt: nodeJwt },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        remember: { label: "Remember", type: "text" },
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
        return {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          sessionVersion: user.sessionVersion,
          mustChangePassword: user.mustChangePassword,
          remember: credentials?.remember === "1",
        }
      },
    }),
  ],
})
