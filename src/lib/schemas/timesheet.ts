import { z } from "zod"

const year = z.number().int().min(2000).max(2100)
const month = z.number().int().min(1).max(12)
const placeId = z.number().int().positive()

export const RATE_UNITS = ["session", "hour"] as const

export const monthInputSchema = z.object({ year, month })
export const timesheetMonthSchema = z.object({ placeId: placeId.optional(), year, month })
export const incomeDetailSchema = z.object({ placeId, year, month })

// amount 0 = bỏ đơn giá (coi như chưa có).
export const placeRateSetSchema = z.object({
  placeId,
  unit: z.enum(RATE_UNITS),
  amount: z.number().int().min(0).max(1_000_000_000),
  fromYear: year,
  fromMonth: month,
})

export const placePaymentCreateSchema = z.object({
  placeId,
  year,
  month,
  amount: z.number().int().positive().max(1_000_000_000),
  receivedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(500).optional(),
})

export type PlaceRateSetInput = z.infer<typeof placeRateSetSchema>
export type PlacePaymentCreateInput = z.infer<typeof placePaymentCreateSchema>
