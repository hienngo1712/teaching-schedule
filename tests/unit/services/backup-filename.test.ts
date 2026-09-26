import { describe, it, expect } from "vitest"
import { backupFileName } from "@/server/services/backup.service"

describe("backupFileName", () => {
  it("quy về giờ VN, qua nửa đêm thì sang ngày mới", () => {
    expect(backupFileName(new Date("2026-09-25T17:30:00Z"))).toBe("SaoLuu_2026-09-26_0030.xlsx")
  })

  it("đệm 0 cho tháng/ngày/giờ/phút", () => {
    expect(backupFileName(new Date("2026-01-05T02:05:00Z"))).toBe("SaoLuu_2026-01-05_0905.xlsx")
  })
})
