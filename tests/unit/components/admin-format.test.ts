import { describe, it, expect } from "vitest"
import { timeDayVn } from "@/components/admin/admin-format"

describe("timeDayVn", () => {
  it("giờ VN dạng HH:mm dd/MM", () => {
    expect(timeDayVn("2026-10-09T13:15:00.000Z")).toBe("20:15 09/10")
    expect(timeDayVn("2026-10-09T17:30:00.000Z")).toBe("00:30 10/10")
  })
})
