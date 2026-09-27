import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { authConfig } from "@/server/auth.config"

type P = Parameters<typeof authConfig.callbacks.jwt>[0]
const jwt = (token: Record<string, unknown>, user?: Record<string, unknown>) =>
  authConfig.callbacks.jwt({ token, user } as unknown as P)
const nowS = () => Math.floor(Date.now() / 1000)
const base = (over: Record<string, unknown> = {}) => ({
  userId: "1",
  username: "teacher",
  fullName: null,
  remember: false,
  epoch: "0.2",
  sessionVersion: 0,
  iat: nowS() - 60,
  ...over,
})

const original = process.env.NEXT_PUBLIC_APP_VERSION
beforeEach(() => {
  process.env.NEXT_PUBLIC_APP_VERSION = "0.2.1"
})
afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_APP_VERSION
  else process.env.NEXT_PUBLIC_APP_VERSION = original
})

describe("authConfig.callbacks.jwt (spec N Q1, Q4, Q6)", () => {
  it("vừa đăng nhập có tick → remember true, epoch hiện tại, chép sessionVersion/mustChangePassword", async () => {
    const t = await jwt({}, { id: "1", username: "teacher", fullName: null, remember: true, sessionVersion: 3, mustChangePassword: true })
    expect(t).toMatchObject({ userId: "1", username: "teacher", remember: true, epoch: "0.2", sessionVersion: 3, mustChangePassword: true })
  })

  it("nhánh đăng nhập không bị luật epoch/8h chặn; remember vắng → false", async () => {
    const t = await jwt({ epoch: "0.0-old", iat: nowS() - 99_999 }, { id: "1", username: "teacher", fullName: null })
    expect(t).toMatchObject({ remember: false, epoch: "0.2", mustChangePassword: false })
  })

  it("lệch minor → null; chỉ lệch patch → giữ phiên", async () => {
    process.env.NEXT_PUBLIC_APP_VERSION = "0.3.0"
    expect(await jwt(base())).toBeNull()
    process.env.NEXT_PUBLIC_APP_VERSION = "0.2.5"
    expect(await jwt(base())).toMatchObject({ userId: "1" })
  })

  it("token cũ thiếu epoch (phát hành trước N) → null", async () => {
    const old = base()
    delete (old as Record<string, unknown>).epoch
    expect(await jwt(old)).toBeNull()
  })

  it("không ghi nhớ: 9h không hoạt động → null, 1h → giữ; ghi nhớ: 9h → giữ", async () => {
    expect(await jwt(base({ iat: nowS() - 9 * 3600 }))).toBeNull()
    expect(await jwt(base({ iat: nowS() - 3600 }))).toMatchObject({ userId: "1" })
    expect(await jwt(base({ remember: true, iat: nowS() - 9 * 3600 }))).toMatchObject({ userId: "1" })
  })

  it("remember là chuỗi (token bị sửa tay) không được coi là ghi nhớ", async () => {
    expect(await jwt(base({ remember: "0", iat: nowS() - 9 * 3600 }))).toBeNull()
  })
})

describe("authConfig.session.maxAge", () => {
  it("trần chung 30 ngày", () => {
    expect(authConfig.session.maxAge).toBe(30 * 24 * 60 * 60)
  })
})
