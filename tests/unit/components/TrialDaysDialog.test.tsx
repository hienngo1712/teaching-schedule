/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { toast } from "sonner"
import type { RouterOutputs } from "@/lib/trpc"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { TrialDaysDialog } from "@/components/admin/TrialDaysDialog"
import { addDays, formatValidUntil, trialEndFor } from "@/lib/plans"
import { formatVnDate } from "@/lib/payment-notes"

type UserRow = RouterOutputs["admin"]["overview"]["users"][number]
type Change = { id: number; days: number; previousDays: number | null; changedBy: string; createdAt: string }

const h = vi.hoisted(() => ({ mutate: vi.fn(), onSuccess: null as null | (() => void), changes: [] as Change[] }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    admin: {
      userTrialChanges: { useQuery: () => ({ data: h.changes }) },
      setUserTrial: {
        useMutation: (opts: { onSuccess?: () => void }) => {
          h.onSuccess = opts.onSuccess ?? null
          return { mutate: h.mutate, isPending: false }
        },
      },
    },
  },
}))

const created50 = addDays(new Date(), -50)

function row(over: Partial<UserRow> = {}): UserRow {
  return {
    id: 7,
    username: "gv_a",
    fullName: null,
    createdAt: created50.toISOString(),
    lastLoginAt: null,
    activeStudents: 0,
    plan: "pro",
    source: "trial",
    expiresAt: null,
    trialEndsAt: trialEndFor(created50, 60)!.toISOString(),
    isAdmin: false,
    ...over,
  } as UserRow
}

function renderDialog(user: UserRow, onClose = vi.fn()) {
  render(
    <LanguageProvider forcedLanguage="vi">
      <TrialDaysDialog user={user} onClose={onClose} />
    </LanguageProvider>
  )
  return onClose
}
const input = () => screen.getByRole("textbox", { name: "Số ngày dùng thử (tính từ ngày tạo tài khoản)" }) as HTMLInputElement
const saveBtn = () => screen.getByRole("button", { name: "Lưu" }) as HTMLButtonElement
const dialogText = () => screen.getByRole("dialog").textContent ?? ""

beforeEach(() => {
  vi.clearAllMocks()
  h.changes = []
  h.onSuccess = null
})

describe("TrialDaysDialog", () => {
  it("hiện ngày tạo + số ngày hiện tại; gõ 120 → hạn mới dd/mm/yyyy + còn 70 ngày; Lưu gửi userId + days", () => {
    renderDialog(row())
    expect(dialogText()).toContain(`Ngày tạo: ${formatVnDate(created50)}`)
    expect(dialogText()).toContain(`Hiện tại: 60 ngày, dùng đến hết ngày ${formatValidUntil(trialEndFor(created50, 60)!)}`)
    expect(input().value).toBe("60")
    expect(saveBtn().disabled).toBe(true)
    fireEvent.change(input(), { target: { value: "120" } })
    const preview = screen.getByTestId("trial-preview").textContent ?? ""
    expect(preview).toContain(`Hạn dùng thử mới: dùng đến hết ngày ${formatValidUntil(trialEndFor(created50, 120)!)}`)
    expect(preview).toContain("Còn 70 ngày dùng thử")
    fireEvent.click(saveBtn())
    expect(h.mutate).toHaveBeenCalledWith({ userId: 7, days: 120 })
  })

  it("Review Focus 4: tài khoản cũ chưa có dùng thử, tạo 400 ngày trước; gõ 90 → báo hạn đã qua, vẫn cho Lưu", () => {
    renderDialog(row({ createdAt: addDays(new Date(), -400).toISOString(), trialEndsAt: null }))
    expect(dialogText()).toContain("Chưa có dùng thử")
    expect(input().value).toBe("")
    expect(screen.queryByTestId("trial-preview")).toBeNull()
    fireEvent.change(input(), { target: { value: "90" } })
    expect(screen.getByTestId("trial-preview").textContent).toContain("Hạn này đã qua, tài khoản không còn dùng thử")
    expect(saveBtn().disabled).toBe(false)
  })

  it("0 → Không dùng thử; 4000 → lỗi khoảng, Lưu khóa", () => {
    renderDialog(row())
    fireEvent.change(input(), { target: { value: "0" } })
    expect(screen.getByTestId("trial-preview").textContent).toContain("Không dùng thử")
    fireEvent.change(input(), { target: { value: "4000" } })
    expect(dialogText()).toContain("Số ngày từ 0 đến 3650")
    expect(saveBtn().disabled).toBe(true)
  })

  it("lần đặt gần đây hiện ai, lúc nào, cũ → mới; Lưu xong → toast + đóng", () => {
    h.changes = [{ id: 1, days: 120, previousDays: 60, changedBy: "admin_test", createdAt: "2026-09-27T03:05:00.000Z" }]
    const onClose = renderDialog(row())
    expect(dialogText()).toContain("admin_test · 27/09/2026 10:05 · 60 → 120 ngày")
    act(() => h.onSuccess!())
    expect(toast.success).toHaveBeenCalledWith("Đã đặt số ngày dùng thử")
    expect(onClose).toHaveBeenCalled()
  })
})
