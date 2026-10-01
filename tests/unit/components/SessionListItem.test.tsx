/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { render } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { SessionListItem } from "@/components/calendar/SessionListItem"
import type { SessionListDTO } from "@/lib/types/models"

const sampleSession: SessionListDTO = {
  id: 1,
  userId: 1,
  sessionDate: new Date(Date.UTC(2026, 8, 26)),
  startTime: "08:00",
  endTime: "09:30",
  durationMins: 90,
  subjectId: 1,
  subject: { id: 1, name: "Toán", color: "#0891B2" },
  title: null,
  notes: null,
  status: "scheduled",
  cancelReason: null,
  cancelledAt: null,
  makeupOfId: null,
  studentCount: 2,
  grades: [5],
  level: "tieu_hoc",
  isDeleted: false,
  deletedAt: null,
}

describe("SessionListItem — U20 dòng meta xuống dòng", () => {
  it("dòng meta có class flex-wrap, gap-x-3, gap-y-1", () => {
    const { container } = render(
      <LanguageProvider forcedLanguage="vi">
        <SessionListItem session={sampleSession} onClick={vi.fn()} />
      </LanguageProvider>
    )

    const metaRow = container.querySelector(".text-slate-500")
    expect(metaRow).not.toBeNull()
    expect(metaRow?.className).toContain("flex-wrap")
    expect(metaRow?.className).toContain("gap-x-3")
    expect(metaRow?.className).toContain("gap-y-1")
  })
})
