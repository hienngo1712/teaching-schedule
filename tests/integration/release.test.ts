import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller, publicCaller } from "../helpers/trpc"
import { RELEASES } from "@/lib/releases"
import { CONSENT_ACCEPTED } from "@/lib/consent"

const LATEST = RELEASES[0].version
const OLDER = RELEASES[RELEASES.length - 1].version

describe("release router (spec W §5.4)", () => {
  beforeEach(async () => {
    await db.user.update({ where: { username: "teacher" }, data: { lastSeenRelease: null } })
  })

  it("status trả lastSeenRelease của chính mình", async () => {
    const caller = await getAuthedCaller("teacher")
    expect(await caller.release.status()).toEqual({ lastSeenRelease: null })
  })

  it("markSeen ghi version; không lùi khi gửi version cũ hơn", async () => {
    const caller = await getAuthedCaller("teacher")
    expect(await caller.release.markSeen({ version: LATEST })).toEqual({ lastSeenRelease: LATEST })
    if (OLDER !== LATEST) {
      expect(await caller.release.markSeen({ version: OLDER })).toEqual({ lastSeenRelease: LATEST })
    }
    const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    expect(u.lastSeenRelease).toBe(LATEST)
  })

  it("version lạ → BAD_REQUEST, không ghi", async () => {
    const caller = await getAuthedCaller("teacher")
    await expect(caller.release.markSeen({ version: "9.9.9" })).rejects.toMatchObject({ code: "BAD_REQUEST" })
    const u = await db.user.findUniqueOrThrow({ where: { username: "teacher" } })
    expect(u.lastSeenRelease).toBeNull()
  })

  it("không đăng nhập → UNAUTHORIZED", async () => {
    await expect(publicCaller.release.status()).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("đăng ký mới ghi lastSeenRelease = bản mới nhất (không tự mở ô)", async () => {
    await db.user.deleteMany({ where: { username: "gv_w_moi" } })
    await publicCaller.auth.register({ username: "gv_w_moi", password: "MatKhau123456", fullName: "", consent: CONSENT_ACCEPTED })
    const u = await db.user.findUniqueOrThrow({ where: { username: "gv_w_moi" } })
    expect(u.lastSeenRelease).toBe(LATEST)
    expect(u.onboardingDismissedAt).toBeNull()
    await db.consentRecord.deleteMany({ where: { userId: u.id } })
    await db.subject.deleteMany({ where: { userId: u.id } })
    await db.user.delete({ where: { id: u.id } })
  })
})
