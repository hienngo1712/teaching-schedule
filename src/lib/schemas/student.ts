import { z } from "zod"
import { paginationSchema } from "./common"

const phoneRegex = /^(0|\+84)[0-9]{8,9}$/

export const studentCreateSchema = z.object({
  fullName: z.string().trim().min(2, "Tên phải có ít nhất 2 ký tự").max(100),
  grade: z.number().int().min(1).max(9),
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
})

export const studentUpdateSchema = z.object({
  id: z.number().int().positive(),
  data: studentCreateSchema.partial(),
})

export const studentFilterSchema = z.object({
  grade: z.number().int().min(1).max(9).optional(),
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
