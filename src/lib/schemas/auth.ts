import { z } from "zod"

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(10, "Mật khẩu mới phải có ít nhất 10 ký tự")
    .max(200),
})

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
