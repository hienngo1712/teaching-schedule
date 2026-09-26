import { describe, it, expect, beforeAll } from "vitest"
import ExcelJS from "exceljs"
import { Prisma } from "@prisma/client"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { buildBackupWorkbook } from "@/server/services/backup.service"

const NOW = new Date("2026-09-25T14:30:00Z")

const DATA_SHEETS = [
  "Học sinh", "Môn học", "Ca dạy", "Điểm danh", "Học phí tháng", "Lần thu", "Lịch sử lên lớp",
]

const HEADERS: Record<string, string[]> = {
  "Thông tin": ["Mục", "Giá trị"],
  "Học sinh": [
    "ID", "Họ tên", "Lớp", "Tên phụ huynh", "SĐT phụ huynh", "Học phí/buổi",
    "Đang học", "Ghi chú", "Ngày tạo", "Cập nhật lần cuối",
  ],
  "Môn học": ["ID", "Tên môn", "Màu (hex)", "Mặc định", "Đang dạy", "Thứ tự", "Ngày tạo"],
  "Ca dạy": [
    "ID", "Ngày", "Thứ", "Bắt đầu", "Kết thúc", "ID môn", "Môn", "Tiêu đề", "Trạng thái",
    "Lý do hủy", "Thời điểm hủy", "Bù cho ca (ID)", "Số học sinh", "Ghi chú", "Ngày tạo",
  ],
  "Điểm danh": [
    "ID", "ID ca", "Ngày ca", "ID học sinh", "Học sinh", "Lớp lúc học", "Điểm danh",
    "Học phí buổi", "Ghi chú",
  ],
  "Học phí tháng": [
    "ID", "ID học sinh", "Học sinh", "Năm", "Tháng", "Tổng buổi", "Buổi có mặt", "Nợ trước",
    "Học phí tháng", "Tổng phải đóng", "Đã trả", "Đã tất toán", "Ghi chú", "Cập nhật lần cuối",
  ],
  "Lần thu": [
    "ID", "ID học phí tháng", "ID học sinh", "Học sinh", "Năm", "Tháng", "Ngày thu", "Số tiền",
    "Hình thức", "Ghi chú", "Ngày tạo", "Cập nhật lần cuối",
  ],
  "Lịch sử lên lớp": ["ID", "Năm học", "Thời điểm chạy", "Cách chạy", "Số HS lên lớp", "Số HS cho nghỉ"],
  "Cài đặt": ["Mục", "Giá trị"],
}

// Số bản ghi của user theo đúng điều kiện chủ sở hữu ở spec mục 6.3.
const COUNTERS: Record<string, (userId: number) => Promise<number>> = {
  "Học sinh": (userId) => db.student.count({ where: { userId } }),
  "Môn học": (userId) => db.subject.count({ where: { userId } }),
  "Ca dạy": (userId) => db.teachingSession.count({ where: { userId } }),
  "Điểm danh": (userId) => db.sessionStudent.count({ where: { session: { userId } } }),
  "Học phí tháng": (userId) => db.monthlyTuition.count({ where: { student: { userId } } }),
  "Lần thu": (userId) => db.payment.count({ where: { monthlyTuition: { student: { userId } } } }),
  "Lịch sử lên lớp": (userId) => db.classUpgradeLog.count({ where: { userId } }),
}

// Cột token của G chỉ có sau khi G merge; có thì phải chắc chắn không lọt ra file.
const HAS_PARENT_TOKEN =
  Prisma.dmmf.datamodel.models
    .find((m) => m.name === "Student")
    ?.fields.some((f) => f.name === "parentLinkToken") ?? false
const PARENT_TOKEN = "BKtoken_" + "x".repeat(35) // 43 ký tự, đúng dạng token G

