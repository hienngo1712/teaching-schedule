"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { useTourActive } from "@/lib/tour-store"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { formatCurrency } from "@/lib/utils"
import { noticeHref } from "./PayosBell"

type ListData = RouterOutputs["payosNotice"]["list"]
const MAX_SINGLE = 3

export function usePayosNoticeToasts(data: ListData | undefined, onOpenBell: () => void) {
  const { t } = useTranslation()
  const router = useRouter()
  const utils = trpc.useUtils()
  const tour = useTourActive()
  // Mốc createdAt mới nhất đã báo trong phiên; null = chưa có lần tải nào.
  const known = useRef<number | null>(null)

  useEffect(() => {
    // Đang chạy tour thì hoãn, tour tắt effect chạy lại nên không mất khoản nào.
    if (!data?.enabled || tour) return
    const newest = data.items[0] ? new Date(data.items[0].createdAt).getTime() : 0
    const many = (n: number) =>
      toast(t("payos_notice_new_many").replace("{n}", String(n)), { action: { label: t("payos_notice_view"), onClick: onOpenBell } })
    if (known.current === null) {
      known.current = newest
      // Lần tải đầu của phiên: chỉ 1 toast tóm tắt, không bắn từng khoản cũ.
      if (data.unread > 0) many(data.unread)
      return
    }
    const fresh = data.items.filter((i) => new Date(i.createdAt).getTime() > known.current!)
    if (fresh.length === 0) return
    known.current = newest
    void utils.tuition.invalidate()
    void utils.payment.invalidate()
    void utils.report.invalidate()
    if (fresh.length > MAX_SINGLE) {
      many(fresh.length)
      return
    }
    for (const i of fresh) {
      const href = noticeHref(i)
      toast.success(
        t("payos_notice_line").replace("{name}", i.studentName).replace("{amount}", formatCurrency(i.amount)),
        href ? { action: { label: t("payos_notice_view"), onClick: () => router.push(href) } } : undefined
      )
    }
  }, [data, tour, t, router, utils, onOpenBell])
}
