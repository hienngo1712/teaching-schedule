"use client"

import { useEffect, useRef } from "react"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { SKIP_GLOBAL_INVALIDATE } from "@/components/providers/TRPCProvider"
import { ChatComposer } from "@/components/chat/ChatComposer"
import { ChatMessageList } from "@/components/chat/ChatMessageList"
import { trpc } from "@/lib/trpc"
import { CHAT_POLL_MS } from "@/lib/chat"

export function AdminChatThread({ userId, title, onBack }: { userId: number; title: string; onBack: () => void }) {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const query = trpc.admin.chatMessages.useInfiniteQuery(
    { userId },
    { getNextPageParam: (last) => last.nextCursor ?? undefined, refetchInterval: CHAT_POLL_MS.thread }
  )
  const refreshLists = () => Promise.all([utils.admin.chatInbox.invalidate(), utils.admin.chatUnread.invalidate()])
  const send = trpc.admin.chatSend.useMutation({
    meta: SKIP_GLOBAL_INVALIDATE,
    onSuccess: () => Promise.all([utils.admin.chatMessages.invalidate({ userId }), refreshLists()]),
    onError: () => toast.error(t("chat_send_error")),
  })
  const { mutate: markRead } = trpc.admin.chatMarkRead.useMutation({ meta: SKIP_GLOBAL_INVALIDATE, onSuccess: refreshLists })

  const pages = query.data?.pages ?? []
  const items = [...pages].reverse().flatMap((p) => p.items)
  const newestTeacherId = items.reduce((max, m) => (!m.fromAdmin && m.id > max ? m.id : max), 0)
  const markedUpTo = useRef(0)

  useEffect(() => {
    if (newestTeacherId > markedUpTo.current) {
      markedUpTo.current = newestTeacherId
      markRead({ userId })
    }
  }, [newestTeacherId, markRead, userId])

  return (
    <>
      <div className="flex min-h-14 items-center gap-2 border-b px-2">
        <Button variant="ghost" size="icon" className="size-11 md:hidden" onClick={onBack} aria-label={t("admin_chat_back")}>
          <ArrowLeft className="size-5" />
        </Button>
        <h2 className="truncate px-1 text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      {query.isPending ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <ChatMessageList
          items={items}
          viewer="admin"
          otherReadAt={pages[0]?.otherReadAt ?? null}
          hasOlder={query.hasNextPage}
          loadingOlder={query.isFetchingNextPage}
          onLoadOlder={() => query.fetchNextPage()}
          emptyText={t("admin_chat_empty")}
        />
      )}
      <ChatComposer pending={send.isPending} onSend={(body) => send.mutateAsync({ userId, body })} />
    </>
  )
}
