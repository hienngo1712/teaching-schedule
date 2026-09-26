// VietQR (NAPAS) theo chuẩn EMVCo MPM. Thuần: dùng được ở server lẫn client.

export function crc16Ccitt(s: string): string {
  // CRC-16/CCITT-FALSE: đa thức 0x1021, khởi tạo 0xFFFF, không đảo bit, không XOR cuối.
  let crc = 0xffff
  for (const byte of new TextEncoder().encode(s)) {
    crc ^= byte << 8
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0")
}

export function tlv(id: string, value: string): string {
  if (value.length > 99) throw new Error(`Trường ${id} dài quá 99 ký tự`)
  return id + String(value.length).padStart(2, "0") + value
}

const NAPAS_GUID = "A000000727"
// Chuyển nhanh 24/7 tới số tài khoản (QRIBFTTC là tới số thẻ).
const SERVICE_TO_ACCOUNT = "QRIBFTTA"
// Giới hạn an toàn cho nội dung CK ở mọi ngân hàng (spec C S7).
const MAX_CONTENT_LENGTH = 25

export function buildTransferContent(fullName: string, month: number): string {
  // "đ/Đ" không tách được bằng NFD nên phải đổi riêng.
  return `HP T${month} ${fullName}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CONTENT_LENGTH)
    .trimEnd()
}

export function buildVietQrPayload(input: {
  bin: string
  accountNumber: string
  amount: number
  content: string
}): string {
  if (!Number.isInteger(input.amount) || input.amount < 1) {
    throw new Error("Số tiền phải là số nguyên dương")
  }
  const merchant =
    tlv("00", NAPAS_GUID) +
    tlv("01", tlv("00", input.bin) + tlv("01", input.accountNumber)) +
    tlv("02", SERVICE_TO_ACCOUNT)
  // Không đưa tag 59/60 (tên/thành phố): app ngân hàng tự tra tên chủ TK (spec C S6).
  const body =
    tlv("00", "01") +
    tlv("01", "12") +
    tlv("38", merchant) +
    tlv("53", "704") +
    tlv("54", String(input.amount)) +
    tlv("58", "VN") +
    tlv("62", tlv("08", input.content)) +
    "6304"
  // CRC tính trên toàn chuỗi, kể cả "6304".
  return body + crc16Ccitt(body)
}
