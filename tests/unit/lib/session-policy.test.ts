import { describe, it, expect, afterEach } from "vitest"
import {
  REMEMBER_MAX_AGE_S,
  SHORT_IDLE_S,
  currentEpoch,
  epochOf,
  isSessionExpired,
} from "@/lib/session-policy"

const original = process.env.NEXT_PUBLIC_APP_VERSION
afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_APP_VERSION
  else process.env.NEXT_PUBLIC_APP_VERSION = original
})

describe("epochOf (spec N Q4)", () => {
  it("chỉ lấy major.minor: nâng patch không đổi epoch", () => {
    expect(epochOf("0.2.0")).toBe("0.2")
    expect(epochOf("0.2.1")).toBe(epochOf("0.2.0"))
    expect(epochOf("0.3.0")).not.toBe(epochOf("0.2.9"))
    expect(epochOf("1.0.0")).not.toBe(epochOf("0.9.9"))
    expect(epochOf("0.10.3")).toBe("0.10")
  })
  it("chuỗi lạ → giữ nguyên để vẫn so bằng được", () => {
    expect(epochOf("dev")).toBe("dev")
  })
})

describe("currentEpoch (spec N Q5)", () => {
  it("đọc env mỗi lần gọi, không cache", () => {
    process.env.NEXT_PUBLIC_APP_VERSION = "0.2.1"
    expect(currentEpoch()).toBe("0.2")
    process.env.NEXT_PUBLIC_APP_VERSION = "0.4.0"
    expect(currentEpoch()).toBe("0.4")
  })
  it("env trống hoặc thiếu → 0.0", () => {
    delete process.env.NEXT_PUBLIC_APP_VERSION
    expect(currentEpoch()).toBe("0.0")
    process.env.NEXT_PUBLIC_APP_VERSION = ""
    expect(currentEpoch()).toBe("0.0")
  })
})

describe("isSessionExpired (spec N Q1)", () => {
  const nowS = 1_900_000_000
  it("hằng đúng giây: 30 ngày, 8 giờ", () => {
    expect(REMEMBER_MAX_AGE_S).toBe(30 * 24 * 60 * 60)
    expect(SHORT_IDLE_S).toBe(8 * 60 * 60)
  })
  it("ghi nhớ: không cắt theo 8h (JWT exp 30 ngày lo)", () => {
    expect(isSessionExpired({ remember: true, iat: nowS - 29 * 24 * 3600, nowS })).toBe(false)
  })
  it("không ghi nhớ: 7h59m còn, 8h01m hết", () => {
    expect(isSessionExpired({ remember: false, iat: nowS - (8 * 3600 - 60), nowS })).toBe(false)
    expect(isSessionExpired({ remember: false, iat: nowS - (8 * 3600 + 60), nowS })).toBe(true)
  })
  it("chưa có iat (vừa đăng nhập) → không hết", () => {
    expect(isSessionExpired({ remember: false, iat: undefined, nowS })).toBe(false)
  })
})
