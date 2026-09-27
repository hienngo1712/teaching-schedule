import type { KeyboardEvent } from "react"

// Mẫu WAI-ARIA radio: mũi tên chuyển focus và chọn luôn radio kế tiếp (bỏ radio disabled, quay vòng). Gắn vào div[role=radiogroup].
export function handleRadioGroupKeyDown(e: KeyboardEvent<HTMLElement>): void {
  const radios = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not([disabled])'))
  if (radios.length === 0) return
  const last = radios.length - 1
  const cur = radios.indexOf(document.activeElement as HTMLElement)
  let next: number
  switch (e.key) {
    case "ArrowRight":
    case "ArrowDown":
      next = cur >= last ? 0 : cur + 1
      break
    case "ArrowLeft":
    case "ArrowUp":
      next = cur <= 0 ? last : cur - 1
      break
    case "Home":
      next = 0
      break
    case "End":
      next = last
      break
    default:
      return
  }
  e.preventDefault()
  radios[next].focus()
  radios[next].click()
}
