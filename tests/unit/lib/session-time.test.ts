import { describe, it, expect } from "vitest"
import { hasSessionEnded, vnToday } from "@/lib/session-time"
import { parseTimeToDate } from "@/lib/utils"

const ses = (date: string, end: string) => ({ sessionDate: new Date(`${date}T00:00:00Z`), endTime: parseTimeToDate(end) })

describe("vnToday (spec P6)", () => {
  it("23:30Z ngày 9 = 06:30 VN ngày 10 → ngày 10", () => {
    expect(vnToday(new Date("2099-03-09T23:30:00Z")).toISOString()).toBe("2099-03-10T00:00:00.000Z")
  })
  it("16:59Z = 23:59 VN cùng ngày", () => {
    expect(vnToday(new Date("2099-03-10T16:59:00Z")).toISOString()).toBe("2099-03-10T00:00:00.000Z")
  })
})

describe("hasSessionEnded — so giờ tường VN (spec P6)", () => {
  const at18hVn = new Date("2099-03-10T11:00:00Z")
  it("18:00 VN: ca kết thúc 17:00 cùng ngày đã xong, ca kết thúc 20:00 chưa", () => {
    expect(hasSessionEnded(ses("2099-03-10", "17:00"), at18hVn)).toBe(true)
    expect(hasSessionEnded(ses("2099-03-10", "20:00"), at18hVn)).toBe(false)
  })
  it("đúng phút kết thúc → đã kết thúc", () => {
    expect(hasSessionEnded(ses("2099-03-10", "18:00"), at18hVn)).toBe(true)
  })
  it("01:00 VN hôm sau: ca tối qua kết thúc 21:00 đã xong, ca sáng nay kết thúc 09:00 chưa", () => {
    const at1hVn = new Date("2099-03-10T18:00:00Z")
    expect(hasSessionEnded(ses("2099-03-10", "21:00"), at1hVn)).toBe(true)
    expect(hasSessionEnded(ses("2099-03-11", "09:00"), at1hVn)).toBe(false)
  })
})
