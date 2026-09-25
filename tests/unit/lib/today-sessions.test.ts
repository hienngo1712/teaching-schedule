import { describe, it, expect } from "vitest"
import { filterTodaySessions } from "@/lib/today-sessions"

const s = (date: string, startTime: string, status = "scheduled") => ({
  sessionDate: new Date(`${date}T00:00:00.000Z`),
  startTime,
  status,
})

describe("filterTodaySessions", () => {
  it("chỉ lấy ca của ngày được chọn, sắp theo giờ bắt đầu", () => {
    const result = filterTodaySessions(
      [s("2026-09-25", "20:00"), s("2026-09-24", "08:00"), s("2026-09-25", "15:00")],
      "2026-09-25"
    )
    expect(result.map((x) => x.startTime)).toEqual(["15:00", "20:00"])
  })

  it("bỏ ca đã hủy", () => {
    const result = filterTodaySessions([s("2026-09-25", "15:00", "cancelled")], "2026-09-25")
    expect(result).toEqual([])
  })

  it("không có ca → mảng rỗng", () => {
    expect(filterTodaySessions([], "2026-09-25")).toEqual([])
  })
})
