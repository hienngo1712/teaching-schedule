import { z } from "zod"
import { PERIODS, PLANS } from "@/lib/plans"
import { rangeError } from "@/lib/revenue"

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

// Tiền lấy từ bảng giá DB ở server; expectedAmount chỉ để phát hiện giá vừa đổi, không bao giờ dùng làm số tiền (spec L Q6, I 6.4).
// Tùy chọn để tab còn JS cũ lúc deploy vẫn tạo đơn được theo giá mới.
export const createOrderSchema = z.object({
  plan: z.enum(["plus", "pro"]),
  period: z.enum(PERIODS),
  expectedAmount: z.number().int().positive().optional(),
})

// Giá lẻ được phép (người dùng chốt Q12); khoảng chỉ để chặn gõ thừa/thiếu số 0. ×20 tối đa 20 triệu vẫn vừa Int.
export const monthPriceSchema = z.number().int().min(10000).max(1000000)

export const updatePricesSchema = z
  .object({
    prices: z.object({ plus: monthPriceSchema, pro: monthPriceSchema }),
    // Giá admin đang thấy, để phát hiện bảng giá vừa đổi ở tab khác; không giới hạn khoảng.
    expected: z.object({ plus: z.number().int(), pro: z.number().int() }),
  })
  // D7 (quy đổi, chặn Plus khi còn Pro) giả định Pro đắt hơn (spec L Q13).
  .refine((d) => d.prices.pro > d.prices.plus, { message: "Giá Pro phải cao hơn giá Plus", path: ["prices", "pro"] })

// Mặc định cho tài khoản đăng ký sau, 0 = không dùng thử (spec L mục 15 T1).
export const trialDaysSchema = z.number().int().min(0).max(365)
// Đặt riêng tính từ ngày tạo tài khoản nên tài khoản cũ cần số lớn hơn 365.
export const userTrialDaysSchema = z.number().int().min(0).max(3650)

export const updateTrialDaysSchema = z.object({ days: trialDaysSchema, expected: z.number().int() })
export const userIdSchema = z.object({ userId: z.number().int().positive() })
export const setUserTrialSchema = userIdSchema.extend({ days: userTrialDaysSchema })

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
export type UpdatePricesInput = z.infer<typeof updatePricesSchema>
export type UpdateTrialDaysInput = z.infer<typeof updateTrialDaysSchema>
export type SetUserTrialInput = z.infer<typeof setUserTrialSchema>

const yearMonthSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
})
export const revenueQuerySchema = z
  .object({ from: yearMonthSchema, to: yearMonthSchema })
  .refine((d) => rangeError(d.from, d.to) !== "order", { message: "Tháng kết thúc phải sau tháng bắt đầu", path: ["to"] })
  .refine((d) => rangeError(d.from, d.to) !== "too_long", { message: "Tối đa 36 tháng", path: ["to"] })
export type RevenueQueryInput = z.infer<typeof revenueQuerySchema>

export const accountTrendSchema = z.object({ days: z.union([z.literal(7), z.literal(14), z.literal(30)]) })

export const markAccountsSeenSchema = z.union([
  z.object({ userIds: z.array(z.number().int().positive()).min(1).max(200) }),
  z.object({ all: z.literal(true) }),
])
export type MarkAccountsSeenInput = z.infer<typeof markAccountsSeenSchema>

