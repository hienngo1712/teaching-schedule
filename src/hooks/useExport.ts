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
        onclone: (clonedDoc) => {
          const exportedEl = clonedDoc.querySelector(".exporting") as HTMLElement
          if (exportedEl) {
            // Tắt overflow hidden ở cấp container để tránh cắt lẹm
            exportedEl.style.overflow = "visible"
            
            // Xử lý tất cả các phần tử có bo góc (Badge, Card, vv)
            const roundedElements = exportedEl.querySelectorAll('[class*="rounded"]')
            roundedElements.forEach((el) => {
              const node = el as HTMLElement
              const style = window.getComputedStyle(node)
              
              // 1. Thay thế rounded-full bằng giá trị cụ thể (html2canvas sợ 9999px)
              if (node.classList.contains("rounded-full")) {
                node.style.borderRadius = "20px"
              }
              
              // 2. Fix lỗi background tràn viền
              node.style.backgroundClip = "padding-box"
              
              // 3. Nếu là Badge (thường dùng inline-flex), chuyển về inline-block để ổn định layout
              if (style.display === "inline-flex" || node.classList.contains("inline-flex")) {
                node.style.display = "inline-block"
                node.style.textAlign = "center"
                node.style.verticalAlign = "middle"
                // Điều chỉnh line-height để chữ vẫn ở giữa
                node.style.lineHeight = "1.2"
              }

              // 4. Ép kiểu viền để html2canvas không vẽ sót
              if (style.borderWidth !== "0px") {
                node.style.borderStyle = "solid"
              }
            })
            
            // Fix các Card và Table container
            const containers = exportedEl.querySelectorAll(".overflow-hidden, .shadow-md, .shadow-sm")
            containers.forEach((c) => {
              const node = c as HTMLElement
              node.style.overflow = "visible"
              node.style.boxShadow = "none"
            })
          }
        }
      })

      const image = canvas.toDataURL("image/png")
      const link = document.createElement("a")
      link.href = image
      link.download = `${filename}.png`
      link.click()
    } catch (error) {
      console.error("Lỗi khi chụp ảnh (html2canvas):", error)
      // Hiển thị thông báo lỗi cho người dùng nếu có thể (ở đây chỉ log)
    } finally {
      // Luôn gỡ class "exporting" kể cả khi html2canvas throw — nếu không, layout
      // thật của user sẽ kẹt ở trạng thái export cho tới khi reload.
      element.classList.remove("exporting")
      setIsCapturing(false)
    }
  }

  return {
    isCapturing,
    captureElement,
  }
}
