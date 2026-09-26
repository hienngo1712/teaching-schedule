/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ParentLinkDialog } from "@/components/students/ParentLinkDialog"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { UpgradeDialog } from "@/components/plan/UpgradeDialog"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/lib/trpc", () => ({
  trpc: {
    student: {
      generateParentLink: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      disableParentLink: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}))

import { toast } from "sonner"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("ParentLinkDialog", () => {
  it("clipboard.writeText lỗi (trình duyệt chặn) → hiện toast lỗi nhắc tự chọn ô link", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("blocked")) },
    })
    render(
      <LanguageProvider>
        <ParentLinkDialog
          student={{ id: 1, fullName: "HS A", parentLinkToken: "a".repeat(43) }}
          onOpenChange={() => {}}
        />
      </LanguageProvider>
    )

    fireEvent.click(screen.getByRole("button", { name: "Sao chép" }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Không tự sao chép được. Bấm vào ô link để chọn rồi tự sao chép.")
    )
  })

  it("canGenerate=false (hết Pro), HS đã có link: Tắt link vẫn bấm được; Tạo lại link có khóa, bấm mở popup Pro", async () => {
    render(
      <LanguageProvider>
        <ParentLinkDialog student={{ id: 1, fullName: "HS A", parentLinkToken: "a".repeat(43) }} canGenerate={false} onOpenChange={() => {}} />
        <UpgradeDialog />
      </LanguageProvider>
    )
    expect(screen.getByRole("button", { name: "Tắt link" }).hasAttribute("disabled")).toBe(false)
    fireEvent.click(screen.getByRole("button", { name: /Tạo lại link/ }))
    expect(await screen.findByText("Nâng lên gói Pro để sử dụng tính năng này.")).toBeTruthy()
    expect(screen.queryByText("Link cũ sẽ ngừng hoạt động. Phụ huynh cần nhận link mới.")).toBeNull()
  })
})
