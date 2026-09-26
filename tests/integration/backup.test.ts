import { describe, it, expect, beforeAll } from "vitest"
import ExcelJS from "exceljs"
import { Prisma } from "@prisma/client"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { buildBackupWorkbook } from "@/server/services/backup.service"

const NOW = new Date("2026-09-25T14:30:00Z")

const DATA_SHEETS = ["Học sinh", "Môn học"]

const HEADERS: Record<string, string[]> = {
  "Thông tin": ["Mục", "Giá trị"],
  "Học sinh": [
    "ID", "Họ tên", "Lớp", "Tên phụ huynh", "SĐT phụ huynh", "Học phí/buổi",
    "Đang học", "Ghi chú", "Ngày tạo", "Cập nhật lần cuối",
  ],
  "Môn học": ["ID", "Tên môn", "Màu (hex)", "Mặc định", "Đang dạy", "Thứ tự", "Ngày tạo"],
}

// Số bản ghi của user theo đúng điều kiện chủ sở hữu ở spec mục 6.3.
const COUNTERS: Record<string, (userId: number) => Promise<number>> = {
  "Học sinh": (userId) => db.student.count({ where: { userId } }),
  "Môn học": (userId) => db.subject.count({ where: { userId } }),
}

// Cột token của G chỉ có sau khi G merge; có thì phải chắc chắn không lọt ra file.
const HAS_PARENT_TOKEN =
  Prisma.dmmf.datamodel.models
    .find((m) => m.name === "Student")
    ?.fields.some((f) => f.name === "parentLinkToken") ?? false
const PARENT_TOKEN = "BKtoken_" + "x".repeat(35) // 43 ký tự, đúng dạng token G

const FOREIGN_TEXTS = ["Người Lạ GV2", "Môn Lạ GV2"]

async function loadBackup(userId: number): Promise<ExcelJS.Workbook> {
  const wb = await buildBackupWorkbook(db, userId, NOW)
  const buf = await wb.xlsx.writeBuffer()
  const loaded = new ExcelJS.Workbook()
  await loaded.xlsx.load(buf)
  return loaded
}

function sheet(wb: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const ws = wb.getWorksheet(name)
  if (!ws) throw new Error(`Thiếu sheet ${name}`)
  return ws
}

function headersOf(ws: ExcelJS.Worksheet): unknown[] {
  return (ws.getRow(1).values as unknown[]).slice(1)
}

function cellOf(ws: ExcelJS.Worksheet, id: number, header: string): ExcelJS.Cell {
  const col = headersOf(ws).indexOf(header)
  if (col < 0) throw new Error(`Sheet ${ws.name} không có cột ${header}`)
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    if (row.getCell(1).value === id) return row.getCell(col + 1)
  }
  throw new Error(`Sheet ${ws.name} không có dòng ID ${id}`)
}

function infoValue(wb: ExcelJS.Workbook, label: string): ExcelJS.CellValue {
  const ws = sheet(wb, "Thông tin")
  for (let r = 2; r <= ws.rowCount; r++) {
    if (ws.getRow(r).getCell(1).value === label) return ws.getRow(r).getCell(2).value
  }
  throw new Error(`Sheet Thông tin không có mục ${label}`)
}

function allCellTexts(wb: ExcelJS.Workbook): string[] {
  const texts: string[] = []
  wb.eachSheet((ws) =>
    ws.eachRow((row) => row.eachCell((cell) => texts.push(String(cell.value))))
  )
  return texts
}

