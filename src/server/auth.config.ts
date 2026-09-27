// Edge-safe NextAuth config — chạy được trong Next.js middleware.
// KHÔNG import gì kéo theo native module (bcrypt, prisma, ...).
// File `auth.ts` extend config này thêm Credentials provider cho route handler Node.
import type { NextAuthConfig, DefaultSession } from "next-auth"
import { isAdminUsername } from "@/lib/admin"
import { REMEMBER_MAX_AGE_S, currentEpoch, isSessionExpired } from "@/lib/session-policy"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username: string
      fullName: string | null
      remember?: boolean
      mustChangePassword?: boolean
    } & DefaultSession["user"]
  }

  interface User {
    username: string
    fullName: string | null
    remember?: boolean
    sessionVersion?: number
    mustChangePassword?: boolean
  }
}

export type AppJWT = {
  userId?: string
  username?: string
  fullName?: string | null
  remember?: boolean
  epoch?: string
  sessionVersion?: number
  mustChangePassword?: boolean
}

export const authConfig = {
  // Thư viện chỉ có 1 maxAge cho cả JWT lẫn cookie → đặt trần 30 ngày, phiên không ghi nhớ cắt 8h ở callback jwt (spec N Q1).
  session: { strategy: "jwt", maxAge: REMEMBER_MAX_AGE_S },
  pages: { signIn: "/login" },
  // Edge runtime: chưa khai báo provider — sẽ bổ sung ở `auth.ts` (Node).
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      // Phải kiểm tới `user`: khi cấu hình lỗi, `auth` là object chứa error nên
      // vẫn truthy (GHSA-8fpg-xm3f-6cx3) → `!!auth` sẽ cho qua.
      if (!auth?.user) {
        // Còn cookie phiên mà không có user = hết hạn hoặc lệch phiên bản → /login báo nhẹ (spec N Q7).
        // includes: bắt cả tiền tố __Secure- và cookie chia mảnh .0/.1.
        const hadSession = request.cookies.getAll().some((c) => c.name.includes("authjs.session-token"))
        if (!hadSession) return false
        const url = new URL("/login", request.nextUrl.origin)
        url.searchParams.set("callbackUrl", request.nextUrl.href)
        url.searchParams.set("expired", "1")
        return Response.redirect(url)
      }
      // J1: admin chỉ dùng khu quản trị. So chặt để "/administration" không bị coi là khu quản trị.
      const { pathname } = request.nextUrl
      const inAdminArea = pathname === "/admin" || pathname.startsWith("/admin/")
      if (isAdminUsername(auth.user.username) && !inAdminArea) {
        return Response.redirect(new URL("/admin/orders", request.nextUrl.origin))
      }
      return true
    },
    async jwt({ token, user }) {
      const t = token as typeof token & AppJWT
      if (user) {
        t.userId = user.id
        t.username = (user as { username: string }).username
        t.fullName = (user as { fullName: string | null }).fullName
        t.remember = user.remember === true
        t.sessionVersion = user.sessionVersion
        t.mustChangePassword = user.mustChangePassword === true
        t.epoch = currentEpoch()
        return t
      }
      // Trả null: middleware xóa cookie, auth() trả null. Token cũ không có epoch cũng rơi vào đây (spec N Q6).
      if (t.epoch !== currentEpoch()) return null
      const iat = typeof t.iat === "number" ? t.iat : undefined
      if (isSessionExpired({ remember: t.remember === true, iat, nowS: Math.floor(Date.now() / 1000) })) return null
      return t
    },
    async session({ session, token }) {
      const t = token as typeof token & AppJWT
      session.user.id = t.userId ?? ""
      session.user.username = t.username ?? ""
      session.user.fullName = t.fullName ?? null
      session.user.remember = t.remember === true
      session.user.mustChangePassword = t.mustChangePassword === true
      return session
    },
  },
} satisfies NextAuthConfig
