/**
 * @vitest-environment jsdom
 */
// Spec AL §4.1: form Nơi dạy — loại gợi ý cách tính; sửa nơi có dữ liệu thì cảnh báo áp từ tháng hiện tại.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

const mutate = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ place: { invalidate: vi.fn() } }),
    place: {
      create: { useMutation: () => ({ mutate: mutate.create, isPending: false }) },
      update: { useMutation: () => ({ mutate: mutate.update, isPending: false }) },
    },
  },
}))

import { PlaceFormDialog } from "@/components/places/PlaceFormDialog"

const existing = {
  id: 7, name: "Lớp tại nhà", kind: "home" as const, color: "#4F46E5", billing: "per_student" as const,
  sortOrder: 0, activeStudents: 3, futureSessions: 2, hasData: true,
}

function renderForm(place?: typeof existing) {
  render(
    <LanguageProvider forcedLanguage="vi">
      <PlaceFormDialog place={place} usedColors={[]} onClose={vi.fn()} />
    </LanguageProvider>
  )
}

beforeEach(() => {
  mutate.create.mockReset()
  mutate.update.mockReset()
  vi.setSystemTime(new Date(Date.UTC(2026, 9, 20, 5)))
})
afterEach(() => vi.useRealTimers())

describe("PlaceFormDialog", () => {
  it("chọn Trung tâm thì cách tính tự chuyển Theo ca/giờ; lưu gửi đúng dữ liệu", () => {
    renderForm()
    expect(screen.getByRole("radio", { name: "Theo học sinh (học phí)" }).getAttribute("aria-checked")).toBe("true")
    fireEvent.click(screen.getByRole("radio", { name: "Trung tâm" }))
    expect(screen.getByRole("radio", { name: "Theo ca/giờ, nơi này trả" }).getAttribute("aria-checked")).toBe("true")
    fireEvent.change(screen.getByLabelText("Tên nơi dạy"), { target: { value: " TT Ánh Dương " } })
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }))
    expect(mutate.create).toHaveBeenCalledWith({ name: "TT Ánh Dương", kind: "center", color: "#4F46E5", billing: "per_session" })
  })

  it("sửa nơi đã có dữ liệu, đổi cách tính → cảnh báo áp từ tháng 10/2026", () => {
    renderForm(existing)
    expect(screen.queryByTestId("place-billing-from")).toBeNull()
    fireEvent.click(screen.getByRole("radio", { name: "Theo ca/giờ, nơi này trả" }))
    expect(screen.getByTestId("place-billing-from").textContent).toBe("Áp dụng từ tháng 10/2026, các tháng trước giữ nguyên")
  })

  it("nơi chưa có dữ liệu: đổi cách tính không cảnh báo", () => {
    renderForm({ ...existing, hasData: false, activeStudents: 0, futureSessions: 0 })
    fireEvent.click(screen.getByRole("radio", { name: "Theo ca/giờ, nơi này trả" }))
    expect(screen.queryByTestId("place-billing-from")).toBeNull()
  })
})
