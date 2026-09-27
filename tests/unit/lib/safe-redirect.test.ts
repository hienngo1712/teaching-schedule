import { describe, it, expect } from "vitest"
import { safeCallbackUrl } from "@/lib/safe-redirect"

const ORIGIN = "http://localhost:3000"

describe("safeCallbackUrl", () => {
  it.each([
    "https://evil.tld",
    "//evil.tld",
    "/\\evil.tld",
    "javascript:alert(1)",
    "/\t/evil.tld",
    "http://localhost:3000//evil.tld",
    "http://localhost:3001/students",
    "",
  ])("%j → /dashboard", (raw) => {
    expect(safeCallbackUrl(raw, ORIGIN)).toBe("/dashboard")
  })

  it("không có callbackUrl → /dashboard", () => {
    expect(safeCallbackUrl(null, ORIGIN)).toBe("/dashboard")
  })

  it("đường dẫn nội bộ giữ nguyên", () => {
    expect(safeCallbackUrl("/students?x=1", ORIGIN)).toBe("/students?x=1")
  })

  it("URL tuyệt đối cùng origin (middleware gắn) → đổi về đường dẫn nội bộ", () => {
    expect(safeCallbackUrl("http://localhost:3000/students?x=1#a", ORIGIN)).toBe("/students?x=1#a")
  })
})
