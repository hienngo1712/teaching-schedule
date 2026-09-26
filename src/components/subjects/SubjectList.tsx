"use client"

import { useState } from "react"
import { Eye, EyeOff, MoreHorizontal, Pencil, Plus, Star } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { SubjectFormDialog } from "./SubjectFormDialog"

type Subject = RouterOutputs["subject"]["list"][number]

export function SubjectList() {
  const { t } = useTranslation()
  const query = trpc.subject.list.useQuery({})
  const updateMut = trpc.subject.update.useMutation({
    onError: (e) => toast.error(e.message),
  })

  const [form, setForm] = useState<{ open: false } | { open: true; subject?: Subject }>({
    open: false,
  })
  const [hideTarget, setHideTarget] = useState<Subject | null>(null)

  const subjects = query.data ?? []
  const active = subjects.filter((s) => s.isActive)
  const hidden = subjects.filter((s) => !s.isActive)

  const renderCard = (s: Subject) => (
    <div
      key={s.id}
      data-testid="subject-card"
      className="flex items-center gap-3 rounded-lg border bg-white p-4"
    >
      <span className="size-4 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
      <span className={cn("min-w-0 flex-1 truncate font-medium", s.isActive ? "text-slate-900" : "text-slate-500")}>
        {s.name}
      </span>
      {s.isDefault && (
        <Badge variant="outline" className="shrink-0 border-transparent bg-primary/[0.08] text-primary">
          {t("default_badge")}
        </Badge>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-11 shrink-0 md:size-9" aria-label={t("actions")}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setForm({ open: true, subject: s })}>
            <Pencil className="mr-2 size-4" />
            {t("edit")}
          </DropdownMenuItem>
          {s.isActive && !s.isDefault && (
            <DropdownMenuItem onSelect={() => updateMut.mutate({ id: s.id, data: { isDefault: true } })}>
              <Star className="mr-2 size-4" />
              {t("set_default")}
            </DropdownMenuItem>
          )}
          {s.isActive ? (
            <DropdownMenuItem onSelect={() => setHideTarget(s)}>
              <EyeOff className="mr-2 size-4" />
              {t("hide")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => updateMut.mutate({ id: s.id, data: { isActive: true } })}>
              <Eye className="mr-2 size-4" />
              {t("unhide")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={t("subject")}
        description={t("subjects_desc")}
        actions={
          <Button onClick={() => setForm({ open: true })} className="h-11 md:h-10">
            <Plus className="mr-2 size-4" />
            {t("add_subject")}
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
        <>
          <section data-testid="subjects-active" className="space-y-3">
            <h2 className="text-sm font-medium text-slate-500">{t("subjects_active")}</h2>
            <div className="grid gap-3 md:grid-cols-2">{active.map(renderCard)}</div>
          </section>

          {hidden.length > 0 && (
            <section data-testid="subjects-hidden" className="space-y-3">
              <h2 className="text-sm font-medium text-slate-500">{t("subjects_hidden")}</h2>
              <div className="grid gap-3 md:grid-cols-2">{hidden.map(renderCard)}</div>
            </section>
          )}
        </>
      )}

      {form.open && (
        <SubjectFormDialog
          subject={form.subject}
          usedColors={subjects.map((s) => s.color)}
          onClose={() => setForm({ open: false })}
        />
      )}

      <AlertDialog open={hideTarget !== null} onOpenChange={(open) => !open && setHideTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("hide")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("hide_subject_confirm").replace("{name}", hideTarget?.name ?? "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (hideTarget) updateMut.mutate({ id: hideTarget.id, data: { isActive: false } })
                setHideTarget(null)
              }}
            >
              {t("hide")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
