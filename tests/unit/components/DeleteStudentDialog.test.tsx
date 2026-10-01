/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { DeleteStudentDialog } from "@/components/students/DeleteStudentDialog"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const q = vi.hoisted(() => ({
  data: undefined as unknown,
  isPending: false,
  isError: false,
  refetch: vi.fn(),
}))
const del = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }))
const mockDeleteCheckQuery = vi.hoisted(() => vi.fn(() => q))

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ student: { list: { invalidate: vi.fn() } }, trash: { counts: { invalidate: vi.fn() } } }),
    student: {
      deleteCheck: { useQuery: (input?: unknown, opts?: unknown) => mockDeleteCheckQuery(input, opts) },
      delete: { useMutation: () => del },
    },
  },
}))

const student = { id: 7, fullName: "QA Trần Thị Bình", isActive: true }
const renderIt = () =>
  render(
    <LanguageProvider>
      <DeleteStudentDialog student={student} onOpenChange={() => {}} />
    </LanguageProvider>
  )

describe("DeleteStudentDialog (spec R mục 3)", () => {
  beforeEach(() => {
    q.data = undefined
    q.isPending = false
    q.isError = false
    del.mutate.mockReset()
  })

  it("đang kiểm → nút Xóa disabled, chữ Đang kiểm tra", () => {
    q.isPending = true
    renderIt()
    expect((screen.getByRole("button", { name: /Đang kiểm tra/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it("allowed → mô tả Thùng rác + giữ tiền, bấm Xóa gọi delete", () => {
    q.data = { allowed: true }
    renderIt()
    expect(screen.getByText(/Tiền đã thu vẫn được giữ trong Báo cáo/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Xóa" }))
    expect(del.mutate).toHaveBeenCalledWith({ id: 7 })
  })

  it("active_with_data → báo không xóa được, chỉ nút Đóng", () => {
    q.data = { allowed: false, reason: "active_with_data" }
    renderIt()
    expect(screen.getByText(/đang học và đã có buổi học hoặc lần thu/)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Đóng" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Xóa" })).toBeNull()
  })

  it("debt → báo còn nợ đúng số, chỉ nút Đóng", () => {
    q.data = { allowed: false, reason: "debt", debt: 2_250_000 }
    renderIt()
    expect(screen.getByText(/còn nợ 2\.250\.000/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Xóa" })).toBeNull()
  })

  it("không còn nút Cho nghỉ thay", () => {
    q.data = { allowed: false, reason: "debt", debt: 100_000 }
    renderIt()
    expect(screen.queryByRole("button", { name: /nghỉ thay/i })).toBeNull()
  })

  it("lỗi tải → nút Thử lại gọi refetch", () => {
    q.isError = true
    renderIt()
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }))
    expect(q.refetch).toHaveBeenCalled()
  })

  it("U16: DeleteStudentDialog gọi student.deleteCheck.useQuery với option staleTime: 0", () => {
    renderIt()
    expect(mockDeleteCheckQuery).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7 }),
      expect.objectContaining({ staleTime: 0 })
    )
  })
})
