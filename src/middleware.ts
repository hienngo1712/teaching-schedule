// Edge-safe middleware: chỉ dùng `authConfig` (KHÔNG kéo theo bcrypt/prisma).
import NextAuth from "next-auth"
import { authConfig } from "@/server/auth.config"

export const { auth: middleware } = NextAuth(authConfig)

export const config = {
  matcher: [
    "/((?!login|api/auth|api/trpc|_next/static|_next/image|favicon.ico).*)",
  ],
}
