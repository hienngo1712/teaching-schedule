import { describe, it, expect } from "vitest"
import {
  parseTimeToDate,
  formatTime,
  calcDurationMinutes,
  formatDuration,
} from "@/lib/utils"

describe("parseTimeToDate", () => {
  it("'08:00' → UTC hours=8, minutes=0", () => {
    const d = parseTimeToDate("08:00")
    expect(d.getUTCHours()).toBe(8)
    expect(d.getUTCMinutes()).toBe(0)
  })

  it("'14:30' → UTC hours=14, minutes=30", () => {
    const d = parseTimeToDate("14:30")
    expect(d.getUTCHours()).toBe(14)
    expect(d.getUTCMinutes()).toBe(30)
  })
})

describe("formatTime", () => {
  it("Date(08:00 UTC) → '08:00'", () => {
    const d = new Date(0)
    d.setUTCHours(8, 0, 0, 0)
    expect(formatTime(d)).toBe("08:00")
  })

  it("roundtrip: parseTimeToDate('14:30') → formatTime → '14:30'", () => {
    expect(formatTime(parseTimeToDate("14:30"))).toBe("14:30")
  })
})

describe("calcDurationMinutes", () => {
  it("08:00 → 09:30 = 90 phút", () => {
    expect(
      calcDurationMinutes(parseTimeToDate("08:00"), parseTimeToDate("09:30"))
    ).toBe(90)
  })

  it("14:00 → 15:00 = 60 phút", () => {
    expect(
      calcDurationMinutes(parseTimeToDate("14:00"), parseTimeToDate("15:00"))
    ).toBe(60)
  })

  it("08:00 → 08:45 = 45 phút", () => {
    expect(
      calcDurationMinutes(parseTimeToDate("08:00"), parseTimeToDate("08:45"))
    ).toBe(45)
  })
})

describe("formatDuration", () => {
  it("45 → '45 phút'", () => expect(formatDuration(45)).toBe("45 phút"))
  it("60 → '1h'", () => expect(formatDuration(60)).toBe("1h"))
  it("90 → '1h 30p'", () => expect(formatDuration(90)).toBe("1h 30p"))
  it("120 → '2h'", () => expect(formatDuration(120)).toBe("2h"))
})
