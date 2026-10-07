"use client"

import { useState } from "react"
import { MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc } from "@/lib/trpc"
import { CHAT_POLL_MS } from "@/lib/chat"
import { ChatSheet } from "./ChatSheet"

export function ChatButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const count = trpc.chat.unread.useQuery(undefined, { refetchInterval: CHAT_POLL_MS.unread }).data?.count ?? 0
  const label = count > 0 ? t("chat_open_unread").replace("{n}", String(count)) : t("chat_open")

  return (
    <>
      <Button variant="outline" size="icon" className="relative size-11 text-slate-600 md:size-10" aria-label={label} onClick={() => setOpen(true)}>
        <MessageCircle className="size-5" />
        {count > 0 && (
          <span
            data-testid="chat-unread"
            aria-hidden
            className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-amber-100 px-1 text-center text-[11px] font-semibold leading-5 text-amber-800"
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Button>
      {open && <ChatSheet onClose={() => setOpen(false)} />}
    </>
  )
}
