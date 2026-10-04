import { z } from "zod"
import { consentPayload } from "@/lib/consent"

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(10, "Mật khẩu mới phải có ít nhất 10 ký tự")
      .max(200),
  })
  // Spec N R2: không giữ lại mật khẩu tạm admin cấp làm mật khẩu mới.
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "Mật khẩu mới phải khác mật khẩu hiện tại",
    path: ["newPassword"],
  })

export const resetPasswordSchema = z.object({ userId: z.number().int().positive() })

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, "Tên đăng nhập phải có ít nhất 3 ký tự")
    .max(50, "Tên đăng nhập tối đa 50 ký tự")
    .trim()
    .regex(/^[a-zA-Z0-9_]+$/, "Tên đăng nhập chỉ chứa chữ cái, số và dấu gạch dưới"),
  password: z
    .string()
    .min(10, "Mật khẩu phải có ít nhất 10 ký tự")
    .max(200),
  fullName: z.string().max(100).trim().optional().or(z.literal("")),
})

export const registerInputSchema = registerSchema.extend({ consent: consentPayload })

// Chỉ dùng ở form: ô nhập lại kiểm ở client, payload gửi server vẫn là registerSchema (spec X §4).
export function registerFormSchema(mismatchMessage: string) {
  // .and(): phần so khớp chạy độc lập, không chờ các trường khác hợp lệ → bấm 1 lần thấy đủ lỗi.
  return registerSchema
    .extend({ confirmPassword: z.string().min(1, mismatchMessage) })
    .and(
      z
        .object({ password: z.string(), confirmPassword: z.string() })
        .refine((v) => v.password === v.confirmPassword, { message: mismatchMessage, path: ["confirmPassword"] })
    )
}

export type RegisterFormValues = z.infer<ReturnType<typeof registerFormSchema>>

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type RegisterInputSchema = z.infer<typeof registerInputSchema>
