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

const mockPurge = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }))
const mockPurgeAll = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }))

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
      purge: {
        useMutation: (opts?: { onSuccess?: (r: { purged: Record<string, number> }) => void; onError?: (e: Error) => void }) => ({
          mutate: (args: { type: string }) => {
            mockPurge.mutate(args)
            opts?.onSuccess?.({ purged: { [args.type]: 1, session: 0, student: 0, payment: 0, subject: 0, [args.type]: 1 } })
          },
          isPending: mockPurge.isPending,
        }),
      },
      purgeAll: {
        useMutation: (opts?: { onSuccess?: (r: { purged: Record<string, number> }) => void; onError?: (e: Error) => void }) => ({
          mutate: () => {
            mockPurgeAll.mutate()
            opts?.onSuccess?.({ purged: { session: 1, student: 0, payment: 2, subject: 0 } })
          },
          isPending: mockPurgeAll.isPending,
        }),
      },
    },
  },
}))

// AK: 2 nút dọn nằm trong menu ⋯ cạnh hàng tab.
const openMore = () => fireEvent.keyDown(screen.getByRole("button", { name: "Thêm thao tác" }), { key: "Enter" })

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

  it("⋯ → Dọn tab này có số mục của tab, bấm → popup cảnh báo, Xóa vĩnh viễn gọi purge đúng loại", async () => {
    mockCounts.data = { session: 1, student: 0, payment: 2, subject: 0 }
    renderTrash()
    openMore()
    fireEvent.click(await screen.findByRole("menuitem", { name: "Dọn tab này (1)" }))
    expect(screen.getByText(/vĩnh viễn không lấy lại được/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Xóa vĩnh viễn" }))
    expect(mockPurge.mutate).toHaveBeenCalledWith({ type: "session" })
  })

  it("⋯ → Dọn sạch thùng rác → popup tổng 3 mục → gọi purgeAll", async () => {
    mockCounts.data = { session: 1, student: 0, payment: 2, subject: 0 }
    renderTrash()
    openMore()
    fireEvent.click(await screen.findByRole("menuitem", { name: "Dọn sạch thùng rác" }))
    expect(screen.getByText("Xóa vĩnh viễn 3 mục?")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Xóa vĩnh viễn" }))
    expect(mockPurgeAll.mutate).toHaveBeenCalled()
  })

  // [RF 4] tab rỗng / thùng rác rỗng → mục dọn bị khoá như nút cũ.
  it("thùng rác trống → 2 mục dọn disabled", async () => {
    mockCounts.data = { session: 0, student: 0, payment: 0, subject: 0 }
    renderTrash()
    openMore()
    expect((await screen.findByRole("menuitem", { name: "Dọn sạch thùng rác" })).getAttribute("aria-disabled")).toBe("true")
    expect(screen.getByRole("menuitem", { name: "Dọn tab này (0)" }).getAttribute("aria-disabled")).toBe("true")
  })

  it("tab đang chọn rỗng nhưng tab khác còn: Dọn tab này khoá, Dọn sạch vẫn bấm được", async () => {
    mockCounts.data = { session: 0, student: 0, payment: 2, subject: 0 }
    renderTrash()
    openMore()
    expect((await screen.findByRole("menuitem", { name: "Dọn tab này (0)" })).getAttribute("aria-disabled")).toBe("true")
    expect(screen.getByRole("menuitem", { name: "Dọn sạch thùng rác" }).getAttribute("aria-disabled")).toBeNull()
  })

  it("không còn nút Dọn sạch ở đầu trang; tab cuộn ngang trên điện thoại, chữ không gãy", () => {
    renderTrash()
    expect(screen.queryByRole("button", { name: "Dọn sạch thùng rác" })).toBeNull()
    expect(screen.getByRole("tablist").className).toContain("overflow-x-auto")
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab.className).toContain("shrink-0")
      expect(tab.className).toContain("whitespace-nowrap")
    }
  })

  it("tab Học sinh: popup có dòng tiền vẫn giữ trong Báo cáo", async () => {
    mockCounts.data = { session: 0, student: 2, payment: 0, subject: 0 }
    renderTrash()
    fireEvent.click(screen.getByRole("tab", { name: /Học sinh/ }))
    openMore()
    fireEvent.click(await screen.findByRole("menuitem", { name: "Dọn tab này (2)" }))
    expect(screen.getByText(/vẫn được giữ trong Báo cáo/)).toBeTruthy()
  })
})
