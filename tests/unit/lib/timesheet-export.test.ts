// Spec AM §4.1: Excel Bảng công mặc định không có cột tiền; bật "Kèm số tiền" mới có.
import { describe, it, expect } from "vitest"
import viText from "@/language/vi.json"
import { formatHours, sessionAmount, timesheetTable, type TimesheetRow } from "@/lib/timesheet-export"

const t = (k: string) => (viText as Record<string, string>)[k] ?? k

const row = (over: Partial<TimesheetRow>): TimesheetRow => ({
  id: 1,
  date: "2026-09-01",
  start: "18:00",
  end: "19:30",
  hours: 1.5,
  subject: "Toán 9",
  title: null,
  presentCount: 6,
  totalCount: 6,
  kind: "done",
  isMakeup: false,
  ...over,
})

const sessions = [
  row({}),
  row({ id: 2, date: "2026-09-03", kind: "cancelled", cancelReason: "Nghỉ lễ", presentCount: 0 }),
  row({ id: 3, date: "2026-09-05", isMakeup: true, title: "Nhóm A" }),
]

describe("timesheetTable", () => {
  it("mặc định không có cột Số tiền", () => {
    const { header, rows } = timesheetTable(sessions, { withMoney: false, rate: { unit: "hour", amount: 185000 } }, t)
    expect(header).toEqual(["STT", "Ngày", "Giờ dạy", "Môn", "Số giờ", "HS có mặt", "Trạng thái"])
    expect(rows[0]).toEqual([1, "T3 01/09", "18:00–19:30", "Toán 9", 1.5, "6/6", "Đã dạy"])
    expect(rows[1]).toEqual([2, "T5 03/09", "18:00–19:30", "Toán 9", "", "", "Đã huỷ · Nghỉ lễ"])
    expect(rows[2]).toEqual([3, "T7 05/09", "18:00–19:30", "Toán 9 – Nhóm A", 1.5, "6/6", "Ca bù"])
  })

  it("bật Kèm số tiền: có cột Số tiền, ca huỷ để trống; chưa có đơn giá thì vẫn không có cột", () => {
    const withMoney = timesheetTable(sessions, { withMoney: true, rate: { unit: "hour", amount: 185000 } }, t)
    expect(withMoney.header.at(-1)).toBe("Số tiền")
    expect(withMoney.rows.map((r) => r.at(-1))).toEqual([277500, "", 277500])
    expect(timesheetTable(sessions, { withMoney: true, rate: null }, t).header).not.toContain("Số tiền")
  })
})

describe("formatHours / sessionAmount", () => {
  it("giờ bỏ số 0 thừa, dấu phẩy thập phân", () => {
    expect(formatHours(1.5)).toBe("1,5")
    expect(formatHours(3)).toBe("3")
  })
  it("theo ca = đơn giá; ca sắp dạy không có tiền", () => {
    expect(sessionAmount(row({}), { unit: "session", amount: 150000 })).toBe(150000)
    expect(sessionAmount(row({ kind: "upcoming" }), { unit: "session", amount: 150000 })).toBeNull()
  })
})
