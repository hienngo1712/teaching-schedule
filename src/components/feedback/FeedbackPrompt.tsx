"use client"

import { useEffect, useRef, useState } from "react"
import { trpc } from "@/lib/trpc"
import { hasUnseenRelease } from "@/lib/releases"
import { FeedbackDialog } from "./FeedbackDialog"

// Chốt 1 lần mỗi lượt tải: Có gì mới đang chờ thì bỏ qua cả lượt, tránh 2 hộp nối nhau (spec AB §3.3).
export function FeedbackPrompt() {
  const utils = trpc.useUtils()
  const prompt = trpc.feedback.promptStatus.useQuery()
  const release = trpc.release.status.useQuery()
  const dismiss = trpc.feedback.dismissPrompt.useMutation()
  const [decision, setDecision] = useState<"wait" | "show" | "skip">("wait")
  // Lấy trạng thái Có gì mới lúc vừa tải: đóng nó trước khi promptStatus về thì vẫn không hỏi.
  const releaseUnseenAtLoad = useRef<boolean | null>(null)

  useEffect(() => {
    if (release.data && releaseUnseenAtLoad.current === null) {
      releaseUnseenAtLoad.current = hasUnseenRelease(release.data.lastSeenRelease)
    }
    if (decision !== "wait" || !prompt.data || releaseUnseenAtLoad.current === null) return
    setDecision(prompt.data.shouldPrompt && !releaseUnseenAtLoad.current ? "show" : "skip")
  }, [decision, prompt.data, release.data])

  if (decision !== "show") return null
  return (
    <FeedbackDialog
      prompted
      onClose={(sent) => {
        setDecision("skip")
        // Cache còn shouldPrompt=true tới 60s: không ghi đè thì quay lại Tổng quan sẽ hỏi lại.
        utils.feedback.promptStatus.setData(undefined, { shouldPrompt: false })
        if (!sent) dismiss.mutate()
      }}
    />
  )
}
