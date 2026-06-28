import { describe, it, expect } from "vitest"
import { buildCalendarGrid, buildMonthLabel } from "@/hooks/useCalendar"
import { DAY_NAMES } from "@/lib/constants"

describe("useCalendar grid", () => {
  it("Tháng 4/2026 bắt đầu T4 → 2 ô trống đầu (T2, T3)", () => {
    const { grid } = buildCalendarGrid(2026, 4, [])
    expect(grid[0].isCurrentMonth).toBe(false)
    expect(grid[1].isCurrentMonth).toBe(false)
    expect(grid[2].dayNumber).toBe(1)
    expect(grid[2].isCurrentMonth).toBe(true)
  })

  it("Tháng 4/2026 có đúng 30 ngày trong tháng", () => {
    const { grid } = buildCalendarGrid(2026, 4, [])
    const currentMonth = grid.filter((c) => c.isCurrentMonth)
    expect(currentMonth).toHaveLength(30)
  })

  it("Tháng 2/2026 bắt đầu CN → 6 ô trống đầu (T2..T7)", () => {
    // 1/2/2026 là Chủ Nhật
    const { grid } = buildCalendarGrid(2026, 2, [])
    expect(grid[6].dayNumber).toBe(1)
    expect(grid[6].isCurrentMonth).toBe(true)
  })

  it("Grid luôn là bội số của 7", () => {
    const { grid } = buildCalendarGrid(2026, 4, [])
    expect(grid.length % 7).toBe(0)
  })

  it("monthLabel đúng format mặc định (VN)", () => {
    expect(buildMonthLabel(2026, 4)).toBe("Tháng 4 / 2026")
    expect(buildMonthLabel(2026, 12)).toBe("Tháng 12 / 2026")
  })

  it("monthLabel đúng format với localization (EN)", () => {
    const t = (key: any) => {
      if (key === "month_year_label") return "Month {month} / {year}"
      return key
    }
    expect(buildMonthLabel(2026, 4, t)).toBe("Month 4 / 2026")
  })

  it("daysOfWeek đúng thứ tự T2–CN", () => {
    expect(DAY_NAMES).toEqual(["T2", "T3", "T4", "T5", "T6", "T7", "CN"])
  })

  it("Sessions được map vào đúng cell theo sessionDate", () => {
    const session = {
      id: 1,
      userId: 1,
      sessionDate: new Date(Date.UTC(2026, 3, 10)), // 10/4/2026
      startTime: "08:00",
      endTime: "09:30",
      durationMins: 90,
      subjectId: 1,
      subject: { id: 1, name: "Toán", color: "#000" },
      title: null,
      notes: null,
      status: "scheduled",
      cancelReason: null,
      cancelledAt: null,
      makeupOfId: null,
      studentCount: 0,
      level: "tieu_hoc" as const,
      students: [],
    }
    const { grid } = buildCalendarGrid(2026, 4, [session])
    const cell = grid.find((c) => c.date === "2026-04-10")
    expect(cell?.sessions).toHaveLength(1)
    expect(cell?.sessions[0].id).toBe(1)
  })
})
