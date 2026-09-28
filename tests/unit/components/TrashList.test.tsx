/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { TrashList } from "@/components/trash/TrashList"
import type { TrashItemDTO } from "@/lib/types/models"
import { toast } from "sonner"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const mockCounts = vi.hoisted(() => ({
  data: { session: 1, student: 0, payment: 2, subject: 0 },
}))

const mockListData = vi.hoisted(() => ({
  items: [] as TrashItemDTO[],
  totalCount: 0,
  totalPages: 1,
}))

const mockListArgs = vi.hoisted(() => ({
  lastInput: null as Record<string, unknown> | null,
}))

const mockRestore = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
}))

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      trash: {
        counts: { invalidate: vi.fn() },
        list: { invalidate: vi.fn() },
      },
    }),
    trash: {
      counts: {
        useQuery: () => mockCounts,
      },
      list: {
        useQuery: (input: Record<string, unknown>) => {
          mockListArgs.lastInput = input
          return {
            data: mockListData,
            isPending: false,
            isError: false,
            refetch: vi.fn(),
          }
        },
      },
      restore: {
        useMutation: (opts?: { onSuccess?: () => void; onError?: (e: Error) => void }) => {
          return {
            mutate: (args: { type: string; id: number }) => {
              mockRestore.mutate(args)
              if (opts?.onError && args?.id === 999) {
                opts.onError(new Error("Trùng giờ dạy"))
              } else if (opts?.onSuccess) {
                opts.onSuccess()
              }
            },
            isPending: mockRestore.isPending,
          }
        },
      },
    },
  },
}))

function renderTrash() {
  return render(
    <LanguageProvider forcedLanguage="vi">
      <TrashList />
    </LanguageProvider>
  )
}

describe("TrashList", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCounts.data = { session: 1, student: 0, payment: 2, subject: 0 }
    mockListData.items = []
    mockListData.totalCount = 0
    mockListData.totalPages = 1
  })

  it("4 nút lọc role=tab đúng thứ tự, mặc định Ca dạy, list gọi đúng params", () => {
    renderTrash()
    const tabs = screen.getAllByRole("tab")
    expect(tabs.map((t) => t.textContent?.trim())).toEqual([
      "Ca dạy 1",
      "Học sinh 0",
      "Lần thu 2",
      "Môn học 0",
    ])
    expect(tabs[0].getAttribute("aria-selected")).toBe("true")
    expect(mockListArgs.lastInput).toEqual({ type: "session", page: 1, limit: 20 })
  })

  it("item ca: hiện đầy đủ thông tin thời gian, môn, ca bù, ngày xoá", () => {
    mockListData.items = [
      {
        type: "session",
        id: 10,
        sessionDate: "2031-03-03",
        startTime: "08:00",
        endTime: "09:30",
        subjectName: "Toán",
        title: null,
        isMakeup: true,
        deletedAt: new Date("2026-09-27T01:05:00Z"),
      },
    ]
    mockListData.totalCount = 1

    renderTrash()
    expect(screen.getAllByText(/T2 03\/03\/2031 · 08:00–09:30 · Toán/).length).toBeGreaterThan(0)
    expect(screen.getAllByText("Ca bù").length).toBeGreaterThan(0)
    expect(screen.getAllByText(/27\/09\/2026 08:05/).length).toBeGreaterThan(0)
  })

  it("bấm tab Lần thu → list gọi type=payment, item payment hiện đúng", () => {
    mockListData.items = [
      {
        type: "payment",
        id: 20,
        amount: 70000,
        paidAt: "2030-05-20",
        studentName: "HS Thu",
        year: 2030,
        month: 5,
        deletedAt: new Date("2026-09-27T01:05:00Z"),
      },
    ]
    mockListData.totalCount = 1

    renderTrash()
    const tabs = screen.getAllByRole("tab")
    fireEvent.click(tabs[2]) // Tab Lần thu

    expect(mockListArgs.lastInput?.type).toBe("payment")
    expect(screen.getAllByText("70.000 đ · HS Thu").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Thu ngày 20/05/2030 · tháng 5/2030").length).toBeGreaterThan(0)
  })

  it("bấm Khôi phục → restore.mutate; onError → toast.error", () => {
    mockListData.items = [
      {
        type: "session",
        id: 999,
        sessionDate: "2031-03-03",
        startTime: "08:00",
        endTime: "09:30",
        subjectName: "Toán",
        title: null,
        isMakeup: false,
        deletedAt: new Date(),
      },
    ]
    mockListData.totalCount = 1

    renderTrash()
    const restoreButtons = screen.getAllByRole("button", { name: /Khôi phục/ })
    fireEvent.click(restoreButtons[0])

    expect(mockRestore.mutate).toHaveBeenCalledWith({ type: "session", id: 999 })
    expect(toast.error).toHaveBeenCalledWith("Trùng giờ dạy")
  })

  it("items rỗng → hiện Thùng rác trống", () => {
    mockListData.items = []
    mockListData.totalCount = 0

    renderTrash()
    expect(screen.getByText("Thùng rác trống")).toBeTruthy()
  })
})
