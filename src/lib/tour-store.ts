import { useSyncExternalStore } from "react"

// Hộp đang mở: Dialog/Sheet lẫn hộp xác nhận AlertDialog (spec AR B3a).
export const OPEN_DIALOG_SELECTOR = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'

// Cờ "đang có tour" để WhatsNew không tự mở đè lên tour (spec AD §4.2).
let active = false
const listeners = new Set<() => void>()

export function setTourActive(v: boolean): void {
  if (active === v) return
  active = v
  listeners.forEach((l) => l())
}

export function isTourActive(): boolean {
  return active
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function useTourActive(): boolean {
  return useSyncExternalStore(subscribe, isTourActive, () => false)
}
