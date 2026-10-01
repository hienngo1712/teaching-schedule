// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"

vi.mock("file-saver", () => ({ saveAs: vi.fn() }))

import { saveAs } from "file-saver"
import { canShareFiles, shareOrDownloadPng } from "@/lib/share-image"

function setShareSupport(share?: (data: ShareData) => Promise<void>, canShare?: () => boolean) {
  Object.defineProperty(navigator, "share", { value: share, configurable: true })
  Object.defineProperty(navigator, "canShare", { value: canShare, configurable: true })
}

const blob = new Blob(["png"], { type: "image/png" })

afterEach(() => {
  delete (navigator as { share?: unknown }).share
  delete (navigator as { canShare?: unknown }).canShare
  vi.mocked(saveAs).mockClear()
})

describe("canShareFiles", () => {
  it("trình duyệt không có canShare → false", () => {
    expect(canShareFiles()).toBe(false)
  })
  it("canShare nhận file → true", () => {
    setShareSupport(vi.fn(), () => true)
    expect(canShareFiles()).toBe(true)
  })
})

describe("shareOrDownloadPng", () => {
  it("chia sẻ được → gọi navigator.share với file PNG, không tải, trả về 'shared'", async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    setShareSupport(share, () => true)
    const result = await shareOrDownloadPng(blob, "phieu.png", "Phiếu")
    const data = share.mock.calls[0][0] as ShareData
    expect(data.title).toBe("Phiếu")
    expect(data.files?.[0].name).toBe("phieu.png")
    expect(data.files?.[0].type).toBe("image/png")
    expect(saveAs).not.toHaveBeenCalled()
    expect(result).toBe("shared")
  })

  it("người dùng huỷ (AbortError) → im lặng, không tải, trả về 'aborted'", async () => {
    setShareSupport(vi.fn().mockRejectedValue(new DOMException("x", "AbortError")), () => true)
    const result = await shareOrDownloadPng(blob, "phieu.png", "Phiếu")
    expect(saveAs).not.toHaveBeenCalled()
    expect(result).toBe("aborted")
  })

  it("NotAllowedError (iOS mất user activation) → tải file, trả về 'downloaded'", async () => {
    setShareSupport(vi.fn().mockRejectedValue(new DOMException("x", "NotAllowedError")), () => true)
    const result = await shareOrDownloadPng(blob, "phieu.png", "Phiếu")
    expect(saveAs).toHaveBeenCalledWith(blob, "phieu.png")
    expect(result).toBe("downloaded")
  })

  it("không hỗ trợ chia sẻ file → tải file, trả về 'downloaded'", async () => {
    const result = await shareOrDownloadPng(blob, "phieu.png", "Phiếu")
    expect(saveAs).toHaveBeenCalledWith(blob, "phieu.png")
    expect(result).toBe("downloaded")
  })
})
