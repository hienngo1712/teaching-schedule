import { describe, it, expect } from "vitest"
import { getSessionLabel } from "@/lib/session-label"

const subject = { name: "Tiếng Anh" }

describe("getSessionLabel", () => {
  it("title rỗng → tên môn", () => {
    expect(getSessionLabel({ title: "", subject })).toBe("Tiếng Anh")
  })

  it("title chỉ có khoảng trắng → tên môn", () => {
    expect(getSessionLabel({ title: "   ", subject })).toBe("Tiếng Anh")
  })

  it("title null → tên môn", () => {
    expect(getSessionLabel({ title: null, subject })).toBe("Tiếng Anh")
  })

  it("có title → dùng title", () => {
    expect(getSessionLabel({ title: "Nhóm nâng cao", subject })).toBe("Nhóm nâng cao")
  })
})
