import { z } from "zod"

export const PAYMENT_METHODS = ["cash", "transfer"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

// Cùng quy ước "YYYY-MM-DD" với sessionDate; regex không chặn được ngày không có thật (2026-13-01).
const paidAtSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải dạng YYYY-MM-DD")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00.000Z`)
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
  }, "Ngày không hợp lệ")

// undefined giữ nguyên (update không đụng ghi chú); rỗng sau trim → null.
const noteSchema = z
  .string()
  .trim()
  .max(500, "Ghi chú tối đa 500 ký tự")
  .nullable()
  .optional()
  .transform((v) => (v === "" ? null : v))

const monthKey = {
  studentId: z.number().int().positive(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
}

// Chặn trên để không tràn INTEGER Postgres (2,147,483,647) → 500.
const amountSchema = z.number().int().min(1, "Số tiền phải lớn hơn 0").max(1_000_000_000, "Số tiền tối đa 1.000.000.000")

export const paymentCreateSchema = z.object({
  ...monthKey,
  amount: amountSchema,
  paidAt: paidAtSchema,
  method: z.enum(PAYMENT_METHODS),
  note: noteSchema,
})

export const paymentUpdateSchema = z.object({
  id: z.number().int().positive(),
  data: z.object({
    amount: amountSchema.optional(),
    paidAt: paidAtSchema.optional(),
    method: z.enum(PAYMENT_METHODS).optional(),
    note: noteSchema,
  }),
})

export const paymentListSchema = z.object(monthKey)
export const paymentDeleteSchema = z.object({ id: z.number().int().positive() })

export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>
export type PaymentUpdateInput = z.infer<typeof paymentUpdateSchema>
export type PaymentUpdateData = PaymentUpdateInput["data"]
export type PaymentListInput = z.infer<typeof paymentListSchema>
