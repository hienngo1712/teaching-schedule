import { z } from "zod"

const FB_HOSTS = ["facebook.com", "www.facebook.com", "m.facebook.com", "fb.com"]

export const contactInputSchema = z.object({
  phone: z
    .string()
    .transform((s) => s.replace(/[\s.]/g, ""))
    .refine((s) => /^0\d{8,10}$/.test(s), { message: "Số điện thoại từ 9 đến 11 chữ số, bắt đầu bằng 0" }),
  facebookUrl: z
    .string()
    .trim()
    .transform((s) => (s === "" ? null : s))
    .refine((s) => {
      if (s === null) return true
      try {
        const u = new URL(s)
        return u.protocol === "https:" && FB_HOSTS.includes(u.hostname)
      } catch {
        return false
      }
    }, { message: "Link Facebook phải bắt đầu bằng https://facebook.com/" }),
})
export type ContactInput = z.infer<typeof contactInputSchema>
