import { useSyncExternalStore } from "react"

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
