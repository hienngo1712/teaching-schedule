import { useSyncExternalStore } from "react"
import type { PaidPlan } from "@/lib/plans"

export type UpgradeRequest = { plan: PaidPlan; message?: string }

let current: UpgradeRequest | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

// Store module thay vì context: TRPCProvider (ngoài LanguageProvider/AppLayout) cũng mở được popup.
export function openUpgrade(req: UpgradeRequest) {
  current = req
  emit()
}

export function closeUpgrade() {
  current = null
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useUpgradeRequest(): UpgradeRequest | null {
  return useSyncExternalStore(subscribe, () => current, () => null)
}
