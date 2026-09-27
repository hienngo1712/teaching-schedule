// Tách khỏi auth.ts để integration test gọi được mà không kéo next-auth runtime.
import { authConfig } from "@/server/auth.config"
import { getSessionUserState } from "@/server/auth-credentials"

type JwtParams = Parameters<typeof authConfig.callbacks.jwt>[0]

// Middleware Edge không dùng được Prisma nên chỉ auth() Node kiểm DB (spec N Q11), không cache (Q12).
export async function nodeJwt(params: JwtParams) {
  const t = await authConfig.callbacks.jwt(params)
  // Vừa đăng nhập: authorize vừa đọc DB xong, khỏi tra lại.
  if (!t || params.user) return t
  const state = await getSessionUserState(Number(t.userId), t.sessionVersion)
  if (!state) return null
  // Lấy cờ từ DB: admin đặt cờ bằng tay (không tăng version) vẫn có hiệu lực ngay.
  t.mustChangePassword = state.mustChangePassword
  return t
}
