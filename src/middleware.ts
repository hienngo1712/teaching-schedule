// Edge-safe middleware: chỉ dùng `authConfig` (KHÔNG kéo theo bcrypt/prisma).
import NextAuth from "next-auth"
import { authConfig } from "@/server/auth.config"

export const { auth: middleware } = NextAuth(authConfig)

export const config = {
  matcher: [
    // "p/" có dấu "/" để chỉ mở /p/<token>, không mở nhầm /profile hay route khác bắt đầu bằng "p".
    "/((?!login|register|privacy|guide|updates|p/|da-thanh-toan|api/auth|api/trpc|api/payos/|_next/static|_next/image|favicon.ico).*)",
  ],
}
