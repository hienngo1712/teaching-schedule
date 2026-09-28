/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { DeleteAccountDialog } from "@/components/admin/DeleteAccountDialog"
import { toast } from "sonner"

type Opts = { onSuccess?: () => void; onError?: (e: { message: string }) => void }
const mockDel = vi.hoisted(() => ({
  mutate: vi.fn(),
  opts: null as null | Opts,
  isPending: false,
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      admin: {
        overview: { invalidate: vi.fn() },
        deletedUsers: { invalidate: vi.fn() },
      },
    }),
    admin: {
      deleteUser: {
        useMutation: (opts?: Opts) => {
          mockDel.opts = opts ?? null
          return {
            mutate: (args: { userId: number }) => {
              mockDel.mutate(args)
            },
            isPending: mockDel.isPending,
          }
        },
      },
    },
  },
}))

const USER = { id: 7, username: "teacher_x" }

function renderDialog(onOpenChange = vi.fn()) {
  render(
    <LanguageProvider forcedLanguage="vi">
      <DeleteAccountDialog user={USER} onOpenChange={onOpenChange} />
    </LanguageProvider>
  )
  return onOpenChange
}

describe("DeleteAccountDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDel.isPending = false
    mockDel.opts = null
  })

  it("hiện alertdialog tiêu đề 'Xoá tài khoản teacher_x?' và câu mô tả", () => {
    renderDialog()
    expect(screen.getByRole("alertdialog").textContent).toContain("Xoá tài khoản teacher_x?")
    expect(screen.getByRole("alertdialog").textContent).toContain("Tài khoản bị đăng xuất ngay")
  })

  it("bấm 'Xoá tài khoản' → mutate({ userId: 7 }); onSuccess → toast.success và onOpenChange(false)", () => {
    const onOpenChange = renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Xoá tài khoản" }))
    expect(mockDel.mutate).toHaveBeenCalledWith({ userId: 7 })

    mockDel.opts?.onSuccess?.()
    expect(toast.success).toHaveBeenCalledWith("Đã xoá tài khoản teacher_x")
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("isPending → nút xác nhận disabled", () => {
    mockDel.isPending = true
    renderDialog()
    const delBtn = screen.getByRole("button", { name: "Xoá tài khoản" })
    expect((delBtn as HTMLButtonElement).disabled).toBe(true)
  })

  it("bấm 'Hủy' → onOpenChange(false), không mutate", () => {
    const onOpenChange = renderDialog()
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(mockDel.mutate).not.toHaveBeenCalled()
  })
})
