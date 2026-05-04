import { z } from "zod"

export const attendanceStatusSchema = z.enum(["pending", "present", "absent", "late"])

export const attendanceUpdateSchema = z.object({
  sessionId: z.number().int().positive(),
  attendances: z.array(
    z.object({
      studentId: z.number().int().positive(),
      attendance: attendanceStatusSchema,
      note: z.string().trim().max(500).optional(),
      fee: z.number().int().min(0).optional(),
    })
  ),
})

export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>
export type AttendanceUpdateInput = z.infer<typeof attendanceUpdateSchema>
