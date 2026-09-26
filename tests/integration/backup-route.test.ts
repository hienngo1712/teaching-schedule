import { describe, it, expect, vi, beforeEach } from "vitest"
import ExcelJS from "exceljs"
import { db } from "@/server/db"

vi.mock("@/server/auth", () => ({ auth: vi.fn() }))

import { auth } from "@/server/auth"
import { GET } from "@/app/api/backup/route"

// `auth` của NextAuth có nhiều overload, ép về dạng đơn giản để mock.
const authMock = auth as unknown as ReturnType<typeof vi.fn>

describe("GET /api/backup", () => {
  beforeEach(() => {
    authMock.mockReset()
  })

  it("không có phiên → 401", async () => {
    authMock.mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("phiên có user.id rỗng → 401, không chạy với userId 0", async () => {
    authMock.mockResolvedValue({ user: { id: "" } })
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("đã đăng nhập → 200, đúng header, body là xlsx đọc được", async () => {
    const teacher = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    authMock.mockResolvedValue({ user: { id: String(teacher.id) } })

    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    expect(res.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="SaoLuu_\d{4}-\d{2}-\d{2}_\d{4}\.xlsx"$/
    )
    expect(res.headers.get("Cache-Control")).toBe("no-store")

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await res.arrayBuffer())
    expect(wb.getWorksheet("Học sinh")).toBeDefined()
    expect(wb.getWorksheet("Lần thu")).toBeDefined()
  })

  it("lỗi bất ngờ (user không tồn tại) → 500, không lộ chi tiết", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    authMock.mockResolvedValue({ user: { id: "999999999" } })
    const res = await GET()
    expect(res.status).toBe(500)
    expect(await res.text()).toBe("")
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
