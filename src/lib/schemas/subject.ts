import { z } from "zod"

const hexColorRegex = /^#[0-9A-Fa-f]{6}$/

export const subjectCreateSchema = z.object({
  name: z.string().trim().min(1, "Tên môn không được rỗng").max(100),
  color: z
    .string()
    .regex(hexColorRegex, "Màu phải dạng hex 6 ký tự")
    .default("#4F46E5"),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
})

export const subjectUpdateSchema = z.object({
  id: z.number().int().positive(),
  data: subjectCreateSchema.partial(),
})

export const subjectFilterSchema = z.object({
  isActive: z.boolean().optional(),
})

export type SubjectCreateInput = z.infer<typeof subjectCreateSchema>
export type SubjectUpdateInput = z.infer<typeof subjectUpdateSchema>
export type SubjectFilterInput = z.infer<typeof subjectFilterSchema>
