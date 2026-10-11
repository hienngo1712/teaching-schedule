/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

const state = vi.hoisted(() => ({ mutate: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ admin: { overview: { invalidate: vi.fn() }, deletedUsers: { invalidate: vi.fn() } } }),
    admin: { purgeUser: { useMutation: () => ({ mutate: state.mutate, isPending: false }) } },
  },
}))

import { PurgeAccountDialog } from "@/components/admin/PurgeAccountDialog"

beforeEach(() => vi.clearAllMocks())

function renderDialog() {
  render(
    <LanguageProvider forcedLanguage="vi">
      <PurgeAccountDialog user={{ id: 7, username: "gv_Lan" }} onOpenChange={() => undefined} />
    </LanguageProvider>
  )
}

// Spec AQ §6 + Review Focus 5: nút đỏ chỉ bật khi gõ đúng nguyên văn tên đăng nhập.
describe("PurgeAccountDialog", () => {
  it("tiêu đề + mô tả; nút chỉ bật khi gõ khớp nguyên văn", () => {
    renderDialog()
    expect(screen.getByText("Xoá vĩnh viễn gv_Lan?")).toBeTruthy()
    expect(screen.getByText(/Không khôi phục được/)).toBeTruthy()
    const input = screen.getByLabelText("Gõ gv_Lan để xác nhận")
    const button = () => screen.getByRole("button", { name: "Xoá vĩnh viễn" }) as HTMLButtonElement
    expect(button().disabled).toBe(true)
    for (const typed of ["gv_lan", " gv_Lan", "gv_Lan ", "gv_La"]) {
      fireEvent.change(input, { target: { value: typed } })
      expect(button().disabled, typed).toBe(true)
    }
    fireEvent.change(input, { target: { value: "gv_Lan" } })
    expect(button().disabled).toBe(false)
    fireEvent.click(button())
    expect(state.mutate).toHaveBeenCalledWith({ userId: 7, confirmUsername: "gv_Lan" })
  })
})
