import { describe, it, expect } from "vitest"
import ExcelJS from "exceljs"
import { IMPORT_COLUMNS, MAX_IMPORT_FILE_BYTES, MAX_IMPORT_ROWS } from "@/lib/student-import"
import { buildImportTemplate, readImportWorkbook } from "@/lib/student-import-excel"

const HEADER = IMPORT_COLUMNS.map((c) => c.label)

async function makeFile(fill: (sheet: ExcelJS.Worksheet) => void): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  fill(wb.addWorksheet("Hoc sinh"))
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}

describe("readImportWorkbook", () => {
  it("đọc dòng dữ liệu, giữ số dòng thật, bỏ dòng trống ở giữa", async () => {
    const data = await makeFile((s) => {
      s.getRow(1).values = HEADER
      s.getRow(2).values = ["Nguyễn An", 5, "Chị Hoa", 912345678, 150000, "Yếu toán"]
      s.getRow(4).values = ["Trần Bình", "Lớp 3"]
    })
    const res = await readImportWorkbook(data)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.rows.map((r) => r.rowNumber)).toEqual([2, 4])
    expect(res.rows[0].input).toMatchObject({ fullName: "Nguyễn An", grade: 5, parentPhone: "0912345678", tuitionFee: 150000 })
    expect(res.rows[1].input.grade).toBe(3)
  })

  it("file không phải xlsx → file", async () => {
    const data = new TextEncoder().encode("không phải file zip").buffer as ArrayBuffer
    expect(await readImportWorkbook(data)).toEqual({ ok: false, error: "file" })
  })

  it("quá 2MB → size (không cần đọc)", async () => {
    expect(await readImportWorkbook(new ArrayBuffer(MAX_IMPORT_FILE_BYTES + 1))).toEqual({ ok: false, error: "size" })
  })

  it("tiêu đề sai mẫu → template", async () => {
    const data = await makeFile((s) => {
      s.getRow(1).values = ["Tên", "Lớp", "SĐT"]
      s.getRow(2).values = ["Nguyễn An", 5]
    })
    expect(await readImportWorkbook(data)).toEqual({ ok: false, error: "template" })
  })

  it("chỉ có tiêu đề → empty", async () => {
    const data = await makeFile((s) => {
      s.getRow(1).values = HEADER
    })
    expect(await readImportWorkbook(data)).toEqual({ ok: false, error: "empty" })
  })

  it(`quá ${MAX_IMPORT_ROWS} dòng → too_many`, async () => {
    const data = await makeFile((s) => {
      s.getRow(1).values = HEADER
      for (let i = 0; i <= MAX_IMPORT_ROWS; i++) s.addRow([`Học sinh ${i}`, 1])
    })
    expect(await readImportWorkbook(data)).toEqual({ ok: false, error: "too_many" })
  })
})

describe("buildImportTemplate", () => {
  it("2 sheet, tiêu đề 6 cột đúng thứ tự, không có dòng ví dụ", async () => {
    const buf = await buildImportTemplate()
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    expect(wb.worksheets.map((s) => s.name)).toEqual(["Hoc sinh", "Huong dan"])
    const sheet = wb.getWorksheet("Hoc sinh")!
    expect((sheet.getRow(1).values as unknown[]).slice(1)).toEqual(HEADER)
    expect(sheet.getRow(1).getCell(1).font?.bold).toBe(true)
    expect(sheet.actualRowCount).toBe(1)
  })

  it("đọc lại chính file mẫu → hợp lệ nhưng chưa có dòng (empty)", async () => {
    expect(await readImportWorkbook(await buildImportTemplate())).toEqual({ ok: false, error: "empty" })
  })

  it("sheet hướng dẫn ghi lớp 1 đến 12", async () => {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await buildImportTemplate())
    const guide = wb.getWorksheet("Huong dan")!
    expect(guide.getRow(3).getCell(1).value).toBe("Lớp")
    expect(guide.getRow(3).getCell(3).value).toBe('Số từ 1 đến 12 (ghi "Lớp 5" cũng được)')
  })
})
