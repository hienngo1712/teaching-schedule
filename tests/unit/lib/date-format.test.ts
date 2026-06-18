import { describe, it, expect, vi } from "vitest"
import { formatDate, formatDayOfWeek, formatToday, removeVietnameseTones } from "@/lib/utils"

// sessionDate lưu UTC midnight; calendar dựng lưới theo UTC. formatDate/
// formatDayOfWeek phải đọc theo UTC để không lệch 1 ngày so với lưới lịch.
// Dùng mốc 23:30Z: ở múi giờ dương (vd +7) local sẽ nhảy sang ngày hôm sau,
// nên test bắt được sai lệch khi hàm dùng giờ local.
describe("formatDate / formatDayOfWeek — theo UTC", () => {
  const lateInDay = new Date("2026-06-18T23:30:00Z")

  it("formatDate đọc theo UTC (không lệch ngày ở múi giờ dương)", () => {
    expect(formatDate(lateInDay)).toBe("18/06/2026")
  })

  it("formatDayOfWeek đọc theo UTC", () => {
    expect(formatDayOfWeek(lateInDay)).toBe("T5") // 18/06/2026 (UTC) là thứ Năm
  })

  it("string 'YYYY-MM-DD' → đúng thứ theo UTC", () => {
    expect(formatDayOfWeek("2026-06-18")).toBe("T5")
    expect(formatDate("2026-06-18")).toBe("18/06/2026")
  })
})

describe("removeVietnameseTones — chuẩn hoá đủ ký tự", () => {
  it("chuẩn hoá ấ (a mũ sắc) → 'a', không bỏ sót trong tên file", () => {
    expect(removeVietnameseTones("ấ")).toBe("a")
    expect(removeVietnameseTones("Nguyễn Tấn Anh")).toBe("Nguyen_Tan_Anh")
  })
})

describe("formatToday — ngày xuất theo giờ LOCAL", () => {
  it("trả ngày hôm nay theo giờ địa phương (không dùng UTC)", () => {
    vi.useFakeTimers()
    // Mốc 18:00Z: ở +7 đã sang 19/06 01:00 local. formatToday phải theo local.
    vi.setSystemTime(new Date("2026-06-18T18:00:00Z"))
    const now = new Date()
    const expected = `${String(now.getDate()).padStart(2, "0")}/${String(
      now.getMonth() + 1
    ).padStart(2, "0")}/${now.getFullYear()}`
    expect(formatToday()).toBe(expected)
    vi.useRealTimers()
  })
})
