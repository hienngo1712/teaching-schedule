"use client"

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { httpBatchLink } from "@trpc/client"
import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { planRequiredOf } from "@/lib/plans"
import { openUpgrade } from "@/components/plan/upgrade-store"

// Mutation gửi liên tục (chat) tự làm mới query của mình, không tải lại cả app (spec AC §5.1).
export const SKIP_GLOBAL_INVALIDATE = { skipGlobalInvalidate: true } as const

export function shouldInvalidateAll(meta: unknown): boolean {
  return !(typeof meta === "object" && meta !== null && (meta as { skipGlobalInvalidate?: unknown }).skipGlobalInvalidate === true)
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      // Bất kỳ mutation nào thành công → làm mới TOÀN BỘ query, trừ mutation có SKIP_GLOBAL_INVALIDATE.
      // Nhờ vậy không cần (và không lo quên) invalidate thủ công ở từng màn.
      mutationCache: new MutationCache({
        onSuccess: (_data, _variables, _context, mutation) => {
          if (shouldInvalidateAll(mutation.options.meta)) client.invalidateQueries()
        },
        // D15: lỗi thiếu gói lọt qua UI → mở popup nâng cấp dùng chung.
        onError: (error) => {
          const plan = planRequiredOf(error)
          if (plan) openUpgrade({ plan })
        },
      }),
      defaultOptions: {
        queries: {
          // Dữ liệu ít thay đổi → cache lâu hơn, tránh refetch không cần thiết.
          staleTime: 60 * 1000,
          gcTime: 5 * 60 * 1000,
          refetchOnWindowFocus: false,
          // Vào lại màn mà data đã stale (vd vừa bị mutation đánh dấu) → fetch lại.
          refetchOnMount: true,
          refetchOnReconnect: false,
          retry: 1,
        },
        mutations: {
          retry: 0,
        },
      },
    })
    return client
  })

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
        }),
      ],
    })
  )

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  )
}
