"use client"

import { useEffect, useRef } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { SKIP_GLOBAL_INVALIDATE } from "@/components/providers/TRPCProvider"
import { trpc } from "@/lib/trpc"
import { CHAT_POLL_MS } from "@/lib/chat"
import { ChatComposer } from "./ChatComposer"
import { ChatMessageList } from "./ChatMessageList"

export function ChatSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const query = trpc.chat.messages.useInfiniteQuery(
    {},
    { getNextPageParam: (last) => last.nextCursor ?? undefined, refetchInterval: CHAT_POLL_MS.thread }
  )
  const send = trpc.chat.send.useMutation({
    meta: SKIP_GLOBAL_INVALIDATE,
    onSuccess: () => utils.chat.messages.invalidate(),
    onError: (e) => toast.error(t(e.message === "CHAT_LIMIT" ? "chat_limit" : "chat_send_error")),
  })
  const { mutate: markRead } = trpc.chat.markRead.useMutation({
    meta: SKIP_GLOBAL_INVALIDATE,
    onSuccess: () => utils.chat.unread.setData(undefined, { count: 0 }),
  })

  // pages[0] là trang mới nhất; mỗi trang đã xếp cũ → mới.
  const pages = query.data?.pages ?? []
  const items = [...pages].reverse().flatMap((p) => p.items)
  const newestAdminId = items.reduce((max, m) => (m.fromAdmin && m.id > max ? m.id : max), 0)
  const markedUpTo = useRef(0)

  useEffect(() => {
    if (newestAdminId > markedUpTo.current) {
      markedUpTo.current = newestAdminId
      markRead()
    }
  }, [newestAdminId, markRead])

  return (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4 text-left">
          <SheetTitle>{t("chat_title")}</SheetTitle>
          <SheetDescription>{t("chat_desc")}</SheetDescription>
        </SheetHeader>
        {query.isPending ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-slate-400" />
          </div>
        ) : query.isError && !query.data ? (
          <div className="flex-1 p-6 text-center text-sm text-slate-600">
            {t("load_error")}{" "}
            <Button variant="link" onClick={() => query.refetch()}>{t("retry")}</Button>
          </div>
        ) : (
          <ChatMessageList
            items={items}
            viewer="teacher"
            otherReadAt={pages[0]?.otherReadAt ?? null}
            hasOlder={query.hasNextPage}
            loadingOlder={query.isFetchingNextPage}
            onLoadOlder={() => query.fetchNextPage()}
            emptyText={t("chat_empty")}
          />
        )}
        <ChatComposer pending={send.isPending} onSend={(body) => send.mutateAsync({ body })} />
      </SheetContent>
    </Sheet>
  )
}