const FOREIGN_TEXTS = ["Người Lạ GV2", "Môn Lạ GV2", "Ca Lạ GV2", "Tiền Lạ GV2"]

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
  let normalSessionId: number
  let cancelledSessionId: number
  let makeupSessionId: number
  let paymentId: number

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

    const stranger = await b.student.create({ fullName: "Người Lạ GV2", grade: 4, tuitionFee: 90000 })
    await b.subject.create({ name: "Môn Lạ GV2" })

    if (HAS_PARENT_TOKEN) {
      await db.$executeRaw`UPDATE "students" SET "parent_link_token" = ${PARENT_TOKEN} WHERE "id" = ${anId}`
    }

    const [english] = await a.subject.list({ isActive: true })
    const normal = await a.session.create({
      sessionDate: "2026-05-04", startTime: "17:00", endTime: "18:30",
      subjectId: english.id, title: "Lớp 3", studentIds: [anId],
    })
    normalSessionId = normal.id
    await a.attendance.update({ sessionId: normal.id, attendances: [{ studentId: anId, attendance: "present" }] })

    const orig = await a.session.create({
      sessionDate: "2026-05-05", startTime: "17:00", endTime: "18:30",
      subjectId: english.id, studentIds: [anId],
    })
    const { makeup } = await a.session.createMakeup({
      id: orig.id, sessionDate: "2026-05-07", startTime: "17:00", endTime: "18:30", cancelReason: "Nghỉ ốm",
    })
    cancelledSessionId = orig.id
    makeupSessionId = makeup.id

    await a.payment.create({
      studentId: anId, year: 2026, month: 5, amount: 150000,
      paidAt: "2026-05-10", method: "transfer", note: "CK tháng 5",
    })
    paymentId = (await db.payment.findFirstOrThrow({
      where: { monthlyTuition: { studentId: anId } }, select: { id: true },
    })).id

    await db.classUpgradeLog.create({
      data: { userId: teacherId, year: 2026, trigger: "manual", upgradedCount: 2, deactivatedCount: 1 },
    })

    const [english2] = await b.subject.list({ isActive: true })
    await b.session.create({
      sessionDate: "2026-05-04", startTime: "08:00", endTime: "09:00",
      subjectId: english2.id, title: "Ca Lạ GV2", studentIds: [stranger.id],
    })
    await b.payment.create({
      studentId: stranger.id, year: 2026, month: 5, amount: 90000,
      paidAt: "2026-05-11", method: "cash", note: "Tiền Lạ GV2",
    })
  })

  it("đủ sheet đúng thứ tự, dòng 1 đúng tiêu đề", async () => {
    const wb = await loadBackup(teacherId)
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(["Thông tin", ...DATA_SHEETS, "Cài đặt"])
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
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(["Thông tin", ...DATA_SHEETS, "Cài đặt"])
    for (const name of DATA_SHEETS) {
      expect(sheet(wb, name).actualRowCount, name).toBe(1)
      expect(infoValue(wb, `Số dòng: ${name}`), name).toBe(0)
    }
  })

  it("Ca dạy: ngày là ô Date dd/mm/yyyy, giờ HH:mm, nhãn trạng thái, ca bù trỏ ca gốc", async () => {
    const ws = sheet(await loadBackup(teacherId), "Ca dạy")

    const day = cellOf(ws, normalSessionId, "Ngày")
    expect(day.value).toBeInstanceOf(Date)
    expect((day.value as Date).toISOString()).toBe("2026-05-04T00:00:00.000Z")
    expect(day.numFmt).toBe("dd/mm/yyyy")
    expect(cellOf(ws, normalSessionId, "Thứ").value).toBe("T2")
    expect(cellOf(ws, normalSessionId, "Bắt đầu").value).toBe("17:00")
    expect(cellOf(ws, normalSessionId, "Kết thúc").value).toBe("18:30")
    expect(cellOf(ws, normalSessionId, "Môn").value).toBe("Tiếng Anh")
    expect(cellOf(ws, normalSessionId, "Trạng thái").value).toBe("Đã lên lịch")
    expect(cellOf(ws, normalSessionId, "Số học sinh").value).toBe(1)
    expect(cellOf(ws, normalSessionId, "Bù cho ca (ID)").value).toBeNull()

    expect(cellOf(ws, cancelledSessionId, "Trạng thái").value).toBe("Đã hủy")
    expect(cellOf(ws, cancelledSessionId, "Lý do hủy").value).toBe("Nghỉ ốm")
    const cancelledAt = cellOf(ws, cancelledSessionId, "Thời điểm hủy")
    expect(cancelledAt.value).toBeInstanceOf(Date)
    expect(cancelledAt.numFmt).toBe("dd/mm/yyyy hh:mm")

    expect(cellOf(ws, makeupSessionId, "Bù cho ca (ID)").value).toBe(cancelledSessionId)
  })

  it("Điểm danh: nhãn Có mặt, học phí buổi là số nguyên, ngày ca là Date", async () => {
    const ws = sheet(await loadBackup(teacherId), "Điểm danh")
    const ss = await db.sessionStudent.findFirstOrThrow({ where: { sessionId: normalSessionId, studentId: anId } })
    expect(cellOf(ws, ss.id, "Điểm danh").value).toBe("Có mặt")
    expect(cellOf(ws, ss.id, "Học phí buổi").value).toBe(150000)
    expect(cellOf(ws, ss.id, "Học phí buổi").numFmt).toBe("#,##0")
    expect(cellOf(ws, ss.id, "Lớp lúc học").value).toBe(3)
    expect(cellOf(ws, ss.id, "Học sinh").value).toBe("An Sao Lưu")
    expect((cellOf(ws, ss.id, "Ngày ca").value as Date).toISOString()).toBe("2026-05-04T00:00:00.000Z")
  })

  it("Học phí tháng: xuất nguyên dạng đang lưu, tiền là số nguyên", async () => {
    const ws = sheet(await loadBackup(teacherId), "Học phí tháng")
    const mt = await db.monthlyTuition.findUniqueOrThrow({
      where: { studentId_year_month: { studentId: anId, year: 2026, month: 5 } },
    })
    expect(cellOf(ws, mt.id, "Đã trả").value).toBe(mt.paidAmount)
    expect(cellOf(ws, mt.id, "Tổng phải đóng").value).toBe(mt.totalAmountDue)
    expect(Number.isInteger(cellOf(ws, mt.id, "Tổng phải đóng").value)).toBe(true)
    expect(cellOf(ws, mt.id, "Đã tất toán").value).toBe(mt.isFullPaid ? "Có" : "Không")
  })

  it("Lần thu: nhãn Chuyển khoản, ngày thu Date, số tiền nguyên, năm/tháng từ học phí tháng", async () => {
    const ws = sheet(await loadBackup(teacherId), "Lần thu")
    expect(cellOf(ws, paymentId, "Hình thức").value).toBe("Chuyển khoản")
    expect(cellOf(ws, paymentId, "Số tiền").value).toBe(150000)
    const paidAt = cellOf(ws, paymentId, "Ngày thu")
    expect((paidAt.value as Date).toISOString()).toBe("2026-05-10T00:00:00.000Z")
    expect(paidAt.numFmt).toBe("dd/mm/yyyy")
    expect(cellOf(ws, paymentId, "ID học sinh").value).toBe(anId)
    expect(cellOf(ws, paymentId, "Năm").value).toBe(2026)
    expect(cellOf(ws, paymentId, "Tháng").value).toBe(5)
    expect(cellOf(ws, paymentId, "Ghi chú").value).toBe("CK tháng 5")
  })

  it("Lịch sử lên lớp: nhãn Thủ công, thời điểm chạy là mốc giờ VN", async () => {
    const ws = sheet(await loadBackup(teacherId), "Lịch sử lên lớp")
    const log = await db.classUpgradeLog.findFirstOrThrow({ where: { userId: teacherId } })
    expect(cellOf(ws, log.id, "Cách chạy").value).toBe("Thủ công")
    expect(cellOf(ws, log.id, "Năm học").value).toBe(2026)
    const at = cellOf(ws, log.id, "Thời điểm chạy")
    expect((at.value as Date).getTime()).toBe(log.executedAt.getTime() + 7 * 60 * 60 * 1000)
    expect(at.numFmt).toBe("dd/mm/yyyy hh:mm")
  })

  it("Cài đặt: ngân hàng, số tài khoản giữ số 0, tên chủ tài khoản", async () => {
    await db.user.update({
      where: { id: teacherId },
      data: { bankBin: "970436", bankAccountNumber: "0011223344", bankAccountName: "NGUYEN VAN A" },
    })
    const ws = sheet(await loadBackup(teacherId), "Cài đặt")
    const rows = new Map<string, ExcelJS.Cell>()
    for (let r = 2; r <= ws.rowCount; r++) rows.set(String(ws.getRow(r).getCell(1).value), ws.getRow(r).getCell(2))
    expect(rows.get("Ngân hàng")?.value).toBe("Vietcombank")
    expect(rows.get("Số tài khoản")?.value).toBe("0011223344")
    expect(rows.get("Số tài khoản")?.numFmt).toBe("@")
    expect(rows.get("Tên chủ tài khoản")?.value).toBe("NGUYEN VAN A")
  })

  it("Cài đặt: chưa cài ngân hàng thì các ô giá trị để trống", async () => {
    const empty = await db.user.findUniqueOrThrow({ where: { username: "backup_empty" } })
    const ws = sheet(await loadBackup(empty.id), "Cài đặt")
    for (let r = 2; r <= ws.rowCount; r++) expect(ws.getRow(r).getCell(2).value).toBeNull()
  })
})
