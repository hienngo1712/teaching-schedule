"use server"

import { TRPCError } from "@trpc/server"
import { AuthError } from "next-auth"
import { auth, signIn } from "@/server/auth"
import { db } from "@/server/db"
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/schemas/auth"
import { changeUserPassword } from "@/server/services/user.service"

export type ChangePasswordResult =
  | { ok: true; relogin?: true }
  | { ok: false; error: "UNAUTHORIZED" | "WRONG_CURRENT" | "INVALID"; message?: string }

// Server action thay tRPC vì route tRPC không ghi lại được cookie phiên cho máy đang đổi (spec N Q15).
export async function changePasswordAction(input: ChangePasswordInput): Promise<ChangePasswordResult> {
  const session = await auth()
  if (!session?.user) return { ok: false, error: "UNAUTHORIZED" }

  const parsed = changePasswordSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "INVALID", message: parsed.error.issues[0]?.message }

  try {
    await changeUserPassword(db, Number(session.user.id), parsed.data.currentPassword, parsed.data.newPassword)
  } catch (e) {
    if (e instanceof TRPCError && e.code === "BAD_REQUEST") return { ok: false, error: "WRONG_CURRENT", message: e.message }
    throw e
  }

  // Cấp token mới mang sessionVersion mới; username/remember lấy từ phiên server, không nhận từ client.
  try {
    await signIn("credentials", {
      username: session.user.username,
      password: parsed.data.newPassword,
      remember: session.user.remember === true ? "1" : "0",
      redirect: false,
    })
  } catch (e) {
    // Mật khẩu đã đổi, chỉ không tự đăng nhập lại được (vd đang bị rate limit theo username).
    if (e instanceof AuthError) return { ok: true, relogin: true }
    throw e
  }
  return { ok: true }
}
