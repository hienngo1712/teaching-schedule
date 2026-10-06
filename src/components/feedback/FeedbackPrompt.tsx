"use client"

import { useEffect, useState } from "react"
import { trpc } from "@/lib/trpc"
import { hasUnseenRelease } from "@/lib/releases"
import { FeedbackDialog } from "./FeedbackDialog"

// Chốt 1 lần mỗi lượt tải: Có gì mới đang chờ thì bỏ qua cả lượt, tránh 2 hộp nối nhau (spec AB §3.3).
export function FeedbackPrompt() {
  const prompt = trpc.feedback.promptStatus.useQuery()
  const release = trpc.release.status.useQuery()
  const dismiss = trpc.feedback.dismissPrompt.useMutation()
  const [decision, setDecision] = useState<"wait" | "show" | "skip">("wait")

  useEffect(() => {
    if (decision !== "wait" || !prompt.data || !release.data) return
    setDecision(prompt.data.shouldPrompt && !hasUnseenRelease(release.data.lastSeenRelease) ? "show" : "skip")
  }, [decision, prompt.data, release.data])

  if (decision !== "show") return null
  return (
    <FeedbackDialog
      prompted
      onClose={(sent) => {
        setDecision("skip")
        if (!sent) dismiss.mutate()
      }}
    />
  )
}
