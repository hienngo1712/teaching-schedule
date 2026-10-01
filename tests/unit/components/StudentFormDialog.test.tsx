/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import viText from "@/language/vi.json"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { CONSENT_ACCEPTED } from "@/lib/consent"

// jsdom không có ResizeObserver mà Radix Checkbox cần (đo input ẩn).
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

const createMutate = vi.fn()
const updateMutate = vi.fn()
vi.mock("@/lib/trpc", () => ({
  trpc: {
    student: {
      create: { useMutation: () => ({ mutate: createMutate, isPending: false }) },
      update: { useMutation: () => ({ mutate: updateMutate, isPending: false }) },
    },
    useUtils: () => ({
      student: { list: { invalidate: vi.fn() } },
      user: { me: { invalidate: vi.fn() } },
    }),
  },
}))
vi.mock("@/hooks/usePlan", () => ({ usePlan: () => ({ me: null, openUpgrade: vi.fn() }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { StudentFormDialog } from "@/components/students/StudentFormDialog"

const STUDENT = {
  id: 7, userId: 1, fullName: "Trần An", grade: 3, parentPhone: null, parentName: null, notes: null,
  isActive: true, tuitionFee: 0, parentLinkToken: null, level: "tieu_hoc", createdAt: "", updatedAt: "",
  billingMode: "per_session", monthlyFee: 0,
}

function renderDialog(props: Partial<Parameters<typeof StudentFormDialog>[0]> = {}) {
  return render(
    <LanguageProvider>
      <StudentFormDialog open onOpenChange={() => {}} mode="create" {...props} />
    </LanguageProvider>
  )
}

beforeEach(() => {
  createMutate.mockReset()
  updateMutate.mockReset()
})

describe("StudentFormDialog: ô đồng ý (spec O 6.6)", () => {
  it("nút Thêm disabled tới khi tick; gửi kèm consent: CONSENT_ACCEPTED", async () => {
    renderDialog()
    const submit = screen.getByRole("button", { name: viText.add })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(new RegExp(viText.full_name)), { target: { value: "Lê Văn Minh" } })
    fireEvent.click(screen.getByRole("checkbox", { name: viText.consent_student }))
    expect((submit as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(submit)
    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1))
    expect(createMutate.mock.calls[0][0]).toMatchObject({ fullName: "Lê Văn Minh", consent: CONSENT_ACCEPTED })
  })

  it("sửa: ô mặc định không tick; gửi { id, data, consent: CONSENT_ACCEPTED }", async () => {
    renderDialog({ mode: "edit", student: STUDENT as never })
    const checkbox = screen.getByRole("checkbox", { name: viText.consent_student })
    expect(checkbox.getAttribute("aria-checked")).toBe("false")
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole("button", { name: viText.update }))
    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1))
    expect(updateMutate.mock.calls[0][0]).toMatchObject({ id: 7, consent: CONSENT_ACCEPTED, data: { fullName: "Trần An" } })
  })
})

describe("StudentFormDialog: cách thu học phí (Plan T)", () => {
  it("chọn Trọn tháng / Theo buổi: chuyển đổi nhãn và giữ giá trị khi submit", async () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText(new RegExp(viText.full_name)), { target: { value: "Nguyễn Văn B" } })

    // Ban đầu mặc định Theo buổi -> có nhãn Học phí/buổi
    expect(screen.getByText(viText.fee_per_session_label)).toBeTruthy()
    const perSessionInput = screen.getByLabelText(viText.fee_per_session_label) as HTMLInputElement
    fireEvent.change(perSessionInput, { target: { value: "50000" } })

    // Bấm nút Trọn tháng
    const monthlyRadio = screen.getByRole("radio", { name: viText.billing_monthly })
    fireEvent.click(monthlyRadio)
    expect(monthlyRadio.getAttribute("aria-checked")).toBe("true")
    expect(screen.getByText(viText.fee_per_month_label)).toBeTruthy()

    // Nhập 400000
    const monthlyInput = screen.getByLabelText(viText.fee_per_month_label) as HTMLInputElement
    fireEvent.change(monthlyInput, { target: { value: "400000" } })

    // Bấm Theo buổi -> ô hiện lại giá/buổi cũ (50,000)
    const perSessionRadio = screen.getByRole("radio", { name: viText.billing_per_session })
    fireEvent.click(perSessionRadio)
    expect(screen.getByText(viText.fee_per_session_label)).toBeTruthy()
    const perSessionInputAgain = screen.getByLabelText(viText.fee_per_session_label) as HTMLInputElement
    expect(perSessionInputAgain.value).toBe("50,000")

    // Bấm lại Trọn tháng -> hiện lại 400,000
    fireEvent.click(monthlyRadio)
    expect(screen.getByText(viText.fee_per_month_label)).toBeTruthy()
    const monthlyInputAgain = screen.getByLabelText(viText.fee_per_month_label) as HTMLInputElement
    expect(monthlyInputAgain.value).toBe("400,000")

    // Tick consent và submit
    fireEvent.click(screen.getByRole("checkbox", { name: viText.consent_student }))
    fireEvent.click(screen.getByRole("button", { name: viText.add }))

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1))
    expect(createMutate.mock.calls[0][0]).toMatchObject({
      fullName: "Nguyễn Văn B",
      billingMode: "monthly",
      monthlyFee: 400000,
      tuitionFee: 50000,
    })
  })

  it("form sửa HS đang học: đổi cách thu hiện thông báo áp dụng từ tháng; không đổi không hiện", async () => {
    const studentWithMonthly = {
      ...STUDENT,
      billingMode: "monthly",
      monthlyFee: 300000,
      tuitionFee: 40000,
    }
    const { unmount } = renderDialog({ mode: "edit", student: studentWithMonthly as never })

    // Ban đầu chưa đổi -> không hiện thông báo
    expect(screen.queryByText(/Áp dụng từ tháng/)).toBeNull()

    // Đổi sang Theo buổi -> hiện thông báo
    fireEvent.click(screen.getByRole("radio", { name: viText.billing_per_session }))
    expect(screen.getByText(/Áp dụng từ tháng/)).toBeTruthy()

    // Bấm lại Trọn tháng (như cũ) -> thông báo biến mất
    fireEvent.click(screen.getByRole("radio", { name: viText.billing_monthly }))
    expect(screen.queryByText(/Áp dụng từ tháng/)).toBeNull()

    unmount()
  })
})
