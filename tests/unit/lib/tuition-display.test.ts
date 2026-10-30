import { describe, it, expect } from "vitest"
import { dueNow, getRowStatus, isInProgressMonth, isProvisional, lastSessionEnd, noticeAgeDays, type DisplayRow } from "@/lib/tuition-display"

const base: DisplayRow = { previousBalance: 0, totalExpected: 0, totalAmountDue: 0, paidAmount: 0, isFullPaid: false, billingMode: "per_session", inProgress: false }
const NOW = new Date("2026-10-13T05:00:00Z") // 13/10 giờ VN
// Cách DB trả về: sessionDate = 0h UTC của ngày VN, endTime = giờ VN trên ngày 1970-01-01 UTC
const d = (iso: string) => new Date(`${iso}T00:00:00Z`)
const t = (hm: string) => new Date(`1970-01-01T${hm}:00Z`)

describe("tuition-display (spec Y §3.4, §3.5)", () => {
  it("isInProgressMonth: tháng quá khứ = xong, tương lai = đang học (bất kể ca cuối)", () => {
    const ended = new Date("2026-10-01T00:00:00Z")
    expect(isInProgressMonth(2026, 9, null, NOW)).toBe(false)
    expect(isInProgressMonth(2026, 9, new Date("2026-12-01T00:00:00Z"), NOW)).toBe(false)
    expect(isInProgressMonth(2026, 11, null, NOW)).toBe(true)
    expect(isInProgressMonth(2026, 11, ended, NOW)).toBe(true)
  })
  it("isInProgressMonth: tháng hiện tại xong ngay khi ca cuối kết thúc (spec AS)", () => {
    // Ca cuối 28/10 17:00–18:30 giờ VN = 11:30Z
    const end = lastSessionEnd([{ sessionDate: d("2026-10-28"), endTime: t("18:30"), status: "scheduled", isDeleted: false }])
    expect(end?.toISOString()).toBe("2026-10-28T11:30:00.000Z")
    expect(isInProgressMonth(2026, 10, end, new Date("2026-10-28T11:29:00Z"))).toBe(true) // 18:29 VN
    expect(isInProgressMonth(2026, 10, end, new Date("2026-10-28T11:30:00Z"))).toBe(false) // 18:30 VN
    expect(isInProgressMonth(2026, 10, end, new Date("2026-10-29T02:00:00Z"))).toBe(false)
  })
  it("isInProgressMonth: HS không có ca trong tháng hiện tại → đang học tới hết tháng", () => {
    expect(isInProgressMonth(2026, 10, null, NOW)).toBe(true)
    expect(isInProgressMonth(2026, 10, null, new Date("2026-10-31T16:59:00Z"))).toBe(true) // 31/10 23:59 VN
    expect(isInProgressMonth(2026, 10, null, new Date("2026-10-31T17:00:00Z"))).toBe(false) // 1/11 0:00 VN
  })
  it("lastSessionEnd: lấy ca kết thúc muộn nhất, bỏ ca huỷ/đã xoá", () => {
    const s = (date: string, end: string, extra = {}) => ({ sessionDate: d(date), endTime: t(end), status: "scheduled", isDeleted: false, ...extra })
    expect(lastSessionEnd([])).toBeNull()
    expect(lastSessionEnd([s("2026-10-30", "20:00", { status: "cancelled" }), s("2026-10-31", "20:00", { isDeleted: true })])).toBeNull()
    const end = lastSessionEnd([
      s("2026-10-28", "18:30"),
      s("2026-10-28", "10:00"),
      s("2026-10-30", "20:00", { status: "cancelled" }),
      s("2026-10-31", "20:00", { isDeleted: true }),
    ])
    expect(end?.toISOString()).toBe("2026-10-28T11:30:00.000Z")
  })
  it("lastSessionEnd: ca tối VN khi UTC đã sang ngày khác / ca sáng sớm VN còn là ngày trước theo UTC", () => {
    // 31/10 22:00 VN = 31/10 15:00Z; 1/11 06:00 VN = 31/10 23:00Z nhưng thuộc tháng 11
    const evening = lastSessionEnd([{ sessionDate: d("2026-10-31"), endTime: t("22:00"), status: "scheduled", isDeleted: false }])
    expect(evening?.toISOString()).toBe("2026-10-31T15:00:00.000Z")
    expect(isInProgressMonth(2026, 10, evening, new Date("2026-10-31T14:59:00Z"))).toBe(true)
    expect(isInProgressMonth(2026, 10, evening, new Date("2026-10-31T15:00:00Z"))).toBe(false)
    const early = lastSessionEnd([{ sessionDate: d("2026-11-01"), endTime: t("06:00"), status: "scheduled", isDeleted: false }])
    expect(early?.toISOString()).toBe("2026-10-31T23:00:00.000Z")
    // 31/10 23:30Z = 1/11 06:30 VN: tháng 11 là tháng hiện tại, ca đã xong
    expect(isInProgressMonth(2026, 11, early, new Date("2026-10-31T23:30:00Z"))).toBe(false)
    // Tháng 10 lúc đó đã là quá khứ theo giờ VN dù UTC vẫn là 31/10
    expect(isInProgressMonth(2026, 10, null, new Date("2026-10-31T23:30:00Z"))).toBe(false)
  })
  it("tháng đã kết thúc: cần đóng = tổng − đã đóng", () => {
    expect(dueNow({ ...base, previousBalance: 200_000, totalExpected: 600_000, totalAmountDue: 800_000, paidAmount: 300_000 })).toBe(500_000)
  })
  it("tháng đang học, theo buổi: không cộng tiền tạm tính", () => {
    const r = { ...base, inProgress: true, previousBalance: 800_000, totalExpected: 300_000, totalAmountDue: 1_100_000 }
    expect(isProvisional(r)).toBe(true)
    expect(dueNow(r)).toBe(800_000)
    expect(dueNow({ ...r, paidAmount: 800_000 })).toBe(0)
  })
  it("tháng đang học, trọn tháng: cộng cả tháng", () => {
    const r = { ...base, inProgress: true, billingMode: "monthly" as const, previousBalance: 0, totalExpected: 400_000, totalAmountDue: 400_000 }
    expect(isProvisional(r)).toBe(false)
    expect(dueNow(r)).toBe(400_000)
  })
  it("đã miễn → 0; trả trước (âm) → 0", () => {
    expect(dueNow({ ...base, totalAmountDue: 500_000, isFullPaid: true })).toBe(0)
    expect(dueNow({ ...base, totalAmountDue: -100_000 })).toBe(0)
  })
  it("trạng thái tháng đang học: hết nợ cũ → Đã đóng đủ; chưa có gì phải đóng → in_progress", () => {
    const r = { ...base, inProgress: true, previousBalance: 800_000, totalExpected: 300_000, totalAmountDue: 1_100_000 }
    expect(getRowStatus(r)).toBe("unpaid")
    expect(getRowStatus({ ...r, paidAmount: 800_000 })).toBe("fully_paid")
    expect(getRowStatus({ ...r, previousBalance: 0, totalAmountDue: 300_000 })).toBe("in_progress")
  })
  it("noticeAgeDays theo ngày VN", () => {
    expect(noticeAgeDays(new Date("2026-10-05T03:00:00Z"), NOW)).toBe(8)
    expect(noticeAgeDays(new Date("2026-10-12T18:00:00Z"), NOW)).toBe(0) // 13/10 01:00 giờ VN
  })
})
