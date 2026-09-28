import { z } from "zod"

export const TRASH_TYPES = ["session", "student", "payment", "subject"] as const
export type TrashType = (typeof TRASH_TYPES)[number]

export const trashListSchema = z.object({
  type: z.enum(TRASH_TYPES),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
})
export type TrashListInput = z.infer<typeof trashListSchema>

export const trashRestoreSchema = z.object({
  type: z.enum(TRASH_TYPES),
  id: z.number().int().positive(),
})
export type TrashRestoreInput = z.infer<typeof trashRestoreSchema>

export const trashPurgeSchema = z.object({ type: z.enum(TRASH_TYPES) })
export type TrashPurgeInput = z.infer<typeof trashPurgeSchema>

