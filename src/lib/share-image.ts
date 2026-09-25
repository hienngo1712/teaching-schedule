import html2canvas from "html2canvas"
import { saveAs } from "file-saver"

// Sheet/Dialog trượt vào 300–500ms; chụp giữa chừng thì ảnh lệch. Bỏ qua animation vô hạn (spinner).
async function waitForFiniteAnimations(): Promise<void> {
  const running = document.getAnimations?.() ?? []
  const finite = running.filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
  await Promise.all(finite.map((a) => a.finished.catch(() => undefined)))
}

export async function elementToPngBlob(el: HTMLElement): Promise<Blob> {
  await waitForFiniteAnimations()
  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    // Bản clone nằm trong iframe mới: animation sẽ chạy lại từ đầu nếu không tắt.
    onclone: (doc) => {
      const style = doc.createElement("style")
      style.textContent = "*,*::before,*::after{animation:none!important;transition:none!important}"
      doc.head.appendChild(style)
    },
  })
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Không tạo được ảnh"))), "image/png")
  })
}

export function canShareFiles(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false
  return navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] }) === true
}

export async function shareOrDownloadPng(blob: Blob, filename: string, title: string): Promise<void> {
  if (canShareFiles()) {
    try {
      await navigator.share({ files: [new File([blob], filename, { type: "image/png" })], title })
      return
    } catch (e) {
      // Người dùng tự đóng bảng chia sẻ → không làm gì. Lỗi khác (NotAllowedError...) → tải file.
      if ((e as { name?: string })?.name === "AbortError") return
    }
  }
  saveAs(blob, filename)
}
