/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { SessionCard } from "@/components/calendar/SessionCard"
import type { SessionListDTO } from "@/lib/types/models"

const base: SessionListDTO = {
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
  studentCount: 1,
  level: "tieu_hoc",
}

describe("SessionCard — màu viền theo cấp học", () => {
  it.each([
    ["tieu_hoc", "session-card--tieu-hoc"],
    ["thcs", "session-card--thcs"],
    ["thpt", "session-card--thpt"],
  ] as const)("%s → %s", (level, cls) => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <SessionCard session={{ ...base, level }} />
      </LanguageProvider>
    )
    expect(screen.getByRole("button").className).toContain(cls)
  })

  it("globals.css có .session-card--thpt viền amber-600 nền amber-50", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8")
    expect(css).toMatch(/\.session-card--thpt\s*\{\s*@apply border-amber-600 bg-amber-50;\s*\}/)
  })
})
