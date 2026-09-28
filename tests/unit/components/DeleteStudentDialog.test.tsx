/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { DeleteStudentDialog } from "@/components/students/DeleteStudentDialog"
import { vnDateParts } from "@/lib/utils"

type StatusData = {
  items: { totalAmountDue: number; paidAmount: number; isFullPaid: boolean }[]
}

const mockStatusQuery = vi.hoisted(() => ({
  data: undefined as StatusData | undefined,
  isPending: false,
  isError: false,
  lastArgs: null as Record<string, unknown> | null,
}))

const mockDeleteMut = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
}))

const mockDeactivateMut = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
}))

vi.mock("@/lib/trpc", () => ({
  trpc: {
    tuition: {
      getMonthlyStatusReadOnly: {
        useQuery: (args: Record<string, unknown>) => {
          mockStatusQuery.lastArgs = args
          return {
            data: mockStatusQuery.data,
            isPending: mockStatusQuery.isPending,
            isError: mockStatusQuery.isError,
          }
        },
      },
    },
    student: {
      delete: {
        useMutation: (opts?: { onSuccess?: () => void }) => ({
          mutate: (args: { id: number }) => {
            mockDeleteMut.mutate(args)
            opts?.onSuccess?.()
          },
          isPending: mockDeleteMut.isPending,
        }),
      },
      deactivate: {
        useMutation: (opts?: { onSuccess?: () => void }) => ({
          mutate: (args: { id: number }) => {
            mockDeactivateMut.mutate(args)
            opts?.onSuccess?.()
          },
          isPending: mockDeactivateMut.isPending,
        }),
      },
    },
  },
}))

function renderDialog(student = { id: 1, fullName: "HS Test", isActive: true }, onOpenChange = vi.fn()) {
  return render(
    <LanguageProvider forcedLanguage="vi">
      <DeleteStudentDialog student={student} onOpenChange={onOpenChange} />
    </LanguageProvider>
  )
}

describe("DeleteStudentDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStatusQuery.data = undefined
    mockStatusQuery.isPending = false
    mockStatusQuery.isError = false
    mockDeleteMut.isPending = false
    mockDeactivateMut.isPending = false
  })

  it("(a) HS đang học còn nợ: hiện cảnh báo nợ, nút Cho nghỉ thay, nút Xóa và Cho nghỉ thay gọi đúng mutation", () => {
    mockStatusQuery.data = {
      items: [{ totalAmountDue: 350000, paidAmount: 0, isFullPaid: false }],
    }
    const onOpenChange = vi.fn()
    renderDialog({ id: 1, fullName: "HS Test", isActive: true }, onOpenChange)

    expect(screen.getByText(/còn nợ 350\.000 đ/)).toBeTruthy()
    const deactivateBtn = screen.getByRole("button", { name: "Cho nghỉ thay" })
    expect(deactivateBtn).toBeTruthy()

    fireEvent.click(deactivateBtn)
    expect(mockDeactivateMut.mutate).toHaveBeenCalledWith({ id: 1 })
    expect(onOpenChange).toHaveBeenCalledWith(false)

    fireEvent.click(screen.getByRole("button", { name: "Xóa" }))
    expect(mockDeleteMut.mutate).toHaveBeenCalledWith({ id: 1 })
  })

  it("(b) isFullPaid=true dù còn số nợ: coi như không nợ, không có Cho nghỉ thay", () => {
    mockStatusQuery.data = {
      items: [{ totalAmountDue: 350000, paidAmount: 0, isFullPaid: true }],
    }
    renderDialog()

    expect(screen.queryByText(/còn nợ/)).toBeNull()
    expect(screen.queryByRole("button", { name: "Cho nghỉ thay" })).toBeNull()
    expect(screen.getByRole("button", { name: "Xóa" })).toBeTruthy()
  })

  it("(c) nợ > 0 nhưng HS đã nghỉ (isActive=false): không có nút Cho nghỉ thay", () => {
    mockStatusQuery.data = {
      items: [{ totalAmountDue: 350000, paidAmount: 0, isFullPaid: false }],
    }
    renderDialog({ id: 2, fullName: "HS Đã Nghỉ", isActive: false })

    expect(screen.getByText(/còn nợ 350\.000 đ/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Cho nghỉ thay" })).toBeNull()
  })

  it("(d) isPending: nút xóa hiện 'Đang kiểm tra…' và disabled", () => {
    mockStatusQuery.isPending = true
    renderDialog()

    const btn = screen.getByRole("button", { name: "Đang kiểm tra…" })
    expect(btn).toBeTruthy()
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it("(e) isError: coi như không nợ, nút Xóa bật", () => {
    mockStatusQuery.isError = true
    renderDialog()

    expect(screen.queryByText(/còn nợ/)).toBeNull()
    const btn = screen.getByRole("button", { name: "Xóa" })
    expect(btn).toBeTruthy()
    expect((btn as HTMLButtonElement).disabled).toBe(false)
  })

  it("(f) query gọi với year/month = vnDateParts() hiện tại", () => {
    const { year, month } = vnDateParts()
    renderDialog({ id: 5, fullName: "HS Check Date", isActive: true })

    expect(mockStatusQuery.lastArgs).toMatchObject({
      studentId: 5,
      year,
      month,
      status: "all",
      page: 1,
      limit: 1,
    })
  })
})
