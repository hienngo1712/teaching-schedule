import { describe, it, expect } from "vitest"
import {
  IMPORT_COLUMNS,
  buildPreview,
  cellToText,
  findInFileDuplicates,
  isImportHeader,
  nameKey,
  parseImportRows,
  toImportPayload,
  type ParsedImportRow,
} from "@/lib/student-import"

const row = (rowNumber: number, ...cells: unknown[]) => ({ rowNumber, cells })
const parsed = (
  rowNumber: number,
  fullName: string,
  grade: number,
  errors: ParsedImportRow["errors"] = []
): ParsedImportRow => ({ rowNumber, input: { fullName, grade, tuitionFee: 0 }, errors })

describe("nameKey", () => {
  it("không phân biệt hoa thường, khoảng trắng thừa, NFD/NFC", () => {
    const k = nameKey("Nguyễn Văn An", 5)
    expect(nameKey("  nguyễn   VĂN an ", 5)).toBe(k)
    expect(nameKey("Nguyễn Văn An".normalize("NFD"), 5)).toBe(k)
  })

  it("giữ dấu: An khác Ân; khác lớp khác khóa", () => {
    expect(nameKey("An", 5)).not.toBe(nameKey("Ân", 5))
    expect(nameKey("An", 5)).not.toBe(nameKey("An", 6))
  })
})

describe("cellToText", () => {
  it("số, chuỗi, null, Date", () => {
    expect(cellToText(5)).toBe("5")
    expect(cellToText("  Bình  ")).toBe("Bình")
    expect(cellToText(null)).toBe("")
    expect(cellToText(undefined)).toBe("")
    expect(cellToText(new Date("2026-09-01T00:00:00Z"))).toBe("2026-09-01")
  })

  it("richText, công thức, hyperlink, lỗi công thức", () => {
    expect(cellToText({ richText: [{ text: "Nguyễn " }, { text: "An" }] })).toBe("Nguyễn An")
    expect(cellToText({ formula: "A1+1", result: 5 })).toBe("5")
    expect(cellToText({ formula: "A1" })).toBe("")
    expect(cellToText({ text: "Chị Hoa", hyperlink: "mailto:hoa@x.vn" })).toBe("Chị Hoa")
    expect(cellToText({ error: "#N/A" })).toBe("")
  })
})

describe("isImportHeader", () => {
  it("khớp đúng nhãn mẫu", () => {
    expect(isImportHeader(IMPORT_COLUMNS.map((c) => c.label))).toBe(true)
  })

  it("chấp nhận hoa thường, khoảng trắng, NFD, thiếu dấu *", () => {
    expect(
      isImportHeader([" HỌ TÊN ", "lớp".normalize("NFD"), "Tên phụ huynh", "SĐT  phụ huynh", "Học phí/buổi", "Ghi chú"])
    ).toBe(true)
  })

  it("sai thứ tự hoặc thiếu cột → false", () => {
    expect(isImportHeader(["Lớp*", "Họ tên*", "Tên phụ huynh", "SĐT phụ huynh", "Học phí/buổi", "Ghi chú"])).toBe(false)
    expect(isImportHeader(["Họ tên*", "Lớp*"])).toBe(false)
    expect(isImportHeader([])).toBe(false)
  })
})

