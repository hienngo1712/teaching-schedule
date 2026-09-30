import { removeVietnameseTones } from "@/lib/utils"

export type VnBank = {
  bin: string
  shortName: string
  name: string
  aliases?: string[]
}

// BIN theo danh sách NAPAS/VietQR (đối chiếu khi code). Thêm ngân hàng = thêm 1 dòng.
export const VN_BANKS: readonly VnBank[] = [
  { bin: "970436", shortName: "Vietcombank", name: "Ngân hàng TMCP Ngoại thương Việt Nam", aliases: ["vcb"] },
  { bin: "970415", shortName: "VietinBank", name: "Ngân hàng TMCP Công thương Việt Nam", aliases: ["ctg", "vietin"] },
  { bin: "970418", shortName: "BIDV", name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam", aliases: ["bidv"] },
  { bin: "970405", shortName: "Agribank", name: "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam", aliases: ["agri"] },
  { bin: "970407", shortName: "Techcombank", name: "Ngân hàng TMCP Kỹ thương Việt Nam", aliases: ["tcb"] },
  { bin: "970422", shortName: "MB", name: "Ngân hàng TMCP Quân đội", aliases: ["mb", "quan doi"] },
  { bin: "970416", shortName: "ACB", name: "Ngân hàng TMCP Á Châu", aliases: ["acb"] },
  { bin: "970432", shortName: "VPBank", name: "Ngân hàng TMCP Việt Nam Thịnh Vượng", aliases: ["vpb"] },
  { bin: "970423", shortName: "TPBank", name: "Ngân hàng TMCP Tiên Phong", aliases: ["tpb"] },
  { bin: "970403", shortName: "Sacombank", name: "Ngân hàng TMCP Sài Gòn Thương Tín", aliases: ["stb", "sacom"] },
  { bin: "970441", shortName: "VIB", name: "Ngân hàng TMCP Quốc tế Việt Nam", aliases: ["vib"] },
  { bin: "970443", shortName: "SHB", name: "Ngân hàng TMCP Sài Gòn Hà Nội", aliases: ["shb"] },
  { bin: "970437", shortName: "HDBank", name: "Ngân hàng TMCP Phát triển TP. Hồ Chí Minh", aliases: ["hdb"] },
  { bin: "970448", shortName: "OCB", name: "Ngân hàng TMCP Phương Đông", aliases: ["ocb"] },
  { bin: "970426", shortName: "MSB", name: "Ngân hàng TMCP Hàng Hải Việt Nam", aliases: ["msb"] },
  { bin: "970440", shortName: "SeABank", name: "Ngân hàng TMCP Đông Nam Á", aliases: ["seab"] },
  { bin: "970431", shortName: "Eximbank", name: "Ngân hàng TMCP Xuất Nhập khẩu Việt Nam" },
  { bin: "970449", shortName: "LPBank", name: "Ngân hàng TMCP Lộc Phát Việt Nam", aliases: ["lpb"] },
  { bin: "970428", shortName: "Nam A Bank", name: "Ngân hàng TMCP Nam Á" },
  { bin: "970409", shortName: "Bac A Bank", name: "Ngân hàng TMCP Bắc Á" },
  { bin: "970425", shortName: "ABBANK", name: "Ngân hàng TMCP An Bình" },
  { bin: "970412", shortName: "PVcomBank", name: "Ngân hàng TMCP Đại Chúng Việt Nam" },
  { bin: "970452", shortName: "Kienlongbank", name: "Ngân hàng TMCP Kiên Long" },
  { bin: "970454", shortName: "BVBank", name: "Ngân hàng TMCP Bản Việt" },
  { bin: "970419", shortName: "NCB", name: "Ngân hàng TMCP Quốc Dân" },
]

export function findBank(bin: string): VnBank | undefined {
  return VN_BANKS.find((b) => b.bin === bin)
}

const norm = (s: string) => removeVietnameseTones(s).toLowerCase().trim()

// Khớp tên viết tắt/đầy đủ không dấu, bí danh hay gõ (vcb, tcb…) và BIN; bí danh khớp đúng xếp trước.
export function searchBanks(query: string): readonly VnBank[] {
  const q = norm(query)
  if (!q) return VN_BANKS
  const exact = VN_BANKS.filter((b) => b.aliases?.some((a) => norm(a) === q) || norm(b.shortName) === q)
  const rest = VN_BANKS.filter(
    (b) =>
      !exact.includes(b) &&
      (norm(b.shortName).includes(q) ||
        norm(b.name).includes(q) ||
        b.bin.includes(q) ||
        b.aliases?.some((a) => norm(a).includes(q)))
  )
  return [...exact, ...rest]
}
