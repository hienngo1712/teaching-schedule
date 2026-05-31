"use client"

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { httpBatchLink } from "@trpc/client"
import { useState } from "react"
import { trpc } from "@/lib/trpc"

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      // Bất kỳ mutation nào thành công → làm mới TOÀN BỘ query.
      // Nhờ vậy không cần (và không lo quên) invalidate thủ công ở từng màn.
      mutationCache: new MutationCache({
        onSuccess: () => {
          client.invalidateQueries()
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
