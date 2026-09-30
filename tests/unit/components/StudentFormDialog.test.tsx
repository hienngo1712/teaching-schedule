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
} as never

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
    renderDialog({ mode: "edit", student: STUDENT })
    const checkbox = screen.getByRole("checkbox", { name: viText.consent_student })
    expect(checkbox.getAttribute("aria-checked")).toBe("false")
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole("button", { name: viText.update }))
    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1))
    expect(updateMutate.mock.calls[0][0]).toMatchObject({ id: 7, consent: CONSENT_ACCEPTED, data: { fullName: "Trần An" } })
  })
})
