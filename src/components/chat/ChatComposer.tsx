"use client"

import { useState } from "react"
import { Loader2, SendHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { CHAT_BODY_MAX } from "@/lib/schemas/chat"
import { cn } from "@/lib/utils"

const COUNTER_FROM = CHAT_BODY_MAX - 200

export function ChatComposer({ onSend, pending }: { onSend: (body: string) => Promise<unknown>; pending: boolean }) {
  const { t } = useTranslation()
  const [text, setText] = useState("")
  const trimmed = text.trim()
  const tooLong = text.length > CHAT_BODY_MAX
  const canSend = trimmed.length > 0 && !tooLong && !pending

  async function submit() {
    if (!canSend) return
    try {
      await onSend(trimmed)
      setText("")
    } catch {
      // Nơi gọi đã toast; giữ chữ để gửi lại.
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      className="flex items-end gap-2 border-t bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
    >
      <div className="min-w-0 flex-1">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Gõ Telex/VNI đang ghép chữ thì Enter chỉ chốt chữ, không gửi (Safari báo keyCode 229).
            if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing || e.keyCode === 229) return
            e.preventDefault()
            void submit()
          }}
          rows={1}
          aria-label={t("chat_input_label")}
          placeholder={t("chat_placeholder")}
          className="max-h-32 min-h-11 resize-none"
        />
        {text.length >= COUNTER_FROM && (
          <p data-testid="chat-counter" className={cn("mt-1 text-right text-xs", tooLong ? "text-red-600" : "text-slate-500")}>
            {text.length}/{CHAT_BODY_MAX}
          </p>
        )}
      </div>
      <Button type="submit" size="icon" className="size-11 shrink-0" disabled={!canSend} aria-label={t("chat_send")}>
        {pending ? <Loader2 className="size-5 animate-spin" /> : <SendHorizontal className="size-5" />}
      </Button>
    </form>
  )
}
