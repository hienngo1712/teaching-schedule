import { z } from "zod"
import { VN_BANKS } from "@/lib/vn-banks"

export const bankAccountSchema = z.object({
  bankBin: z
    .string()
    .refine((bin) => VN_BANKS.some((b) => b.bin === bin), "Ngân hàng không hợp lệ"),
  bankAccountNumber: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{4,19}$/, "Số tài khoản chỉ gồm 4 đến 19 chữ hoặc số, không dấu cách"),
  bankAccountName: z
    .string()
    .trim()
    .min(1, "Nhập tên chủ tài khoản")
    .max(50, "Tên chủ tài khoản tối đa 50 ký tự"),
})

// null = xoá thông tin ngân hàng
export const updateBankAccountSchema = bankAccountSchema.nullable()

export type BankAccountInput = z.infer<typeof bankAccountSchema>
