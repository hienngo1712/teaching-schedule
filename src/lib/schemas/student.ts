import { z } from "zod"

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
})

export const studentUpdateSchema = z.object({
  id: z.number().int().positive(),
  data: studentCreateSchema.partial(),
})

export const studentFilterSchema = z.object({
  grade: z.number().int().min(1).max(9).optional(),
  search: z.string().trim().max(100).optional(),
  isActive: z.boolean().optional(),
})

export type StudentCreateInput = z.infer<typeof studentCreateSchema>
export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>
export type StudentFilterInput = z.infer<typeof studentFilterSchema>
