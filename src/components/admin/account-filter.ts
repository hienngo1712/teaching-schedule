import { vnDayKey } from "@/lib/activity"
import { normalizeForSearch } from "@/lib/name-search"

export type AccountSort = "newest" | "oldest"
// from/to: "yyyy-MM-dd" theo ngày VN, bao gồm cả 2 đầu.
export type AccountFilter = { search: string; from: string | null; to: string | null; sort: AccountSort }

export const DEFAULT_ACCOUNT_FILTER: AccountFilter = { search: "", from: null, to: null, sort: "newest" }

// Spec AR §1: overview đã trả đủ tài khoản nên lọc + sắp phía client.
export function filterAccounts<T extends { id: number; username: string; fullName: string | null; createdAt: Date | string }>(
  rows: T[],
  f: AccountFilter
): T[] {
  const term = normalizeForSearch(f.search.trim())
  const dir = f.sort === "newest" ? -1 : 1
  return rows
    .map((r) => ({ r, time: new Date(r.createdAt).getTime() }))
    .filter(({ r, time }) => {
      if (term && !normalizeForSearch(r.username).includes(term) && !normalizeForSearch(r.fullName ?? "").includes(term)) return false
      // So theo ngày VN: tài khoản tạo 0h–7h sáng VN vẫn đúng ngày (RF 1).
      const day = vnDayKey(new Date(time))
      return (!f.from || day >= f.from) && (!f.to || day <= f.to)
    })
    .sort((a, b) => dir * (a.time - b.time || a.r.id - b.r.id))
    .map(({ r }) => r)
}
