import { describe, it, expect, vi } from "vitest"
import { markReleaseSeen } from "@/server/services/release.service"
import { RELEASES } from "@/lib/releases"

// RELEASES xếp mới nhất trước.
const [NEWEST, MID, OLD] = [RELEASES[0].version, RELEASES[1].version, RELEASES[2].version]

describe("markReleaseSeen", () => {
  it("tab khác vừa ghi bản mới hơn giữa lúc đọc và ghi: không đè lùi, trả bản mới nhất", async () => {
    const db = {
      user: {
        findUniqueOrThrow: vi.fn()
          .mockResolvedValueOnce({ lastSeenRelease: OLD })
          .mockResolvedValueOnce({ lastSeenRelease: NEWEST }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        update: vi.fn(),
      },
    }
    expect(await markReleaseSeen(db as never, 1, MID)).toEqual({ lastSeenRelease: NEWEST })
    expect(db.user.update).not.toHaveBeenCalled()
    expect(db.user.updateMany).toHaveBeenCalledWith({ where: { id: 1, lastSeenRelease: OLD }, data: { lastSeenRelease: MID } })
  })

  it("không ai chen: ghi có điều kiện 1 lần", async () => {
    const db = {
      user: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ lastSeenRelease: null }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn(),
      },
    }
    expect(await markReleaseSeen(db as never, 1, NEWEST)).toEqual({ lastSeenRelease: NEWEST })
    expect(db.user.updateMany).toHaveBeenCalledTimes(1)
  })
})
