import { z } from "zod"
import { paginationSchema } from "./common"

const phoneRegex = /^(0|\+84)[0-9]{8,9}$/

import { consentPayload } from "@/lib/consent"

export const studentCreateSchema = z.object({
  fullName: z.string().trim().min(2, "Tên phải có ít nhất 2 ký tự").max(100),
  grade: z.number().int().min(1).max(12),
  parentPhone: z
    .string()
    .trim()
    .regex(phoneRegex, "Số điện thoại không hợp lệ")
    .or(z.literal(""))
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  parentName: z.string().trim().max(100).optional(),
  notes: z.string().max(1000).optional(),
  isActive: z.boolean().default(true),
  tuitionFee: z.number().int().min(0).default(0),
  billingMode: z.enum(["per_session", "monthly"]).default("per_session"),
  monthlyFee: z.number().int().min(0).default(0),
})

// Form dùng studentCreateSchema (không có cờ); input tRPC bắt buộc cờ đồng ý (spec O Q10).
export const studentFormSchema = studentCreateSchema.refine(
  (v) => v.billingMode !== "monthly" || (v.monthlyFee ?? 0) > 0,
  { path: ["monthlyFee"], message: "Học phí tháng phải lớn hơn 0" }
)

export const studentCreateInputSchema = studentCreateSchema.extend({ consent: consentPayload })

export const studentUpdateSchema = z.object({
  id: z.number().int().positive(),
  data: studentCreateSchema.partial(),
  consent: consentPayload.optional(),
})

export const studentFilterSchema = z.object({
  grade: z.number().int().min(1).max(12).optional(),
  search: z.string().trim().max(100).optional(),
  isActive: z.boolean().optional(),
  // When true, return both active and inactive students (overrides the
  // default active-only behavior). Used by the "all students" view.
  includeInactive: z.boolean().optional(),
}).merge(paginationSchema)

// Giới hạn 500 dòng (spec E D2); không import MAX_IMPORT_ROWS vì student-import.ts import file này.
export const studentImportCheckSchema = z.object({
  rows: z.array(z.object({ fullName: z.string().max(100), grade: z.number().int() })).max(500),
})

// 1 dòng sai → Zod từ chối cả request: đúng "tất cả hoặc không".
export const studentImportSchema = z.object({
  consent: consentPayload,
  rows: z
    .array(studentCreateSchema.omit({ isActive: true }).extend({ allowDuplicate: z.boolean().default(false) }))
    .min(1)
    .max(500),
})

export type StudentCreateInput = z.infer<typeof studentCreateSchema>
export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>
export type StudentFilterInput = z.infer<typeof studentFilterSchema>
export type StudentImportCheckInput = z.infer<typeof studentImportCheckSchema>
export type StudentImportInput = z.infer<typeof studentImportSchema>
