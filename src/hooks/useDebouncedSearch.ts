import { useEffect, useRef, useState } from "react"
import { useDebounce } from "@/hooks/useDebounce"

export const SEARCH_DEBOUNCE_MS = 200

// Ô nhập giữ state local để gõ mượt; chỉ commit (đẩy URL → query) sau khi ngừng gõ SEARCH_DEBOUNCE_MS.
export function useDebouncedSearch(external: string, commit: (value: string) => void) {
  const [local, setLocal] = useState(external)
  const debounced = useDebounce(local, SEARCH_DEBOUNCE_MS)
  const committed = useRef(external)

  useEffect(() => {
    if (debounced === committed.current) return
    committed.current = debounced
    commit(debounced)
  }, [debounced, commit])

  // Giá trị ngoài đổi (xóa lọc, deep-link) → đồng bộ lại ô nhập. Bỏ qua khi URL chỉ
  // bắt kịp giá trị vừa commit, nếu không sẽ đè mất ký tự người dùng gõ tiếp.
  useEffect(() => {
    if (external === committed.current) return
    committed.current = external
    setLocal(external)
  }, [external])

  return [local, setLocal] as const
}
