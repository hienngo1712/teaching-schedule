import { useState } from "react"
import html2canvas from "html2canvas"

export function useExport() {
  const [isCapturing, setIsCapturing] = useState(false)

  const captureElement = async (element: HTMLElement | null, filename: string) => {
    if (!element) return

    try {
      setIsCapturing(true)
      
      // Thêm class để ẩn các element không muốn chụp (như nút bấm)
      element.classList.add("exporting")
      
      const canvas = await html2canvas(element, {
        scale: 2, // Tăng chất lượng ảnh
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      })
      
      element.classList.remove("exporting")
      
      const image = canvas.toDataURL("image/png")
      const link = document.createElement("a")
      link.href = image
      link.download = `${filename}.png`
      link.click()
    } catch (error) {
      console.error("Lỗi khi chụp ảnh:", error)
    } finally {
      setIsCapturing(false)
    }
  }

  return {
    isCapturing,
    captureElement,
  }
}
