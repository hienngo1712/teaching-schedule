"use client"

import { useState } from "react"
import { History, Link2Off, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PageHeader } from "@/components/common/PageHeader"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { useTranslation } from "@/components/providers/LanguageProvider"
import type vi from "@/language/vi.json"
import { PlaceFormDialog } from "./PlaceFormDialog"
import { PlaceRateHistoryDialog } from "./PlaceRateHistoryDialog"
import { formatCurrency } from "@/lib/utils"
import { useFeatureGate } from "@/hooks/useFeatureGate"

type Place = RouterOutputs["place"]["list"][number]

// Trang Nơi dạy (spec AL §4.1, mẫu 07a): bố cục như SubjectList, 2 nhóm theo cách tính tiền.
export function PlaceList() {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const query = trpc.place.list.useQuery()
  const deleteMut = trpc.place.delete.useMutation({
    onSuccess: () => {
      toast.success(t("place_deleted"))
      setDeleteTarget(null)
      utils.place.invalidate()
    },
    onError: (e) => {
      setDeleteTarget(null)
      toast.error(t(e.message as keyof typeof vi))
    },
  })

  const [form, setForm] = useState<{ open: false } | { open: true; place?: Place }>({ open: false })
  const [deleteTarget, setDeleteTarget] = useState<Place | null>(null)
  const [historyOf, setHistoryOf] = useState<Place | null>(null)
  // Link người trả (spec AN §1): tạo mới thì link cũ 404 ngay, tắt thì link mất → hỏi lại trước.
  const [linkAction, setLinkAction] = useState<{ place: Place; kind: "rotate" | "disable" } | null>(null)
  const noticeGate = useFeatureGate("placeNotice")
  const linkDone = (msg: "place_link_rotated" | "place_link_disabled") => () => {
    toast.success(t(msg))
    setLinkAction(null)
  }
  const rotateMut = trpc.placeNotice.rotate.useMutation({ onSuccess: linkDone("place_link_rotated"), onError: (e) => toast.error(e.message) })
  const disableMut = trpc.placeNotice.disable.useMutation({ onSuccess: linkDone("place_link_disabled"), onError: (e) => toast.error(e.message) })

  const places = query.data ?? []
  const groups = [
    { key: "per_student" as const, title: t("places_per_student") },
    { key: "per_session" as const, title: t("places_per_session") },
  ]

  const renderCard = (p: Place) => (
    <div key={p.id} data-testid="place-card" className="flex items-center gap-3 rounded-lg border bg-white p-4">
      <span className="size-4 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-900">{p.name}</p>
        {/* Nơi theo ca/giờ có đơn giá: "Trung tâm · Theo giờ · 185.000 đ/giờ" (spec AM §4.2), xuống dòng thay vì cắt số tiền. */}
        {p.billing === "per_session" && p.rate ? (
          <p className="text-sm text-slate-500">
            {t(`place_kind_${p.kind}`)} · {t(p.rate.unit === "hour" ? "place_rate_hour" : "place_rate_session")} ·{" "}
            <span className="whitespace-nowrap">
              {t(p.rate.unit === "hour" ? "income_rate_hour" : "income_rate_session").replace("{amount}", formatCurrency(p.rate.amount))}
            </span>
          </p>
        ) : (
          <p className="truncate text-sm text-slate-500">
            {t(`place_kind_${p.kind}`)} · {t(`place_billing_short_${p.billing}`)}
          </p>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-11 shrink-0 md:size-9" aria-label={t("actions")}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="min-h-11 md:min-h-9" onSelect={() => setForm({ open: true, place: p })}>
            <Pencil className="mr-2 size-4" />
            {t("edit")}
          </DropdownMenuItem>
          {p.billing === "per_session" && (
            <DropdownMenuItem className="min-h-11 md:min-h-9" onSelect={() => setHistoryOf(p)}>
              <History className="mr-2 size-4" />
              {t("place_rate_history")}
            </DropdownMenuItem>
          )}
          {p.billing === "per_session" && (
            <>
              <DropdownMenuItem className="min-h-11 md:min-h-9" onSelect={() => noticeGate.guard(() => setLinkAction({ place: p, kind: "rotate" }))()}>
                <RefreshCw className="mr-2 size-4" />
                {t("place_link_rotate")}
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-11 md:min-h-9" onSelect={() => setLinkAction({ place: p, kind: "disable" })}>
                <Link2Off className="mr-2 size-4" />
                {t("place_link_disable")}
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem className="min-h-11 text-red-600 focus:text-red-700 md:min-h-9" onSelect={() => setDeleteTarget(p)}>
            <Trash2 className="mr-2 size-4" />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={t("places")}
        description={t("places_desc")}
        actions={
          <Button onClick={() => setForm({ open: true })} className="h-11 md:h-10">
            <Plus className="mr-2 size-4" />
            {t("add_place")}
          </Button>
        }
      />

      {query.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white py-12 text-center">
          <p className="text-sm text-slate-600">{t("load_error")}</p>
          <Button variant="outline" className="mt-3 h-11 md:h-10" onClick={() => query.refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : (
        groups.map((g) => {
          const items = places.filter((p) => p.billing === g.key)
          if (items.length === 0) return null
          return (
            <section key={g.key} data-testid={`places-${g.key}`} className="space-y-3">
              <h2 className="text-sm font-medium text-slate-500">{g.title}</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{items.map(renderCard)}</div>
            </section>
          )
        })
      )}

      {form.open && (
        <PlaceFormDialog place={form.place} usedColors={places.map((p) => p.color)} onClose={() => setForm({ open: false })} />
      )}
      {historyOf && <PlaceRateHistoryDialog place={historyOf} onClose={() => setHistoryOf(null)} />}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("delete_place_confirm").replace("{name}", deleteTarget?.name ?? "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMut.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (deleteTarget) deleteMut.mutate({ id: deleteTarget.id })
              }}
            >
              {deleteMut.isPending ? t("deleting") : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={linkAction !== null} onOpenChange={(open) => !open && setLinkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{linkAction && t(linkAction.kind === "rotate" ? "place_link_rotate" : "place_link_disable")}</AlertDialogTitle>
            <AlertDialogDescription>
              {linkAction && t(linkAction.kind === "rotate" ? "place_link_rotate_confirm" : "place_link_disable_confirm").replace("{name}", linkAction.place.name)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={rotateMut.isPending || disableMut.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (!linkAction) return
                const input = { placeId: linkAction.place.id }
                if (linkAction.kind === "rotate") rotateMut.mutate(input)
                else disableMut.mutate(input)
              }}
            >
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