describe("parseImportRows", () => {
  it("bỏ dòng rỗng, giữ số dòng thật trong Excel", () => {
    const out = parseImportRows([
      row(2, "Nguyễn An", 5),
      row(3, null, "  ", undefined),
      row(4, "Trần Bình", "Lớp 3"),
    ])
    expect(out.map((r) => r.rowNumber)).toEqual([2, 4])
    expect(out.every((r) => r.errors.length === 0)).toBe(true)
  })

  it("dòng đầy đủ → input chuẩn hóa", () => {
    const [r] = parseImportRows([row(2, "Nguyễn An", 5, "Chị Hoa", "0912 345.678", "150.000", "Yếu toán")])
    expect(r.errors).toEqual([])
    expect(r.input).toEqual({
      fullName: "Nguyễn An",
      grade: 5,
      parentName: "Chị Hoa",
      parentPhone: "0912345678",
      tuitionFee: 150000,
      notes: "Yếu toán",
    })
  })

  it("lớp: 5, '5', 'Lớp 5', 'LỚP 7'", () => {
    const out = parseImportRows([row(2, "An An", 5), row(3, "Bình An", "5"), row(4, "Chi An", "Lớp 5"), row(5, "Dũng An", "LỚP 7")])
    expect(out.map((r) => r.input.grade)).toEqual([5, 5, 5, 7])
  })

  it("SĐT dạng số 9 chữ số → bù 0 đầu; gạch nối bị bỏ", () => {
    const out = parseImportRows([row(2, "An An", 5, null, 912345678), row(3, "Bình An", 5, null, "091-234-5678")])
    expect(out[0].input.parentPhone).toBe("0912345678")
    expect(out[1].input.parentPhone).toBe("0912345678")
    expect(out.every((r) => r.errors.length === 0)).toBe(true)
  })

  it("học phí: '150,000đ', số, rỗng → 0, chữ vô nghĩa → lỗi", () => {
    const out = parseImportRows([
      row(2, "An An", 5, null, null, "150,000đ"),
      row(3, "Bình An", 5, null, null, 200000),
      row(4, "Chi An", 5, null, null, null),
      row(5, "Dũng An", 5, null, null, "abc"),
    ])
    expect(out.map((r) => r.input.tuitionFee).slice(0, 3)).toEqual([150000, 200000, 0])
    expect(out[3].errors).toEqual(["tuitionFee"])
  })

  it("học phí: chuỗi mập mờ ('150k', số âm, 'triệu', số lẻ dấu) → lỗi, không âm thầm nhận", () => {
    const out = parseImportRows([
      row(2, "An An", 5, null, null, "150k"),
      row(3, "Bình An", 5, null, null, -150000),
      row(4, "Chi An", 5, null, null, "1,5 triệu"),
      row(5, "Dũng An", 5, null, null, "150.000,5"),
      row(6, "Em An", 5, null, null, "abc1"),
      row(7, "Giang An", 5, null, null, "150.000 VND"),
    ])
    expect(out.map((r) => r.errors)).toEqual([
      ["tuitionFee"],
      ["tuitionFee"],
      ["tuitionFee"],
      ["tuitionFee"],
      ["tuitionFee"],
      [],
    ])
    expect(out[5].input.tuitionFee).toBe(150000)
  })

  it("lớp 10, lớp 5.5, lớp rỗng → lỗi grade", () => {
    const out = parseImportRows([row(2, "An An", 10), row(3, "Bình An", 5.5), row(4, "Chi An", null, "x")])
    expect(out.map((r) => r.errors)).toEqual([["grade"], ["grade"], ["grade"]])
  })

  it("tên 1 ký tự → lỗi fullName", () => {
    expect(parseImportRows([row(2, "A", 5)])[0].errors).toEqual(["fullName"])
  })

  it("nhiều lỗi 1 dòng → đủ các field, theo thứ tự cột", () => {
    const [r] = parseImportRows([row(2, "A", 12, "x".repeat(101), "123", -5, "y".repeat(1001))])
    expect(r.errors).toEqual(["fullName", "grade", "parentName", "parentPhone", "tuitionFee", "notes"])
  })
})

describe("findInFileDuplicates", () => {
  it("dòng sau cùng khóa dòng trước → trả số dòng trước; dòng lỗi bỏ qua", () => {
    const rows = [
      parsed(2, "Nguyễn An", 5),
      parsed(3, "nguyễn  an", 5),
      parsed(4, "Nguyễn An", 6),
      parsed(5, "Trần Bình", 3, ["parentPhone"]),
      parsed(6, "Trần Bình", 3),
    ]
    expect(findInFileDuplicates(rows)).toEqual([null, 2, null, null, null])
  })
})

describe("buildPreview", () => {
  const existing = { id: 10, fullName: "Nguyễn An", grade: 5, isActive: false }

  it("gắn trạng thái và xếp lỗi → trùng → hợp lệ", () => {
    const rows = [
      parsed(2, "Trần Bình", 3),
      parsed(3, "Nguyễn An", 5),
      parsed(4, "Lê Chi", 12, ["grade"]),
      parsed(5, "trần bình", 3),
    ]
    // matches theo thứ tự các dòng không lỗi: 2, 3, 5
    const out = buildPreview(rows, [null, existing, null])
    expect(out.map((r) => [r.rowNumber, r.status])).toEqual([
      [4, "error"],
      [3, "duplicate"],
      [5, "duplicate"],
      [2, "ok"],
    ])
    expect(out[1].existing).toEqual(existing)
    expect(out[2]).toMatchObject({ existing: null, sameAsRow: 2 })
  })

  it("vừa trùng DB vừa trùng trong file → ưu tiên lý do DB", () => {
    const rows = [parsed(2, "Nguyễn An", 5), parsed(3, "Nguyễn An", 5)]
    const out = buildPreview(rows, [existing, existing])
    expect(out.every((r) => r.status === "duplicate" && r.existing?.id === 10)).toBe(true)
  })
})

describe("toImportPayload", () => {
  it("gồm dòng hợp lệ + dòng trùng đã tick, theo thứ tự dòng trong file", () => {
    const rows = [parsed(2, "Trần Bình", 3), parsed(3, "Nguyễn An", 5), parsed(4, "Lê Chi", 12, ["grade"]), parsed(5, "trần bình", 3)]
    const preview = buildPreview(rows, [null, { id: 10, fullName: "Nguyễn An", grade: 5, isActive: true }, null])

    expect(toImportPayload(preview, new Set()).map((r) => r.fullName)).toEqual(["Trần Bình"])

    const payload = toImportPayload(preview, new Set([3, 5]))
    expect(payload.map((r) => [r.fullName, r.allowDuplicate])).toEqual([
      ["Trần Bình", false],
      ["Nguyễn An", true],
      ["trần bình", true],
    ])
  })
})
