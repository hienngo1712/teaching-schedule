import { z } from "zod"

const dateRegex = /^\d{4}-\d{2}-\d{2}$/
const timeRegex = /^\d{2}:\d{2}$/

export const sessionCreateSchema = z
  .object({
    sessionDate: z.string().regex(dateRegex, "Ngày phải dạng YYYY-MM-DD"),
    startTime: z.string().regex(timeRegex, "Giờ phải dạng HH:mm"),
    endTime: z.string().regex(timeRegex, "Giờ phải dạng HH:mm"),
    subjectId: z.number().int().positive(),
    title: z.string().max(200).optional(),
    notes: z.string().max(1000).optional(),
    studentIds: z.array(z.number().int().positive()).optional(),
  })
  .refine((d) => d.endTime > d.startTime, {
    message: "Giờ kết thúc phải sau giờ bắt đầu",
    path: ["endTime"],
  })

export const sessionUpdateSchema = z.object({
  id: z.number().int().positive(),
  data: z
    .object({
      sessionDate: z.string().regex(dateRegex).optional(),
      startTime: z.string().regex(timeRegex).optional(),
      endTime: z.string().regex(timeRegex).optional(),
      subjectId: z.number().int().positive().optional(),
      title: z.string().max(200).optional(),
      notes: z.string().max(1000).optional(),
      studentIds: z.array(z.number().int().positive()).optional(),
    })
    .refine(
      (d) =>
        d.startTime === undefined ||
        d.endTime === undefined ||
        d.endTime > d.startTime,
      { message: "Giờ kết thúc phải sau giờ bắt đầu", path: ["endTime"] }
    ),
})

export const sessionFilterSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  grade: z.number().int().min(1).max(9).optional(),
  studentName: z.string().trim().max(100).optional(),
  studentId: z.number().int().positive().optional(),
})

export const sessionBulkCreateSchema = z
  .object({
    startDate: z.string().regex(dateRegex),
    endDate: z.string().regex(dateRegex),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1),
    startTime: z.string().regex(timeRegex),
    endTime: z.string().regex(timeRegex),
    subjectId: z.number().int().positive(),
    title: z.string().max(200).optional(),
    notes: z.string().max(1000).optional(),
    studentIds: z.array(z.number().int().positive()).optional(),
  })
  .refine((d) => d.endTime > d.startTime, {
    message: "Giờ kết thúc phải sau giờ bắt đầu",
    path: ["endTime"],
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "Ngày kết thúc phải sau ngày bắt đầu",
    path: ["endDate"],
  })

export const sessionBulkDeleteFutureSchema = z.object({
  id: z.number().int().positive(),
})

export const sessionBulkUpdateFutureSchema = z.object({
  id: z.number().int().positive(),
  data: z
    .object({
      startTime: z.string().regex(timeRegex).optional(),
      endTime: z.string().regex(timeRegex).optional(),
      subjectId: z.number().int().positive().optional(),
      title: z.string().max(200).optional(),
      notes: z.string().max(1000).optional(),
      studentIds: z.array(z.number().int().positive()).optional(),
    })
    .refine(
      (d) =>
        d.startTime === undefined ||
        d.endTime === undefined ||
        d.endTime > d.startTime,
      { message: "Giờ kết thúc phải sau giờ bắt đầu", path: ["endTime"] }
    ),
})

export type SessionCreateInput = z.infer<typeof sessionCreateSchema>
export type SessionUpdateInput = z.infer<typeof sessionUpdateSchema>
export type SessionFilterInput = z.infer<typeof sessionFilterSchema>
export type SessionBulkCreateInput = z.infer<typeof sessionBulkCreateSchema>
export type SessionBulkDeleteFutureInput = z.infer<typeof sessionBulkDeleteFutureSchema>
export type SessionBulkUpdateFutureInput = z.infer<typeof sessionBulkUpdateFutureSchema>
