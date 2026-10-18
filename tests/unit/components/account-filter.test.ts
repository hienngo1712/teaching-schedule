import { describe, expect, it } from "vitest"
import { DEFAULT_ACCOUNT_FILTER as D, filterAccounts } from "@/components/admin/account-filter"

const rows = [
  { id: 1, username: "hien_admin", fullName: "Admin", createdAt: new Date("2026-09-26T03:00:00Z") },
  { id: 2, username: "Suiuoi", fullName: "Ms Ly", createdAt: new Date("2026-05-05T03:00:00Z") },
  { id: 3, username: "qa_test", fullName: null, createdAt: new Date("2026-10-11T18:30:00Z") }, // 12/10 01:30 VN
  { id: 4, username: "ngominhnhat", fullName: "Ngô Minh Bình", createdAt: new Date("2026-06-12T03:00:00Z") },
]
const ids = (r: { id: number }[]) => r.map((x) => x.id)

describe("filterAccounts", () => {
  it("mặc định sắp mới nhất trước", () => expect(ids(filterAccounts(rows, D))).toEqual([3, 1, 4, 2]))
  it("Cũ nhất", () => expect(ids(filterAccounts(rows, { ...D, sort: "oldest" }))).toEqual([2, 4, 1, 3]))
  it("hoà createdAt thì theo id cùng chiều", () => {
    const same = [1, 2, 3].map((id) => ({ id, username: `u${id}`, fullName: null, createdAt: "2026-09-01T03:00:00Z" }))
    expect(ids(filterAccounts(same, D))).toEqual([3, 2, 1])
    expect(ids(filterAccounts(same, { ...D, sort: "oldest" }))).toEqual([1, 2, 3])
  })
  it("tìm theo username, không phân biệt hoa thường, bỏ khoảng trắng 2 đầu", () =>
    expect(ids(filterAccounts(rows, { ...D, search: "  SUIU " }))).toEqual([2]))
  it("tìm theo họ tên có dấu", () => expect(ids(filterAccounts(rows, { ...D, search: "minh bình" }))).toEqual([4]))
  it("fullName null vẫn tìm theo username", () => expect(ids(filterAccounts(rows, { ...D, search: "qa_" }))).toEqual([3]))
  it("khoảng ngày bao 2 đầu, theo ngày VN", () => {
    expect(ids(filterAccounts(rows, { ...D, from: "2026-10-12", to: "2026-10-12" }))).toEqual([3])
    expect(ids(filterAccounts(rows, { ...D, from: "2026-06-12", to: "2026-09-26" }))).toEqual([1, 4])
  })
  it("chỉ Từ ngày hoặc chỉ Đến ngày", () => {
    expect(ids(filterAccounts(rows, { ...D, from: "2026-09-01" }))).toEqual([3, 1])
    expect(ids(filterAccounts(rows, { ...D, to: "2026-06-12" }))).toEqual([4, 2])
  })
  it("Từ > Đến ra rỗng, không lỗi", () => expect(filterAccounts(rows, { ...D, from: "2026-10-01", to: "2026-09-01" })).toEqual([]))
  it("không sửa mảng gốc", () => {
    const copy = [...rows]
    filterAccounts(rows, D)
    expect(rows).toEqual(copy)
  })
})
