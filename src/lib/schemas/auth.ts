import { z } from "zod"

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

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type RegisterInput = z.infer<typeof registerSchema>
