/**
 * @vitest-environment jsdom
 */
// Spec AR A2: tên môn dài ở 375 xuống dòng hiện đủ, không cắt "…".
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

const LONG = "Luyện thi học sinh giỏi Toán và Tiếng Việt lớp 5 nâng cao cuối tuần"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/components/subjects/SubjectFormDialog", () => ({ SubjectFormDialog: () => null }))
vi.mock("@/lib/trpc", () => {
  const mutation = { useMutation: () => ({ mutate: vi.fn(), isPending: false }) }
  return {
    trpc: {
      useUtils: () => ({ subject: { list: { invalidate: vi.fn() } } }),
      subject: {
        list: {
          useQuery: () => ({
            data: [{ id: 1, name: LONG, color: "#0d9488", isActive: true, isDefault: false }],
            isPending: false,
            isError: false,
          }),
        },
        update: mutation,
        delete: mutation,
      },
    },
  }
})

import { SubjectList } from "@/components/subjects/SubjectList"

describe("SubjectList — tên môn dài", () => {
  it("không cắt truncate, có break-words", () => {
    render(
      <LanguageProvider forcedLanguage="vi">
        <SubjectList />
      </LanguageProvider>
    )
    const name = screen.getByText(LONG)
    expect(name.className).not.toContain("truncate")
    expect(name.className).toContain("break-words")
  })
})
