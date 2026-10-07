"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/common/PageHeader"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc } from "@/lib/trpc"
import { CHAT_POLL_MS, chatTime } from "@/lib/chat"
import { CHAT_INBOX_PAGE } from "@/lib/schemas/chat"
import { cn } from "@/lib/utils"
import { AdminChatThread } from "./AdminChatThread"

export function AdminChat() {
  const { t } = useTranslation()
  const [limit, setLimit] = useState(CHAT_INBOX_PAGE)
  const [selected, setSelected] = useState<{ userId: number; title: string } | null>(null)
  const inbox = trpc.admin.chatInbox.useQuery({ limit }, { refetchInterval: CHAT_POLL_MS.inbox, placeholderData: (prev) => prev })

  const list = inbox.isPending ? (
    <Loader2 className="mx-auto mt-6 size-6 animate-spin text-slate-400" />
  ) : inbox.isError || !inbox.data ? (
    <div className="p-4 text-center text-sm text-slate-600">
      {t("load_error")}{" "}
      <Button variant="link" onClick={() => inbox.refetch()}>{t("retry")}</Button>
    </div>
  ) : inbox.data.items.length === 0 ? (
    <p className="p-6 text-center text-sm text-slate-500">{t("admin_chat_empty")}</p>
  ) : (
    <ul className="divide-y">
      {inbox.data.items.map((c) => (
        <li key={c.userId}>
          <button
            data-testid="admin-chat-item"
            onClick={() => setSelected({ userId: c.userId, title: c.fullName ?? c.username })}
            className={cn(
              "flex min-h-14 w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-50",
              selected?.userId === c.userId && "bg-primary/[0.06]"
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className={cn("truncate text-sm", c.unread > 0 ? "font-semibold text-slate-900" : "font-medium text-slate-700")}>
                  {c.fullName ?? c.username}
                  {c.fullName && <span className="ml-1 font-normal text-slate-500">{c.username}</span>}
                </span>
                <span className="shrink-0 text-xs text-slate-500">{chatTime(c.lastMessageAt)}</span>
              </span>
              <span className="mt-0.5 flex items-center justify-between gap-2">
                <span className="truncate text-sm text-slate-500">
                  {c.lastFromAdmin ? `${t("chat_you")} ` : ""}
                  {c.preview}
                </span>
                {c.unread > 0 && (
                  <span className="shrink-0 rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold leading-5 text-amber-800">{c.unread}</span>
                )}
              </span>
            </span>
          </button>
        </li>
      ))}
      {inbox.data.hasMore && (
        <li className="p-3 text-center">
          <Button variant="outline" className="h-11 md:h-9" onClick={() => setLimit((n) => n + CHAT_INBOX_PAGE)}>
            {t("admin_feedback_more")}
          </Button>
        </li>
      )}
    </ul>
  )

  return (
    <div className="space-y-4">
      <PageHeader title={t("admin_chat")} />
      {/* Chiều cao cố định để 2 cột cuộn riêng; trừ header 56/64px, tiêu đề trang và tab bar mobile. */}
      <div className="flex h-[calc(100dvh-13rem)] min-h-[420px] overflow-hidden rounded-xl border bg-white md:h-[calc(100dvh-11rem)]">
        <div className={cn("w-full overflow-y-auto md:block md:w-80 md:shrink-0 md:border-r", selected && "hidden")}>{list}</div>
        <div className={cn("min-w-0 flex-1 flex-col", selected ? "flex" : "hidden md:flex")}>
          {selected ? (
            <AdminChatThread key={selected.userId} userId={selected.userId} title={selected.title} onBack={() => setSelected(null)} />
          ) : (
            <p className="m-auto p-6 text-center text-sm text-slate-500">{t("admin_chat_pick")}</p>
          )}
        </div>
      </div>
    </div>
  )
}
