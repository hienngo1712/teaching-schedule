/**
 * @vitest-environment jsdom
 */
// QA gói AT: ca biên hộp phiếu (lưu đôi, khoá nút khi đang chờ lưu, đóng hộp khi chưa lưu).
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { TuitionNoticeDialog } from "@/components/tuition/TuitionNoticeDialog"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { saveAs } from "file-saver"

vi.mock("file-saver", () => ({ saveAs: vi.fn() }))
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }))
vi.mock("@/lib/share-image", () => ({
  canShareFiles: vi.fn(() => false),
  elementToPngBlob: vi.fn(() => Promise.resolve(new Blob(["x"]))),
  shareOrDownloadPng: vi.fn(),
}))
vi.mock("qrcode", () => ({ toDataURL: () => Promise.resolve("data:image/png;base64,x") }))

const h = vi.hoisted(() => ({
  saveMutate: vi.fn(),
  gate: { locked: false, allowed: true, openUpgrade: vi.fn() },
  linkProps: [] as unknown[],
}))

vi.mock("@/hooks/useFeatureGate", () => ({ useFeatureGate: () => h.gate }))
vi.mock("@/components/students/ParentLinkDialog", () => ({
  ParentLinkDialog: (props: { student: unknown; canGenerate?: boolean }) => {
    h.linkProps.push(props)
    return <div data-testid="parent-link-dialog" />
  },
}))

let data: Record<string, unknown>
let updatedAt = 1
let saveOpts: { onSuccess?: () => void; onError?: () => void } = {}
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ tuition: { getMonthlyStatus: { invalidate: vi.fn() } }, client: { tuition: { setNoticeSent: { mutate: vi.fn() } } } }),
    tuition: {
      getNotice: { useQuery: () => ({ data, isError: false, dataUpdatedAt: updatedAt, refetch: vi.fn() }) },
      setNoticeSent: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      saveParentComment: {
        useMutation: (opts?: typeof saveOpts) => {
          saveOpts = opts ?? {}
          return { mutate: h.saveMutate, isPending: false }
        },
      },
    },
  },
}))

function notice(over: Record<string, unknown> = {}) {
  return {
    studentId: 1, fullName: "Nguyễn Văn A", grade: 5, year: 2026, month: 10, presentSessions: 0, totalSessions: 0,
    billingMode: "per_session", currentMonthFee: 0, previousBalance: 0, totalAmountDue: 0, paidAmount: 0,
    isFullPaid: false, presentDates: [], payments: [], remaining: 0, overpaid: 0, teacherName: "GV",
    bankConfigured: false, qr: null, parentComment: null, parentLinkToken: null, placeId: null, ...over,
  }
}

const ui = () => (
  <LanguageProvider forcedLanguage="vi">
    <TuitionNoticeDialog studentId={1} year={2026} month={10} onClose={() => {}} />
  </LanguageProvider>
)
const renderDialog = () => render(ui())

beforeEach(() => {
  vi.clearAllMocks()
  h.gate = { locked: false, allowed: true, openUpgrade: vi.fn() }
  h.linkProps = []
  updatedAt = 1
  saveOpts = {}
  window.URL.createObjectURL = vi.fn().mockReturnValue("blob:x")
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
})

describe("TuitionNoticeDialog — ca biên QA (AT)", () => {
  it("blur rồi bấm Tải ảnh ngay (thao tác thật: bấm nút làm ô mất focus) → chỉ lưu 1 lần, nút xuất khoá trong lúc chờ", async () => {
    data = notice({ parentComment: null })
    renderDialog()
    const dl = screen.getByRole("button", { name: /Tải ảnh/ })
    await waitFor(() => expect(dl.hasAttribute("disabled")).toBe(false))
    const box = screen.getByLabelText(/Nhận xét tháng/)
    fireEvent.change(box, { target: { value: "Con ngoan" } })
    fireEvent.blur(box)
    fireEvent.click(dl)
    expect(h.saveMutate).toHaveBeenCalledTimes(1)
    expect(saveAs).not.toHaveBeenCalled()
    expect(dl.hasAttribute("disabled")).toBe(true)
  })

  it("xoá hết nhận xét (chỉ còn khoảng trắng) rồi blur → gửi chuỗi rỗng để xoá", () => {
    data = notice({ parentComment: "Cũ" })
    renderDialog()
    const box = screen.getByLabelText(/Nhận xét tháng/)
    fireEvent.change(box, { target: { value: "   " } })
    fireEvent.blur(box)
    expect(h.saveMutate).toHaveBeenCalledWith({ studentId: 1, year: 2026, month: 10, parentComment: "" })
  })

  it("lưu lỗi rồi blur lại cùng nội dung → được gửi lại (không bị ref chặn)", () => {
    data = notice({ parentComment: null })
    renderDialog()
    const box = screen.getByLabelText(/Nhận xét tháng/)
    fireEvent.change(box, { target: { value: "X" } })
    fireEvent.blur(box)
    saveOpts.onError?.()
    fireEvent.blur(box)
    expect(h.saveMutate).toHaveBeenCalledTimes(2)
  })

  // [BUG QA-1] Đóng hộp bằng Esc (Radix không bắn blur khi gỡ ô) → nhận xét chưa lưu bị mất.
  // TuitionDetailSheet (mẫu LEADER chỉ định) có lưu lúc unmount (spec AR B2); hộp phiếu thì không.
  // Đang là it.fails để ghi nhận lỗi; DEV sửa xong thì đổi thành it.
  it.fails("[BUG QA-1] gõ nhận xét rồi đóng hộp (unmount, không có blur) → vẫn lưu nhận xét", () => {
    data = notice({ parentComment: null })
    const { unmount } = renderDialog()
    fireEvent.change(screen.getByLabelText(/Nhận xét tháng/), { target: { value: "Chưa kịp lưu" } })
    unmount()
    expect(h.saveMutate).toHaveBeenCalledTimes(1)
  })
})
