import { z } from "zod"

export const monthlyTuitionFilterSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  grade: z.number().int().min(1).max(9).optional(),
  search: z.string().optional(),
  status: z.enum(["all", "fully_paid", "paid_this_month", "partial", "unpaid"]).optional(),
})

export type MonthlyTuitionFilterInput = z.infer<typeof monthlyTuitionFilterSchema>

export const updatePaymentSchema = z.object({
  studentId: z.number().int().positive(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  paidAmount: z.number().int().min(0),
  isFullPaid: z.boolean(),
  notes: z.string().optional().nullable(),
})

export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>
