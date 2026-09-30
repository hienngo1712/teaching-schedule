import { describe, it, expect } from "vitest"
import { z } from "zod"
import {
  CONSENT_ACCEPTED,
  CONSENT_REQUIRED,
  CONSENT_TEXT_VERSION,
  consentPayload,
  isConsentError,
  updateTouchesPersonalData,
} from "@/lib/consent"

describe("consent (spec O 6.6, bổ sung H2)", () => {
  const schema = z.object({ consent: consentPayload })
  it("chỉ nhận { accepted: true, version hiện hành }; mọi dạng khác báo CONSENT_REQUIRED", () => {
    expect(CONSENT_ACCEPTED).toEqual({ accepted: true, version: CONSENT_TEXT_VERSION })
    expect(schema.safeParse({ consent: CONSENT_ACCEPTED }).success).toBe(true)
    for (const v of [
      {},
      { consent: { accepted: false, version: CONSENT_TEXT_VERSION } },
      { consent: { accepted: true } },
      { consent: { accepted: true, version: "2000-01-v0" } },
    ]) {
      const r = schema.safeParse(v)
      expect(r.success).toBe(false)
      if (!r.success) expect(r.error.issues[0].message).toBe(CONSENT_REQUIRED)
    }
  })

  it("updateTouchesPersonalData: chỉ trường cá nhân mới cần đồng ý", () => {
    expect(updateTouchesPersonalData({ fullName: "A" })).toBe(true)
    expect(updateTouchesPersonalData({ notes: null })).toBe(true)
    expect(updateTouchesPersonalData({})).toBe(false)
    expect(updateTouchesPersonalData({ isActive: false, grade: 3 } as Record<string, unknown>)).toBe(false)
  })

  it("isConsentError nhận cả lỗi zod (JSON) lẫn TRPCError", () => {
    expect(isConsentError({ message: '[{"message":"CONSENT_REQUIRED"}]' })).toBe(true)
    expect(isConsentError({ message: "CONSENT_REQUIRED" })).toBe(true)
    expect(isConsentError({ message: "khác" })).toBe(false)
    expect(isConsentError(null)).toBe(false)
  })
})
