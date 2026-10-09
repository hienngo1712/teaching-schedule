"use client"

import { useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { PayosNoticeList } from "./PayosNoticeList"
import { usePayosNoticeToasts } from "./usePayosNoticeToasts"

export const PAYOS_POLL_MS = 30_000

type Item = RouterOutputs["payosNotice"]["list"]["items"][number]

// HS đã xoá không còn trong trang Học phí nên không tạo link (spec AI §7).
export const noticeHref = (i: Pick<Item, "studentDeleted" | "year" | "month" | "studentId">) =>
  i.studentDeleted ? null : `/tuition?year=${i.year}&month=${i.month}&studentId=${i.studentId}`

export function PayosBell() {
  const { t } = useTranslation()
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const router = useRouter()
  const utils = trpc.useUtils()
  const { data } = trpc.payosNotice.list.useQuery(undefined, {
    // Chưa nối payOS và chưa có lịch sử: không hỏi định kỳ (spec AI §5).
    refetchInterval: (q) => (q.state.data?.enabled ? PAYOS_POLL_MS : false),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
  const markSeen = trpc.payosNotice.markSeen.useMutation({ onSettled: () => utils.payosNotice.list.invalidate() })
  const [open, setOpen] = useState(false)
  // Giữ danh sách lúc mở để chấm "chưa đọc" còn tới khi đóng.
  const [shown, setShown] = useState<Item[]>([])
  // Nút "Xem" của toast gọi bản change mới nhất mà không làm hook toast chạy lại.
  const openRef = useRef(() => {})
  const openBell = useCallback(() => openRef.current(), [])
  usePayosNoticeToasts(data, openBell)

  if (!data?.enabled) return null

  function change(next: boolean) {
    setOpen(next)
    if (!next || !data) return
    toast.dismiss()
    setShown(data.items)
    const newest = data.items[0]
    if (data.unread > 0 && newest) {
      // Huỷ lần hỏi đang chạy trước: nó đọc DB trước markSeen, về sau sẽ bật lại huy hiệu.
      void utils.payosNotice.list.cancel().then(() =>
        utils.payosNotice.list.setData(undefined, (d) => d && { ...d, unread: 0, items: d.items.map((i) => ({ ...i, unread: false })) })
      )
      // upTo thay vì now: khoản vào đúng lúc đang mở chuông không bị đánh dấu đã đọc oan.
      markSeen.mutate({ upTo: new Date(newest.createdAt).toISOString() })
    }
  }

  openRef.current = () => change(true)

  function pick(i: Item) {
    const href = noticeHref(i)
    if (!href) return
    setOpen(false)
    router.push(href)
  }

  const trigger = (extra?: React.ComponentProps<typeof Button>) => (
    <Button variant="outline" size="icon" className="relative size-11 text-slate-600 md:size-10" aria-label={t("payos_bell_label")} {...extra}>
      <Bell className="size-5" aria-hidden />
      {data.unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold text-white ring-2 ring-white">
          {data.unread > 9 ? "9+" : data.unread}
        </span>
      )}
    </Button>
  )
  const list = <PayosNoticeList items={shown} onPick={pick} />

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={change}>
        <PopoverTrigger asChild>{trigger()}</PopoverTrigger>
        <PopoverContent aria-label={t("payos_bell_title")} align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0">
          <p className="border-b px-4 py-3 font-semibold text-slate-900">{t("payos_bell_title")}</p>
          {list}
        </PopoverContent>
      </Popover>
    )
  }
  return (
    <>
      {trigger({ onClick: () => change(true), "aria-haspopup": "dialog", "aria-expanded": open })}
      <Sheet open={open} onOpenChange={change}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto p-0">
          <SheetTitle className="border-b px-4 py-3 text-base font-semibold text-slate-900">{t("payos_bell_title")}</SheetTitle>
          {list}
        </SheetContent>
      </Sheet>
    </>
  )
}
