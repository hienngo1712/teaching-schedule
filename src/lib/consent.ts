import { z } from "zod"

// Đổi câu chữ ô đồng ý hoặc trang /privacy thì tăng version (bằng chứng ghi version đã hiện).
export const CONSENT_TEXT_VERSION = "2026-10-v1"
export const CONSENT_SCOPES = ["register", "bank_account", "student", "student_import"] as const
export type ConsentScope = (typeof CONSENT_SCOPES)[number]
export const STUDENT_PERSONAL_FIELDS = ["fullName", "parentName", "parentPhone", "notes"] as const
export const CONSENT_REQUIRED = "CONSENT_REQUIRED"

const required = { errorMap: () => ({ message: CONSENT_REQUIRED }) }
// Key đồng ý thống nhất gửi kèm payload của đúng API ("extra_data" theo người dùng). Version lệch = tab cũ, bắt tải lại.
export const consentPayload = z
  .object({ accepted: z.literal(true, required), version: z.string(required) }, required)
  .refine((c) => c.version === CONSENT_TEXT_VERSION, { message: CONSENT_REQUIRED })
export type ConsentPayload = z.infer<typeof consentPayload>
export const CONSENT_ACCEPTED: ConsentPayload = { accepted: true, version: CONSENT_TEXT_VERSION }

export function updateTouchesPersonalData(
  data: Partial<Record<(typeof STUDENT_PERSONAL_FIELDS)[number], unknown>>
): boolean {
  return STUDENT_PERSONAL_FIELDS.some((f) => data[f] !== undefined)
}

// Lỗi zod của tRPC có message là JSON issues → so chứa chuỗi.
export function isConsentError(e: { message?: string } | null | undefined): boolean {
  return !!e?.message?.includes(CONSENT_REQUIRED)
}
