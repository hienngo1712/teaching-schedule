/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { SessionCard } from "@/components/calendar/SessionCard"
import type { SessionListDTO } from "@/lib/types/models"

vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn(() => {
    throw new Error("useMediaQuery must not be called in SessionCard")
  }),
}))

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: true,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
})

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
  grades: [],
  level: "tieu_hoc",
  isDeleted: false,
  deletedAt: null,
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

describe("SessionCard — ca đã huỷ luôn đỏ, không bị màu cấp học đè (spec P4)", () => {
  it.each(["tieu_hoc", "thcs", "thpt", "mixed"] as const)("%s + cancelled", (level) => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <SessionCard session={{ ...base, level, status: "cancelled", cancelledAt: new Date() }} />
      </LanguageProvider>
    )
    const cls = screen.getByRole("button").className
    expect(cls).not.toMatch(/session-card--/)
    expect(cls).not.toContain("bg-slate-100")
    expect(cls).toContain("bg-red-50")
    expect(cls).toContain("border-red-300")
  })
})

describe("SessionCard — hiển thị lớp học (spec S5)", () => {
  it("grades [5], 3 HS → text chứa Lớp 5 · 3 HS", () => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <SessionCard session={{ ...base, grades: [5], studentCount: 3 }} />
      </LanguageProvider>
    )
    expect(screen.getByRole("button").textContent).toContain("Lớp 5 · 3 HS")
  })

  it("grades [] → không có chữ Lớp", () => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <SessionCard session={{ ...base, grades: [], studentCount: 3 }} />
      </LanguageProvider>
    )
    expect(screen.getByRole("button").textContent).not.toContain("Lớp")
  })
})

describe("SessionCard — U19 không dùng useMediaQuery và render 2 chuỗi meta qua CSS responsive", () => {
  it("grades [5] → DOM có phần tử md:hidden chứa 'L5' và hidden md:inline chứa 'Lớp 5'", () => {
    const { container } = render(
      <LanguageProvider forcedLanguage="vi">
        <SessionCard session={{ ...base, grades: [5], studentCount: 3 }} />
      </LanguageProvider>
    )
    const shortSpan = container.querySelector(".md\\:hidden")
    const fullSpan = container.querySelector(".hidden.md\\:inline")
    expect(shortSpan).not.toBeNull()
    expect(shortSpan?.textContent).toContain("L5 · 3 HS")
    expect(fullSpan).not.toBeNull()
    expect(fullSpan?.textContent).toContain("Lớp 5 · 3 HS")
  })
})

