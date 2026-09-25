import { describe, it, expect } from "vitest"
import { withCurrentSubject } from "@/lib/subject-options"

const toan = { id: 1, name: "Toán", color: "#0891B2" }
const anh = { id: 2, name: "Tiếng Anh", color: "#4F46E5" }
const hoa = { id: 3, name: "Hóa", color: "#DC2626" }

describe("withCurrentSubject", () => {
  it("không có môn hiện tại → giữ nguyên danh sách, hidden=false", () => {
    expect(withCurrentSubject([toan, anh])).toEqual([
      { ...toan, hidden: false },
      { ...anh, hidden: false },
    ])
  })

  it("môn hiện tại đang dạy → không thêm trùng", () => {
    expect(withCurrentSubject([toan, anh], anh)).toHaveLength(2)
  })

  it("môn hiện tại đã ẩn → thêm vào cuối với hidden=true", () => {
    const result = withCurrentSubject([toan, anh], hoa)
    expect(result).toHaveLength(3)
    expect(result[2]).toEqual({ ...hoa, hidden: true })
  })

  it("danh sách chưa tải xong → vẫn hiện môn hiện tại, không gắn nhãn đã ẩn", () => {
    expect(withCurrentSubject(undefined, toan)).toEqual([{ ...toan, hidden: false }])
    expect(withCurrentSubject(undefined)).toEqual([])
  })
})
