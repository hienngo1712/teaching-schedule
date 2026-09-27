"use server"

import { signIn } from "@/server/auth"
import { isRateLimited } from "@/server/auth-credentials"
import { getRequestIp } from "@/server/request-ip"
import { AuthError } from "next-auth"

export type LoginResult =
  | { ok: true }
  | { ok: false; error: "RATE_LIMITED" | "INVALID_CREDENTIALS" | "MISSING_FIELDS" }

export async function loginAction(formData: FormData): Promise<LoginResult> {
  const username = String(formData.get("username") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  // Radix Checkbox gửi "on" khi tick; signIn chỉ chuyển được chuỗi nên đổi sang "1"/"0" (spec N Q3).
  const remember = formData.get("remember") === "on"

  if (!username || !password) {
    return { ok: false, error: "MISSING_FIELDS" }
  }

  const ip = await getRequestIp()

  // Pre-check: nếu đã bị khóa thì không cần thử password (tránh ghi thêm fail attempt)
  if (await isRateLimited(username, ip)) {
    return { ok: false, error: "RATE_LIMITED" }
  }

  try {
    await signIn("credentials", {
      username,
      password,
      remember: remember ? "1" : "0",
      redirect: false,
    })
    return { ok: true }
  } catch (e) {
    if (e instanceof AuthError) {
      // Sau lần thử fail vừa rồi, có thể đã chạm ngưỡng rate limit
      if (await isRateLimited(username, ip)) {
        return { ok: false, error: "RATE_LIMITED" }
      }
      return { ok: false, error: "INVALID_CREDENTIALS" }
    }
    throw e
  }
}
