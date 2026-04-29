export { auth as middleware } from "@/server/auth"

export const config = {
  matcher: ["/((?!login|api/auth|api/trpc|_next/static|_next/image|favicon.ico).*)"],
}
