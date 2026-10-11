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
// AL: mặc định TK 1 nơi (form như cũ); test Nơi học đổi danh sách nơi.
const placeState = vi.hoisted(() => ({ places: [] as { id: number; name: string; color: string; billing: string }[] }))
vi.mock("@/hooks/usePlaceSummary", () => ({
  usePlaceSummary: () => ({
    places: placeState.places,
    multi: placeState.places.length >= 2,
    placeById: (id: number | undefined) => placeState.places.find((p) => p.id === id),
  }),
}))
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
  placeState.places = [{ id: 1, name: "Lớp tại nhà", color: "#4F46E5", billing: "per_student" }]
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

  it("U11: form sửa HS đang học, đang trọn tháng 400k -> đổi ô Học phí/tháng thành 500k -> hiện ghi chú 'Áp dụng từ tháng...'", async () => {
    const studentWithMonthly = {
      ...STUDENT,
      billingMode: "monthly",
      monthlyFee: 400000,
      tuitionFee: 40000,
    }
    renderDialog({ mode: "edit", student: studentWithMonthly as never })

    expect(screen.queryByText(/Áp dụng từ tháng/)).toBeNull()

    const monthlyInput = screen.getByLabelText(viText.fee_per_month_label)
    fireEvent.change(monthlyInput, { target: { value: "500000" } })

    expect(screen.getByText(/Áp dụng từ tháng/)).toBeTruthy()
  })

  it("U12: form chọn Trọn tháng, để 0 -> submit báo lỗi 'Học phí tháng phải lớn hơn 0', không gọi mutation", async () => {
    renderDialog({ mode: "create" })
    fireEvent.change(screen.getByLabelText(new RegExp(viText.full_name)), { target: { value: "HS Trọn Tháng Zero" } })
    fireEvent.click(screen.getByRole("radio", { name: viText.billing_monthly }))

    const monthlyInput = screen.getByLabelText(viText.fee_per_month_label)
    fireEvent.change(monthlyInput, { target: { value: "0" } })

    fireEvent.click(screen.getByRole("checkbox", { name: viText.consent_student }))
    fireEvent.click(screen.getByRole("button", { name: viText.add }))

    await waitFor(() => {
      expect(screen.getByText("Học phí tháng phải lớn hơn 0")).toBeTruthy()
    })
    expect(createMutate).not.toHaveBeenCalled()
  })
})

describe("StudentFormDialog: Nơi học (spec AL §4.2)", () => {
  const HOME = { id: 1, name: "Lớp tại nhà", color: "#4F46E5", billing: "per_student" }
  const CENTER = { id: 2, name: "TT Ánh Dương", color: "#0891B2", billing: "per_session" }
  const CENTER2 = { id: 3, name: "TT Sao Mai", color: "#D97706", billing: "per_session" }

  it("TK 1 nơi: không có ô Nơi học, không gửi placeId", async () => {
    renderDialog()
    expect(screen.queryByText(viText.student_place)).toBeNull()
    fireEvent.change(screen.getByLabelText(new RegExp(viText.full_name)), { target: { value: "Lê Văn Minh" } })
    fireEvent.click(screen.getByRole("checkbox", { name: viText.consent_student }))
    fireEvent.click(screen.getByRole("button", { name: viText.add }))
    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1))
    expect(createMutate.mock.calls[0][0]).not.toHaveProperty("placeId")
  })

  it("≥ 2 nơi: có ô Nơi học, mặc định nơi theo học sinh, gửi placeId, khối học phí vẫn hiện", async () => {
    placeState.places = [CENTER, HOME]
    renderDialog()
    expect(screen.getByText(viText.student_place)).toBeTruthy()
    expect(screen.getByLabelText(viText.fee_per_session_label)).toBeTruthy()
    fireEvent.change(screen.getByLabelText(new RegExp(viText.full_name)), { target: { value: "Lê Văn Minh" } })
    fireEvent.click(screen.getByRole("checkbox", { name: viText.consent_student }))
    fireEvent.click(screen.getByRole("button", { name: viText.add }))
    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1))
    expect(createMutate.mock.calls[0][0]).toMatchObject({ placeId: HOME.id })
  })

  it("danh sách nơi tải xong sau khi mở form: không xoá tên đã gõ, vẫn chọn sẵn nơi mặc định", async () => {
    placeState.places = []
    const { rerender } = renderDialog()
    fireEvent.change(screen.getByLabelText(new RegExp(viText.full_name)), { target: { value: "Lê Văn Minh" } })
    placeState.places = [CENTER, HOME]
    rerender(
      <LanguageProvider>
        <StudentFormDialog open onOpenChange={() => {}} mode="create" />
      </LanguageProvider>
    )
    expect((screen.getByLabelText(new RegExp(viText.full_name)) as HTMLInputElement).value).toBe("Lê Văn Minh")
    fireEvent.click(screen.getByRole("checkbox", { name: viText.consent_student }))
    fireEvent.click(screen.getByRole("button", { name: viText.add }))
    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1))
    expect(createMutate.mock.calls[0][0]).toMatchObject({ fullName: "Lê Văn Minh", placeId: HOME.id })
  })

  it("nơi theo ca/giờ: ẩn khối học phí, HS mới gửi học phí 0", async () => {
    placeState.places = [CENTER, CENTER2]
    renderDialog()
    expect(screen.getByText(viText.student_place_session_note)).toBeTruthy()
    expect(screen.getByRole("radiogroup", { name: viText.billing_mode_label, hidden: true }).closest("[data-tour='student-form-billing']")!.className).toContain("hidden")
    fireEvent.change(screen.getByLabelText(new RegExp(viText.full_name)), { target: { value: "Lê Văn Minh" } })
    fireEvent.click(screen.getByRole("checkbox", { name: viText.consent_student }))
    fireEvent.click(screen.getByRole("button", { name: viText.add }))
    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1))
    expect(createMutate.mock.calls[0][0]).toMatchObject({ placeId: CENTER.id, billingMode: "per_session", tuitionFee: 0, monthlyFee: 0 })
  })

  it("sửa HS ở nơi theo ca/giờ: ẩn khối học phí nhưng giữ số cũ khi gửi", async () => {
    placeState.places = [HOME, CENTER]
    renderDialog({ mode: "edit", student: { ...STUDENT, tuitionFee: 150000, placeId: CENTER.id } as never })
    expect(screen.getByText(viText.student_place_session_note)).toBeTruthy()
    fireEvent.click(screen.getByRole("checkbox", { name: viText.consent_student }))
    fireEvent.click(screen.getByRole("button", { name: viText.update }))
    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1))
    expect(updateMutate.mock.calls[0][0].data).toMatchObject({ tuitionFee: 150000, placeId: CENTER.id })
  })
})
