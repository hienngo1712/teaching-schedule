// Edge-safe middleware: chỉ dùng `authConfig` (KHÔNG kéo theo bcrypt/prisma).
import NextAuth from "next-auth"
import { authConfig } from "@/server/auth.config"

export const { auth: middleware } = NextAuth(authConfig)

export const config = {
  matcher: [
    // "p/", "n/" có dấu "/" để chỉ mở /p/<token> (phụ huynh), /n/<token> (người trả nơi dạy), không mở nhầm /profile, /notes.
    "/((?!login|register|privacy|guide|updates|p/|n/|da-thanh-toan|api/auth|api/trpc|api/payos/|_next/static|_next/image|favicon.ico).*)",
  ],
}
