/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { TrialDaysForm } from "@/components/admin/TrialDaysForm"

type MutOpts = { onSuccess?: () => void; onError?: (e: { message: string; data?: { code?: string } | null }) => void }

const h = vi.hoisted(() => ({ mutate: vi.fn(), opts: null as null | MutOpts, invalidate: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ admin: { trialSettings: { invalidate: h.invalidate } } }),
    admin: {
      trialSettings: {
        useQuery: () => ({
          data: {
            days: 60,
            history: [
              { id: 2, days: 60, previousDays: 90, changedBy: "admin_test", createdAt: "2026-09-27T03:05:00.000Z" },
              { id: 1, days: 90, previousDays: null, changedBy: "migration", createdAt: "2026-09-27T01:00:00.000Z" },
            ],
          },
          isPending: false,
          isError: false,
          refetch: vi.fn(),
        }),
      },
      updateTrialDays: {
        useMutation: (opts: MutOpts) => {
          h.opts = opts
          return { mutate: h.mutate, isPending: false }
        },
      },
    },
  },
}))

function renderForm() {
  render(
    <LanguageProvider forcedLanguage="vi">
      <TrialDaysForm />
    </LanguageProvider>
  )
}
const input = () => screen.getByRole("textbox", { name: "Số ngày dùng thử" }) as HTMLInputElement
const save = () => screen.getByRole("button", { name: "Lưu số ngày" }) as HTMLButtonElement
const form = () => screen.getByTestId("trial-days-form").textContent ?? ""

beforeEach(() => {
  vi.clearAllMocks()
  h.opts = null
})

describe("TrialDaysForm", () => {
  it("hiện số ngày hiện hành, ghi chú chỉ áp tài khoản mới; chưa đổi thì Lưu khóa; lịch sử cũ → mới", () => {
    renderForm()
    expect(input().value).toBe("60")
    expect(form()).toContain("Chỉ áp cho tài khoản đăng ký sau khi lưu")
    expect(save().disabled).toBe(true)
    const cards = screen.getAllByTestId("trial-history-card").map((c) => c.textContent)
    expect(cards[0]).toContain("90 → 60 ngày")
    expect(cards[0]).toContain("admin_test · 27/09/2026 10:05")
    expect(cards[1]).toContain("Ban đầu 90 ngày")
  })

  it("ngoài 0–365 hoặc trống → lỗi, Lưu khóa; 0 hợp lệ", () => {
    renderForm()
    fireEvent.change(input(), { target: { value: "400" } })
    expect(form()).toContain("Số ngày từ 0 đến 365")
    expect(save().disabled).toBe(true)
    fireEvent.change(input(), { target: { value: "" } })
    expect(save().disabled).toBe(true)
    fireEvent.change(input(), { target: { value: "0" } })
    expect(form()).not.toContain("Số ngày từ 0 đến 365")
    expect(save().disabled).toBe(false)
  })

  it("gõ 90 → Lưu → hộp xác nhận 60 → 90 ngày → Xác nhận gửi days + expected", () => {
    renderForm()
    fireEvent.change(input(), { target: { value: "90" } })
    fireEvent.click(save())
    const confirm = screen.getByTestId("trial-confirm")
    expect(confirm.textContent).toContain("Đổi số ngày dùng thử?")
    expect(confirm.textContent).toContain("60 → 90 ngày")
    fireEvent.click(within(confirm).getByRole("button", { name: "Xác nhận" }))
    expect(h.mutate).toHaveBeenCalledWith({ days: 90, expected: 60 })
  })

  it("CONFLICT → nạp lại cấu hình", () => {
    renderForm()
    act(() => h.opts!.onError!({ message: "Số ngày dùng thử vừa được đổi ở nơi khác, tải lại để xem", data: { code: "CONFLICT" } }))
    expect(h.invalidate).toHaveBeenCalledTimes(1)
  })
})
