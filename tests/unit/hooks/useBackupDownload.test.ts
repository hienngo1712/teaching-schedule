/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"

vi.mock("file-saver", () => ({ saveAs: vi.fn() }))
vi.mock("sonner", () => ({ toast: { promise: vi.fn() } }))
vi.mock("@/components/providers/LanguageProvider", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

import { saveAs } from "file-saver"
import { toast } from "sonner"
import { filenameFromDisposition, useBackupDownload } from "@/hooks/useBackupDownload"

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

function xlsxResponse(): Response {
  // Body dạng chuỗi: Blob của jsdom không phải Blob của undici, Response sẽ đọc sai.
  return new Response("x", {
    status: 200,
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": 'attachment; filename="SaoLuu_2026-09-25_2130.xlsx"',
    },
  })
}

describe("filenameFromDisposition", () => {
  it("lấy tên trong filename=\"...\"", () => {
    expect(filenameFromDisposition('attachment; filename="SaoLuu_2026-09-25_2130.xlsx"')).toBe(
      "SaoLuu_2026-09-25_2130.xlsx"
    )
  })

  it("không có header hoặc sai dạng → SaoLuu.xlsx", () => {
    expect(filenameFromDisposition(null)).toBe("SaoLuu.xlsx")
    expect(filenameFromDisposition("attachment")).toBe("SaoLuu.xlsx")
  })
})

describe("useBackupDownload", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("tải xong → saveAs đúng tên file, toast.promise có 3 chuỗi i18n", async () => {
    fetchMock.mockResolvedValue(xlsxResponse())
    const { result } = renderHook(() => useBackupDownload())

    act(() => result.current.download())

    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith("/api/backup")
    expect(vi.mocked(saveAs).mock.calls[0][1]).toBe("SaoLuu_2026-09-25_2130.xlsx")
    expect(toast.promise).toHaveBeenCalledWith(expect.any(Promise), {
      loading: "backup_preparing",
      success: "backup_done",
      error: "backup_error",
    })
    await waitFor(() => expect(result.current.isDownloading).toBe(false))
  })

  it("bấm 2 lần liên tiếp → chỉ 1 request", async () => {
    let resolve!: (r: Response) => void
    fetchMock.mockReturnValue(new Promise<Response>((r) => { resolve = r }))
    const { result } = renderHook(() => useBackupDownload())

    act(() => {
      result.current.download()
      result.current.download()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current.isDownloading).toBe(true)

    await act(async () => resolve(xlsxResponse()))
    await waitFor(() => expect(result.current.isDownloading).toBe(false))
  })

  it("phiên hết hạn (bị chuyển về trang login, nhận HTML 200) → báo lỗi, không lưu file", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html></html>", { status: 200, headers: { "Content-Type": "text/html" } })
    )
    const { result } = renderHook(() => useBackupDownload())

    act(() => result.current.download())

    const promise = vi.mocked(toast.promise).mock.calls[0][0] as Promise<unknown>
    await expect(promise).rejects.toThrow()
    expect(saveAs).not.toHaveBeenCalled()
  })

  it("server lỗi 500 → promise reject, không lưu file", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }))
    const { result } = renderHook(() => useBackupDownload())

    act(() => result.current.download())

    const promise = vi.mocked(toast.promise).mock.calls[0][0] as Promise<unknown>
    await expect(promise).rejects.toThrow()
    expect(saveAs).not.toHaveBeenCalled()
  })
})