describe("buildBackupWorkbook", () => {
  let teacherId: number
  let passwordHash: string
  let anId: number
  let binhId: number
  let hiddenSubjectId: number

  beforeAll(async () => {
    const a = await getAuthedCaller("teacher")
    const b = await getAuthedCaller("teacher2")
    const teacher = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    teacherId = teacher.id
    passwordHash = teacher.passwordHash

    const an = await a.student.create({
      fullName: "An Sao Lưu", grade: 3, parentName: "Mẹ An",
      parentPhone: "0912345678", tuitionFee: 150000, notes: '=HYPERLINK("http://x")',
    })
    anId = an.id
    // 20:00 UTC = 03:00 sáng hôm sau giờ VN → bắt lỗi quên cộng 7 giờ.
    await db.student.update({ where: { id: anId }, data: { createdAt: new Date("2026-01-01T20:00:00Z") } })

    const binh = await a.student.create({ fullName: "Bình Sao Lưu", grade: 5 })
    binhId = binh.id
    await a.student.update({ id: binhId, data: { isActive: false } })

    const hidden = await a.subject.create({ name: "Lý Sao Lưu" })
    hiddenSubjectId = hidden.id
    await a.subject.update({ id: hiddenSubjectId, data: { isActive: false } })

    await b.student.create({ fullName: "Người Lạ GV2", grade: 4 })
    await b.subject.create({ name: "Môn Lạ GV2" })

    if (HAS_PARENT_TOKEN) {
      await db.$executeRaw`UPDATE "students" SET "parent_link_token" = ${PARENT_TOKEN} WHERE "id" = ${anId}`
    }
  })

  it("đủ sheet đúng thứ tự, dòng 1 đúng tiêu đề", async () => {
    const wb = await loadBackup(teacherId)
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(["Thông tin", ...DATA_SHEETS])
    for (const ws of wb.worksheets) {
      expect(headersOf(ws), ws.name).toEqual(HEADERS[ws.name])
    }
  })

  it("số dòng mỗi sheet = số bản ghi của user, sheet Thông tin ghi đúng số đó", async () => {
    const wb = await loadBackup(teacherId)
    for (const name of DATA_SHEETS) {
      const expected = await COUNTERS[name](teacherId)
      expect(expected, name).toBeGreaterThan(0)
      expect(sheet(wb, name).actualRowCount - 1, name).toBe(expected)
      expect(infoValue(wb, `Số dòng: ${name}`), name).toBe(expected)
    }
  })

  it("không lọt dữ liệu user khác, passwordHash hay cột nhạy cảm", async () => {
    const texts = allCellTexts(await loadBackup(teacherId))
    for (const foreign of FOREIGN_TEXTS) {
      expect(texts.some((t) => t.includes(foreign)), foreign).toBe(false)
    }
    expect(texts.some((t) => t.includes(passwordHash))).toBe(false)
    const wb = await loadBackup(teacherId)
    for (const ws of wb.worksheets) {
      for (const h of headersOf(ws)) expect(String(h)).not.toMatch(/password|mật khẩu|token/i)
    }
  })

  it.runIf(HAS_PARENT_TOKEN)("không xuất Student.parentLinkToken (cột của G)", async () => {
    const texts = allCellTexts(await loadBackup(teacherId))
    expect(texts.some((t) => t.includes(PARENT_TOKEN))).toBe(false)
  })

  it("Học sinh: SĐT giữ số 0, tiền là số nguyên, Có/Không, ô rỗng, mốc thời gian giờ VN", async () => {
    const ws = sheet(await loadBackup(teacherId), "Học sinh")

    const phone = cellOf(ws, anId, "SĐT phụ huynh")
    expect(phone.value).toBe("0912345678")
    expect(phone.numFmt).toBe("@")

    const fee = cellOf(ws, anId, "Học phí/buổi")
    expect(fee.value).toBe(150000)
    expect(Number.isInteger(fee.value)).toBe(true)
    expect(fee.numFmt).toBe("#,##0")

    expect(cellOf(ws, anId, "Đang học").value).toBe("Có")
    expect(cellOf(ws, binhId, "Đang học").value).toBe("Không")

    // Chuỗi bắt đầu bằng "=" vẫn phải là chuỗi, không thành công thức.
    expect(cellOf(ws, anId, "Ghi chú").value).toBe('=HYPERLINK("http://x")')

    expect(cellOf(ws, binhId, "SĐT phụ huynh").value).toBeNull()
    expect(cellOf(ws, binhId, "Tên phụ huynh").value).toBeNull()
    expect(cellOf(ws, binhId, "Ghi chú").value).toBeNull()

    const created = cellOf(ws, anId, "Ngày tạo")
    expect(created.value).toBeInstanceOf(Date)
    expect((created.value as Date).toISOString()).toBe("2026-01-02T03:00:00.000Z")
    expect(created.numFmt).toBe("dd/mm/yyyy hh:mm")
  })

  it("Môn học: xuất cả môn đã ẩn, cột Mặc định / Đang dạy", async () => {
    const wb = await loadBackup(teacherId)
    const ws = sheet(wb, "Môn học")
    expect(cellOf(ws, hiddenSubjectId, "Đang dạy").value).toBe("Không")
    expect(cellOf(ws, hiddenSubjectId, "Mặc định").value).toBe("Không")
    const seeded = await db.subject.findFirstOrThrow({ where: { userId: teacherId, name: "Tiếng Anh" } })
    expect(cellOf(ws, seeded.id, "Mặc định").value).toBe("Có")
    expect(cellOf(ws, seeded.id, "Màu (hex)").value).toBe("#4F46E5")
  })

  it("Thông tin: tài khoản, họ tên, thời điểm xuất giờ VN", async () => {
    const wb = await loadBackup(teacherId)
    expect(infoValue(wb, "Tài khoản")).toBe("teacher")
    expect(infoValue(wb, "Họ tên")).toBe("Giáo viên Test")
    const at = infoValue(wb, "Thời điểm xuất")
    expect(at).toBeInstanceOf(Date)
    expect((at as Date).toISOString()).toBe("2026-09-25T21:30:00.000Z")
  })

  it("user chưa có dữ liệu: đủ sheet, chỉ có dòng tiêu đề", async () => {
    const empty = await db.user.create({ data: { username: "backup_empty", passwordHash: "x" } })
    const wb = await loadBackup(empty.id)
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(["Thông tin", ...DATA_SHEETS])
    for (const name of DATA_SHEETS) {
      expect(sheet(wb, name).actualRowCount, name).toBe(1)
      expect(infoValue(wb, `Số dòng: ${name}`), name).toBe(0)
    }
  })
})
