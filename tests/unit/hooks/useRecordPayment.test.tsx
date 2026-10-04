/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useRecordPayment } from "@/hooks/useRecordPayment"
import { toast } from "sonner"

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}))

const mockRecordMutate = vi.fn()
const mockDeleteBatchMutate = vi.fn().mockResolvedValue({})
const mockInvalidateTuition = vi.fn().mockResolvedValue({})
const mockInvalidatePayment = vi.fn().mockResolvedValue({})

let recordOptions: {
  onSuccess?: (res: { batchId: string; allocations: { year: number; month: number; amount: number }[] }, vars: { amount: number }) => void
  onError?: (err: Error) => void
} = {}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      tuition: { invalidate: mockInvalidateTuition },
      payment: { invalidate: mockInvalidatePayment },
      client: { payment: { deleteBatch: { mutate: mockDeleteBatchMutate } } },
    }),
    payment: {
      record: {
        useMutation: (opts: typeof recordOptions) => {
          recordOptions = opts
          return { mutate: mockRecordMutate, isPending: false }
        },
      },
    },
  },
}))

import { LanguageProvider } from "@/components/providers/LanguageProvider"

describe("useRecordPayment (spec Y §4.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    recordOptions = {}
  })

  it("payFull gọi record.mutate, onSuccess hiện toast có Hoàn tác", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LanguageProvider forcedLanguage="vi">{children}</LanguageProvider>
    )
    const { result } = renderHook(() => useRecordPayment(), { wrapper })
    act(() => {
      result.current.payFull({ studentId: 1, year: 2026, month: 9 }, 800_000)
    })
    expect(mockRecordMutate).toHaveBeenCalledWith({
      studentId: 1,
      year: 2026,
      month: 9,
      amount: 800_000,
    })

    // Giả lập onSuccess từ backend
    act(() => {
      recordOptions.onSuccess?.(
        { batchId: "batch-123", allocations: [{ year: 2026, month: 9, amount: 800_000 }] },
        { amount: 800_000 }
      )
    })

    expect(toast).toHaveBeenCalled()
    const toastCall = (toast as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(toastCall[1]?.action?.label).toBe("Hoàn tác")

    // Bấm nút Hoàn tác trong toast
    act(() => {
      toastCall[1]?.action?.onClick()
    })
    expect(mockDeleteBatchMutate).toHaveBeenCalledWith({ batchId: "batch-123" })
  })
})
