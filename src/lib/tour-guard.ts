// Khung tour driver.js gắn ngoài hộp Radix; bấm vào nó không được tính là "bấm ra ngoài" làm đóng hộp.
export function isTourEvent(e: { target: EventTarget | null }): boolean {
  return e.target instanceof Element && e.target.closest(".driver-popover, .driver-overlay") !== null
}

export function keepOpenOnTour<E extends { target: EventTarget | null; preventDefault(): void }>(handler?: (e: E) => void) {
  return (e: E) => {
    if (isTourEvent(e)) e.preventDefault()
    else handler?.(e)
  }
}
