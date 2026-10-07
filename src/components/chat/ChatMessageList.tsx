"use client"

import { useEffect, useRef } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { chatTime } from "@/lib/chat"
import { cn } from "@/lib/utils"

export type ChatMessageView = { id: number; fromAdmin: boolean; senderName: string | null; body: string; createdAt: Date | string }

type Props = {
  items: ChatMessageView[]
  viewer: "teacher" | "admin"
  otherReadAt: Date | string | null
  hasOlder: boolean
  loadingOlder: boolean
  onLoadOlder: () => void
  emptyText: string
}

export function ChatMessageList({ items, viewer, otherReadAt, hasOlder, loadingOlder, onLoadOlder, emptyText }: Props) {
  const { t } = useTranslation()
  const boxRef = useRef<HTMLDivElement>(null)
  const isMine = (m: ChatMessageView) => (viewer === "admin" ? m.fromAdmin : !m.fromAdmin)
  const lastId = items[items.length - 1]?.id
  const lastMine = [...items].reverse().find(isMine)
  const seen = lastMine && otherReadAt !== null && new Date(otherReadAt).getTime() >= new Date(lastMine.createdAt).getTime()

  // Chỉ cuộn xuống khi có tin mới nhất đổi; tải tin cũ không kéo người đọc đi.
  useEffect(() => {
    const box = boxRef.current
    if (box) box.scrollTop = box.scrollHeight
  }, [lastId])

  return (
    <div ref={boxRef} role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto bg-page p-3">
      {hasOlder && (
        <div className="flex justify-center">
          <Button variant="outline" className="h-11 md:h-9" onClick={onLoadOlder} disabled={loadingOlder}>
            {loadingOlder && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("chat_load_older")}
          </Button>
        </div>
      )}
      {items.length === 0 ? (
        <p className="pt-10 text-center text-sm text-slate-500">{emptyText}</p>
      ) : (
        items.map((m) => {
          const mine = isMine(m)
          return (
            <div key={m.id} data-testid="chat-message" data-mine={mine} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
              {!mine && viewer === "teacher" && <span className="mb-0.5 text-xs font-medium text-primary">{t("chat_support")}</span>}
              <p
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm",
                  mine ? "bg-primary text-primary-foreground" : "bg-slate-100 text-slate-900"
                )}
              >
                {m.body}
              </p>
              <span className="mt-0.5 text-[11px] text-slate-500">
                {viewer === "admin" && m.fromAdmin && m.senderName ? (
                  <>
                    <span>{m.senderName}</span>
                    {" · "}
                  </>
                ) : null}
                {chatTime(m.createdAt)}
              </span>
              {m.id === lastMine?.id && seen && <span className="text-[11px] text-slate-500">{t("chat_seen")}</span>}
            </div>
          )
        })
      )}
    </div>
  )
}
