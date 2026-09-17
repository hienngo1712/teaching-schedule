import { describe, it, expect } from "vitest"
import { vnDateParts } from "@/lib/utils"

/**
 * Dashboard chạy trên server UTC (Vercel). Nếu lấy ngày bằng getDate() của
 * process thì từ 00:00–07:00 giờ VN nó vẫn trả ngày HÔM TRƯỚC — "Số ca hôm nay"
 * và mốc "tháng này" sẽ lệch với giáo viên.
 */
describe("vnDateParts", () => {
  it("00:30 giờ VN (17:30 UTC hôm trước) → đã sang ngày mới theo VN", () => {
    // 2026-03-09T17:30:00Z === 2026-03-10 00:30 giờ VN
    expect(vnDateParts(new Date("2026-03-09T17:30:00Z"))).toEqual({
      year: 2026,
      month: 3,
      day: 10,
    })
  })

  it("23:30 giờ VN vẫn là ngày hôm đó", () => {
    // 2026-03-10T16:30:00Z === 2026-03-10 23:30 giờ VN
    expect(vnDateParts(new Date("2026-03-10T16:30:00Z"))).toEqual({
      year: 2026,
      month: 3,
      day: 10,
    })
  })

  it("qua ranh giới tháng: 01/04 lúc 00:30 giờ VN, UTC vẫn đang 31/03", () => {
    expect(vnDateParts(new Date("2026-03-31T17:30:00Z"))).toEqual({
      year: 2026,
      month: 4,
      day: 1,
    })
  })

  it("qua ranh giới năm: 01/01 lúc 06:00 giờ VN, UTC vẫn đang 31/12", () => {
    expect(vnDateParts(new Date("2025-12-31T23:00:00Z"))).toEqual({
      year: 2026,
      month: 1,
      day: 1,
    })
  })
})
