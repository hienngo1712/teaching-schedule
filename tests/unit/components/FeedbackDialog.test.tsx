/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { toast } from "sonner"

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

let pathname = "/students"
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const mutate = vi.fn()
const setPromptData = vi.fn()
let mutationOpts: { onSuccess?: () => void; onError?: (e: { data?: { code: string }; message: string }) => void } = {}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ feedback: { promptStatus: { setData: setPromptData } } }),
    feedback: {
      submit: {
        useMutation: (opts: typeof mutationOpts) => {
          mutationOpts = opts ?? {}
          return { mutate, isPending: false }
        },
      },
    },
  },
}))

describe("FeedbackDialog", () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mutationOpts = {}
    pathname = "/students"
  })

  function ui(props: { prompted?: boolean } = {}) {
    return (
      <LanguageProvider forcedLanguage="vi">
        <FeedbackDialog onClose={onClose} prompted={props.prompted} />
      </LanguageProvider>
    )
  }

  it("chưa chọn sao thì Gửi bị tắt; chọn 4 sao rồi gửi đúng dữ liệu", () => {
    render(ui())
    const send = screen.getByRole("button", { name: "Gửi" })
    expect(send).toHaveProperty("disabled", true)
    fireEvent.click(screen.getByRole("radio", { name: "4 sao" }))
    fireEvent.change(screen.getByLabelText(/Cần thêm gì, sửa gì/), { target: { value: "Thêm báo cáo năm" } })
    fireEvent.click(send)
    expect(mutate).toHaveBeenCalledWith({ rating: 4, message: "Thêm báo cáo năm", page: "/students" })
  })

  it("bàn phím: mũi tên phải/trái đổi sao, chặn ở 1 và 5", () => {
    render(ui())
    const group = screen.getByRole("radiogroup", { name: "Chấm điểm" })
    fireEvent.click(screen.getByRole("radio", { name: "5 sao" }))
    fireEvent.keyDown(group, { key: "ArrowRight" })
    expect(screen.getByRole("radio", { name: "5 sao" }).getAttribute("aria-checked")).toBe("true")
    fireEvent.keyDown(group, { key: "ArrowLeft" })
    expect(screen.getByRole("radio", { name: "4 sao" }).getAttribute("aria-checked")).toBe("true")
  })

  it("đếm ký tự, tối đa 1000", () => {
    render(ui())
    const box = screen.getByLabelText(/Cần thêm gì, sửa gì/)
    expect(box.getAttribute("maxLength")).toBe("1000")
    fireEvent.change(box, { target: { value: "abc" } })
    expect(screen.getByText("3/1000")).toBeTruthy()
  })

  it("gửi xong: toast cảm ơn, onClose(true)", () => {
    render(ui())
    fireEvent.click(screen.getByRole("radio", { name: "3 sao" }))
    fireEvent.click(screen.getByRole("button", { name: "Gửi" }))
    mutationOpts.onSuccess?.()
    expect(toast.success).toHaveBeenCalledWith("Cảm ơn thầy cô đã góp ý!")
    expect(onClose).toHaveBeenCalledWith(true)
  })

  it("quá giới hạn: báo câu riêng, không đóng", () => {
    render(ui())
    mutationOpts.onError?.({ data: { code: "TOO_MANY_REQUESTS" }, message: "FEEDBACK_LIMIT" })
    expect(toast.error).toHaveBeenCalledWith("Thầy cô đã gửi nhiều góp ý hôm nay, mai gửi tiếp nhé")
    expect(onClose).not.toHaveBeenCalled()
  })

  it("prompted: có tiêu đề phụ và nút Để sau → onClose(false); không prompted thì không có Để sau", () => {
    const { unmount } = render(ui({ prompted: true }))
    expect(screen.getByText("Thầy cô thấy app thế nào?")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Để sau" }))
    expect(onClose).toHaveBeenCalledWith(false)
    unmount()
    render(ui())
    expect(screen.queryByRole("button", { name: "Để sau" })).toBeNull()
  })

  it("gửi xong từ menu → cache promptStatus thành false (không tự hỏi nữa)", () => {
    render(ui())
    mutationOpts.onSuccess!()
    expect(setPromptData).toHaveBeenCalledWith(undefined, { shouldPrompt: false })
  })

  it("đường dẫn dài hơn 100 ký tự → cắt còn 100, không để server từ chối", () => {
    pathname = "/" + "a".repeat(150)
    render(ui())
    fireEvent.click(screen.getByRole("radio", { name: "5 sao" }))
    fireEvent.click(screen.getByRole("button", { name: "Gửi" }))
    expect(mutate.mock.calls[0][0].page).toHaveLength(100)
  })

  it("lỗi khác giới hạn → báo câu chung, không hiện nội dung lỗi kỹ thuật", () => {
    render(ui())
    mutationOpts.onError!({ data: { code: "BAD_REQUEST" }, message: '[{"code":"too_big"}]' })
    expect(toast.error).toHaveBeenCalledWith("Đã có lỗi xảy ra")
  })
})
