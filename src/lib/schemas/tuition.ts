import { z } from "zod"
import { paginationSchema } from "./common"

export const monthlyTuitionFilterSchema = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  grade: z.number().int().min(1).max(12).optional(),
  search: z.string().optional(),
  studentId: z.number().int().positive().optional(),
  status: z.enum(["all", "fully_paid", "paid_this_month", "partial", "unpaid"]).optional(),
  noticeFilter: z.enum(["all", "unsent", "sent"]).optional(),
}).merge(paginationSchema)

export type MonthlyTuitionFilterInput = z.infer<typeof monthlyTuitionFilterSchema>

export const updateSettlementSchema = z.object({
  studentId: z.number().int().positive(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  // Gửi riêng từng trường (spec Y §5): ghi chú tự lưu và nút miễn không được ghi đè nhau bằng dữ liệu cũ.
  isFullPaid: z.boolean().optional(),
  notes: z.string().optional().nullable(),
})

export type UpdateSettlementInput = z.infer<typeof updateSettlementSchema>

export const tuitionNoticeSchema = z.object({
  studentId: z.number().int().positive(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
})

export type TuitionNoticeInput = z.infer<typeof tuitionNoticeSchema>

export const setNoticeSentSchema = z.object({
  studentId: z.number().int().positive(),
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  sent: z.boolean(),
})

export type SetNoticeSentInput = z.infer<typeof setNoticeSentSchema>
