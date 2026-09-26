import { describe, it, expect } from "vitest"
import { buildTransferContent, buildVietQrPayload, crc16Ccitt, tlv } from "@/lib/vietqr"

// Mẫu ở spec C §7.1 (đã tính tay bằng CRC-16/CCITT-FALSE).
const SAMPLE_INPUT = {
  bin: "970436",
  accountNumber: "0011001234567",
  amount: 850000,
  content: "HP T9 Nguyen Van A",
}
const SAMPLE_PAYLOAD =
  "00020101021238570010A00000072701270006970436011300110012345670208QRIBFTTA530370454068500005802VN62220818HP T9 Nguyen Van A63041DD5"

describe("crc16Ccitt", () => {
  it("giá trị kiểm chuẩn CRC-16/CCITT-FALSE", () => {
    expect(crc16Ccitt("123456789")).toBe("29B1")
  })

  it("luôn đủ 4 ký tự hex viết hoa", () => {
    expect(crc16Ccitt("")).toBe("FFFF")
    expect(crc16Ccitt("A")).toMatch(/^[0-9A-F]{4}$/)
  })
})

describe("tlv", () => {
  it("id + độ dài 2 chữ số + giá trị", () => {
    expect(tlv("54", "5000")).toBe("54045000")
    expect(tlv("58", "VN")).toBe("5802VN")
  })

  it("giá trị dài hơn 99 ký tự → ném lỗi", () => {
    expect(() => tlv("08", "x".repeat(100))).toThrow()
  })
})

describe("buildVietQrPayload", () => {
  it("khớp payload mẫu trong spec từng ký tự", () => {
    expect(buildVietQrPayload(SAMPLE_INPUT)).toBe(SAMPLE_PAYLOAD)
  })

  it("đổi số tiền → tag 54 và CRC đổi theo", () => {
    const p = buildVietQrPayload({ ...SAMPLE_INPUT, amount: 850001 })
    expect(p).toContain("5406850001")
    expect(p.slice(-4)).toBe("E99E")
    expect(p.slice(-4)).toBe(crc16Ccitt(p.slice(0, -4)))
  })

  it("số tiền không nguyên dương → ném lỗi", () => {
    expect(() => buildVietQrPayload({ ...SAMPLE_INPUT, amount: 0 })).toThrow()
    expect(() => buildVietQrPayload({ ...SAMPLE_INPUT, amount: 1.5 })).toThrow()
  })
})

describe("buildTransferContent", () => {
  it("bỏ dấu, đổi Đ/đ", () => {
    expect(buildTransferContent("Nguyễn Văn Đạt", 9)).toBe("HP T9 Nguyen Van Dat")
    expect(buildTransferContent("Nguyễn Thị Hường", 10)).toBe("HP T10 Nguyen Thi Huong")
  })

  it("tên rất dài → tối đa 25 ký tự, chỉ [A-Za-z0-9 ]", () => {
    const c = buildTransferContent("Tôn Nữ Hoàng Thị Phương Thảo Nguyên", 12)
    expect(c).toBe("HP T12 Ton Nu Hoang Thi P")
    expect(c.length).toBeLessThanOrEqual(25)
    expect(c).toMatch(/^[A-Za-z0-9 ]+$/)
  })

  it("cắt trúng dấu cách → không để khoảng trắng cuối", () => {
    // "HP T12 Nguyen Thi Huongg " dài đúng 25 ký tự, ký tự cuối là dấu cách
    expect(buildTransferContent("Nguyen Thi Huongg Xuan", 12)).toBe("HP T12 Nguyen Thi Huongg")
  })

  it("ký tự đặc biệt và khoảng trắng thừa bị lọc/gộp", () => {
    expect(buildTransferContent("  Lê  O'Neil (Bin) ", 3)).toBe("HP T3 Le ONeil Bin")
  })
})
