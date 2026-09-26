import { z } from "zod"
import { PERIODS, PLANS } from "@/lib/plans"

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

// Không nhận số tiền từ client: tiền lấy từ PLAN_PRICES ở server (spec I 6.4).
export const createOrderSchema = z.object({
  plan: z.enum(["plus", "pro"]),
  period: z.enum(PERIODS),
})

export const orderIdSchema = z.object({ id: z.number().int().positive() })

export const rejectOrderSchema = orderIdSchema.extend({
  note: z.string().trim().max(500).optional(),
})

export const setPlanSchema = z
  .object({
    userId: z.number().int().positive(),
    plan: z.enum(PLANS),
    lastDay: z.string().regex(dateRegex, "Ngày phải dạng YYYY-MM-DD").optional(),
    note: z.string().trim().min(1, "Cần ghi chú").max(500),
  })
  .refine((d) => d.plan === "standard" || d.lastDay !== undefined, {
    message: "Cần ngày dùng cuối",
    path: ["lastDay"],
  })

export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type SetPlanInput = z.infer<typeof setPlanSchema>
