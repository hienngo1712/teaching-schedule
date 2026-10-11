/**
 * @vitest-environment jsdom
 */
// Spec AL §4.1: form Nơi dạy — loại gợi ý cách tính; sửa nơi có dữ liệu thì cảnh báo áp từ tháng hiện tại.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

const mutate = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  rate: vi.fn(),
  onSaved: undefined as undefined | ((saved: { id: number }) => void),
}))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ place: { invalidate: vi.fn() }, income: { invalidate: vi.fn() } }),
    place: {
      create: { useMutation: (o: { onSuccess: (s: { id: number }) => void }) => ((mutate.onSaved = o.onSuccess), { mutate: mutate.create, isPending: false }) },
      update: { useMutation: (o: { onSuccess: (s: { id: number }) => void }) => ((mutate.onSaved = o.onSuccess), { mutate: mutate.update, isPending: false }) },
    },
    placeRate: { set: { useMutation: () => ({ mutate: mutate.rate, isPending: false }) } },
  },
}))

import { PlaceFormDialog } from "@/components/places/PlaceFormDialog"

type Place = NonNullable<Parameters<typeof PlaceFormDialog>[0]["place"]>
const existing: Place = {
  id: 7, name: "Lớp tại nhà", kind: "home", color: "#4F46E5", billing: "per_student",
  sortOrder: 0, activeStudents: 3, futureSessions: 2, hasData: true, hasSessions: true, rate: null,
}

function renderForm(place?: Place) {
  render(
    <LanguageProvider forcedLanguage="vi">
      <PlaceFormDialog place={place} usedColors={[]} onClose={vi.fn()} />
    </LanguageProvider>
  )
}

// Radix Select cần các API con trỏ/cuộn mà jsdom không có.
Object.assign(window.HTMLElement.prototype, {
  hasPointerCapture: () => false,
  releasePointerCapture: () => {},
  scrollIntoView: () => {},
})

beforeEach(() => {
  mutate.create.mockReset()
  mutate.update.mockReset()
  mutate.rate.mockReset()
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

  // FIX AL Task 3: form sửa nạp đúng cách tính hiện tại; Lưu không đổi gì thì không gửi billing.
  it("sửa nơi per_session: chọn sẵn Theo ca/giờ; Lưu không đổi gì → không gửi billing", () => {
    renderForm({ ...existing, name: "TT Ánh Dương", kind: "center", billing: "per_session" })
    expect(screen.getByRole("radio", { name: "Theo ca/giờ, nơi này trả" }).getAttribute("aria-checked")).toBe("true")
    expect(screen.getByRole("radio", { name: "Trung tâm" }).getAttribute("aria-checked")).toBe("true")
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }))
    expect(mutate.update).toHaveBeenCalledTimes(1)
    expect(mutate.update.mock.calls[0][0]).not.toHaveProperty("billing")
  })

  it("nơi chưa có dữ liệu: đổi cách tính không cảnh báo", () => {
    renderForm({ ...existing, hasData: false, activeStudents: 0, futureSessions: 0 })
    fireEvent.click(screen.getByRole("radio", { name: "Theo ca/giờ, nơi này trả" }))
    expect(screen.queryByTestId("place-billing-from")).toBeNull()
  })
})

describe("PlaceFormDialog: đơn giá (spec AM §4.2)", () => {
  const center: Place = { ...existing, id: 9, name: "TT Ánh Dương", kind: "center", billing: "per_session" }

  it("nơi theo học sinh không có khối Đơn giá; chọn theo ca/giờ thì có", () => {
    renderForm(existing)
    expect(screen.queryByText("Đơn giá (không bắt buộc)")).toBeNull()
    fireEvent.click(screen.getByRole("radio", { name: "Theo ca/giờ, nơi này trả" }))
    expect(screen.getByText("Đơn giá (không bắt buộc)")).toBeTruthy()
  })

  it("nơi mới (chưa có ca): không hỏi tháng; lưu xong gọi placeRate.set theo giờ", () => {
    renderForm()
    fireEvent.click(screen.getByRole("radio", { name: "Trung tâm" }))
    fireEvent.change(screen.getByLabelText("Tên nơi dạy"), { target: { value: "TT Ánh Dương" } })
    expect(screen.queryByLabelText("Áp dụng từ tháng")).toBeNull()
    fireEvent.click(screen.getByRole("radio", { name: "Theo giờ" }))
    fireEvent.change(screen.getByLabelText("Số tiền mỗi giờ"), { target: { value: "185000" } })
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }))
    mutate.onSaved!({ id: 12 })
    expect(mutate.rate).toHaveBeenCalledTimes(1)
    expect(mutate.rate.mock.calls[0][0]).toEqual({ placeId: 12, unit: "hour", amount: 185000, fromYear: 2026, fromMonth: 10 })
  })

  it("nơi đã có ca: hiện Áp dụng từ tháng (mặc định tháng hiện tại, lùi tối đa 12 tháng); lưu gửi đúng tháng", () => {
    renderForm({ ...center, rate: { unit: "session", amount: 150000 } })
    // FIX AM F2: Select của app (Radix), không phải select gốc.
    const from = screen.getByRole("combobox", { name: "Áp dụng từ tháng" })
    expect(from.tagName).toBe("BUTTON")
    expect(from.textContent).toBe("T10/2026")
    fireEvent.pointerDown(from, { button: 0, ctrlKey: false, pointerType: "mouse" })
    const options = screen.getAllByRole("option")
    expect(options).toHaveLength(13)
    expect(options[12].textContent).toBe("T10/2025")
    fireEvent.click(screen.getByRole("option", { name: "T8/2026" }))
    expect(screen.getByRole("combobox", { name: "Áp dụng từ tháng" }).textContent).toBe("T8/2026")
    fireEvent.change(screen.getByLabelText("Số tiền mỗi ca"), { target: { value: "160000" } })
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }))
    mutate.onSaved!({ id: 9 })
    expect(mutate.rate.mock.calls[0][0]).toEqual({ placeId: 9, unit: "session", amount: 160000, fromYear: 2026, fromMonth: 8 })
  })

  it("không đổi đơn giá → không gọi placeRate.set", () => {
    renderForm({ ...center, rate: { unit: "session", amount: 150000 } })
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }))
    mutate.onSaved!({ id: 9 })
    expect(mutate.rate).not.toHaveBeenCalled()
  })
})
