import { describe, it, expect, vi, beforeEach } from "vitest"
import { TRPCError } from "@trpc/server"

const mocks = vi.hoisted(() => ({
  session: null as unknown,
  signIn: vi.fn<(...args: unknown[]) => Promise<undefined>>(async () => undefined),
  change: vi.fn<(...args: unknown[]) => Promise<undefined>>(async () => undefined),
}))
vi.mock("@/server/auth", () => ({ auth: async () => mocks.session, signIn: mocks.signIn }))
vi.mock("@/server/services/user.service", () => ({ changeUserPassword: mocks.change }))
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }))
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" }) }))

import { AuthError } from "next-auth"
import { changePasswordAction } from "@/app/actions/change-password"
import type { ChangePasswordInput } from "@/lib/schemas/auth"

const OK_INPUT = { currentPassword: "teacher123", newPassword: "NewSecret@2026" }
const signedIn = (remember?: boolean) => ({
  user: { id: "7", username: "teacher", fullName: null, remember },
  expires: "",
})

beforeEach(() => {
  mocks.session = signedIn(true)
  mocks.signIn.mockReset()
  mocks.change.mockReset()
})

describe("changePasswordAction (spec N 6.3c)", () => {
  it("chưa đăng nhập → UNAUTHORIZED, không đổi gì", async () => {
    mocks.session = null
    expect(await changePasswordAction(OK_INPUT)).toEqual({ ok: false, error: "UNAUTHORIZED" })
    expect(mocks.change).not.toHaveBeenCalled()
  })

  it("mật khẩu mới ngắn hoặc trùng → INVALID kèm thông báo zod", async () => {
    expect(await changePasswordAction({ currentPassword: "teacher123", newPassword: "short" })).toEqual({
      ok: false,
      error: "INVALID",
      message: "Mật khẩu mới phải có ít nhất 10 ký tự",
    })
    expect(await changePasswordAction({ currentPassword: "Lich-7k2m-Qx9f", newPassword: "Lich-7k2m-Qx9f" })).toEqual({
      ok: false,
      error: "INVALID",
      message: "Mật khẩu mới phải khác mật khẩu hiện tại",
    })
    expect(mocks.change).not.toHaveBeenCalled()
  })

  it("sai mật khẩu cũ → WRONG_CURRENT, không signIn", async () => {
    mocks.change.mockRejectedValueOnce(new TRPCError({ code: "BAD_REQUEST", message: "Mật khẩu hiện tại không đúng" }))
    expect(await changePasswordAction(OK_INPUT)).toEqual({
      ok: false,
      error: "WRONG_CURRENT",
      message: "Mật khẩu hiện tại không đúng",
    })
    expect(mocks.signIn).not.toHaveBeenCalled()
  })

  it("đúng → đổi theo userId của phiên, signIn lại bằng mật khẩu mới, giữ ghi nhớ", async () => {
    expect(await changePasswordAction(OK_INPUT)).toEqual({ ok: true })
    expect(mocks.change).toHaveBeenCalledWith(expect.anything(), 7, "teacher123", "NewSecret@2026", "5.6.7.8")
    expect(mocks.signIn).toHaveBeenCalledWith("credentials", {
      username: "teacher",
      password: "NewSecret@2026",
      remember: "1",
      redirect: false,
    })
  })

  it("phiên không ghi nhớ → remember '0'; username lấy từ phiên, bỏ qua field client gửi", async () => {
    mocks.session = signedIn(undefined)
    await changePasswordAction({ ...OK_INPUT, username: "hacker" } as unknown as ChangePasswordInput)
    expect(mocks.signIn).toHaveBeenCalledWith("credentials", expect.objectContaining({ username: "teacher", remember: "0" }))
  })

  it("signIn lại thất bại (vd rate limit) → mật khẩu đã đổi, báo relogin", async () => {
    mocks.signIn.mockRejectedValueOnce(new AuthError("CredentialsSignin"))
    expect(await changePasswordAction(OK_INPUT)).toEqual({ ok: true, relogin: true })
  })

  it("signIn lại ném lỗi thường (không phải AuthError) → vẫn báo đổi xong, relogin", async () => {
    mocks.signIn.mockRejectedValueOnce(new Error("db down"))
    expect(await changePasswordAction(OK_INPUT)).toEqual({ ok: true, relogin: true })
  })

  it("sai quá nhiều lần → RATE_LIMITED, không signIn", async () => {
    mocks.change.mockRejectedValueOnce(new TRPCError({ code: "TOO_MANY_REQUESTS", message: "RATE_LIMITED" }))
    expect(await changePasswordAction(OK_INPUT)).toEqual({ ok: false, error: "RATE_LIMITED" })
    expect(mocks.signIn).not.toHaveBeenCalled()
  })
})
