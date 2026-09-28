import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const KEY = "APP_BUILD_TIMESTAMP"
const saved = process.env[KEY]

// next build nạp next.config.mjs lại trong từng worker (server/client); mô phỏng bằng resetModules + import lại.
async function loadBuildTime(): Promise<string | undefined> {
  vi.resetModules()
  const mod = await import("../../next.config.mjs")
  return mod.default.env?.NEXT_PUBLIC_BUILD_TIME
}

beforeEach(() => {
  delete process.env[KEY]
  vi.useFakeTimers({ toFake: ["Date"] })
})
afterEach(() => {
  vi.useRealTimers()
  if (saved === undefined) delete process.env[KEY]
  else process.env[KEY] = saved
})

describe("next.config — giờ build chung cho mọi worker (spec P2)", () => {
  it("nạp lần 2 sau 2 phút vẫn cùng giờ build (bundle server và client không lệch → hết #418)", async () => {
    vi.setSystemTime(new Date("2026-09-27T07:15:30Z"))
    const first = await loadBuildTime()
    vi.setSystemTime(new Date("2026-09-27T07:17:30Z"))
    const second = await loadBuildTime()
    expect(first).toBe("27/09/2026 14:15")
    expect(second).toBe(first)
  })

  it("APP_BUILD_TIMESTAMP có sẵn (worker con thừa hưởng từ tiến trình chính) → dùng đúng mốc đó", async () => {
    process.env[KEY] = String(Date.parse("2026-12-31T17:05:00Z"))
    expect(await loadBuildTime()).toBe("01/01/2027 00:05")
  })
})
