import { describe, it, expect } from "vitest"
import { ACTIVITY_TOUCH_MS, shouldTouch, vnDayDate, vnDayKey } from "@/lib/activity"

describe("ngày VN cho hoạt động (spec K B10)", () => {
  it("16:59 UTC còn ngày cũ, 17:00 UTC sang ngày mới giờ VN", () => {
    expect(vnDayKey(new Date("2026-10-31T16:59:00Z"))).toBe("2026-10-31")
    expect(vnDayKey(new Date("2026-10-31T17:00:00Z"))).toBe("2026-11-01")
    expect(vnDayKey(new Date("2026-12-31T17:30:00Z"))).toBe("2027-01-01")
  })
  it("vnDayDate = nửa đêm UTC của ngày VN (cho cột DATE)", () => {
    expect(vnDayDate(new Date("2026-10-31T17:00:00Z"))).toEqual(new Date("2026-11-01T00:00:00.000Z"))
    expect(vnDayDate(new Date("2026-11-01T03:00:00Z"))).toEqual(new Date("2026-11-01T00:00:00.000Z"))
  })
})

describe("shouldTouch (spec K B2)", () => {
  const now = new Date("2026-11-01T05:00:00Z") // 12:00 VN
  it("chưa từng ghi → ghi", () => {
    expect(shouldTouch(null, now)).toBe(true)
  })
  it("59 phút trước cùng ngày → không; 60 phút → ghi", () => {
    expect(shouldTouch(new Date(now.getTime() - ACTIVITY_TOUCH_MS + 60_000), now)).toBe(false)
    expect(shouldTouch(new Date(now.getTime() - ACTIVITY_TOUCH_MS), now)).toBe(true)
  })
  it("23:50 VN hôm trước → 00:10 VN hôm nay (20 phút) vẫn ghi vì khác ngày", () => {
    const last = new Date("2026-10-31T16:50:00Z")
    const at = new Date("2026-10-31T17:10:00Z")
    expect(shouldTouch(last, at)).toBe(true)
  })
})
