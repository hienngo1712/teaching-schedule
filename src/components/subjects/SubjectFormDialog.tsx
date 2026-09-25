"use client"

import { useState } from "react"
import { Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { SUBJECT_COLORS, pickNextColor } from "@/lib/subject-colors"
import { cn } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Subject = RouterOutputs["subject"]["list"][number]

type Props = {
  subject?: Subject
  usedColors: string[]
  onClose: () => void
}

// Chỉ mount khi mở (xem SubjectList) nên state khởi tạo thẳng từ props, không cần effect reset.
export function SubjectFormDialog({ subject, usedColors, onClose }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState(subject?.name ?? "")
  const [color, setColor] = useState(subject?.color ?? pickNextColor(usedColors))
  const [isDefault, setIsDefault] = useState(subject?.isDefault ?? false)
  const [error, setError] = useState<string | null>(null)

  const handlers = {
    onSuccess: () => {
      toast.success(t("subject_saved"))
      onClose()
    },
    onError: (e: { message: string }) => setError(e.message),
  }
  const createMut = trpc.subject.create.useMutation(handlers)
  const updateMut = trpc.subject.update.useMutation(handlers)
  const isPending = createMut.isPending || updateMut.isPending
  const trimmed = name.trim()

  const save = () => {
    setError(null)
    if (subject) {
      updateMut.mutate({ id: subject.id, data: { name: trimmed, color, isDefault } })
    } else {
      createMut.mutate({ name: trimmed, color, isDefault })
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{subject ? t("edit_subject") : t("add_subject")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="subject-name">{t("subject_name")}</Label>
            <Input
              id="subject-name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              className="h-11 md:h-10"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">{t("subject_color")}</p>
            <div className="grid grid-cols-5 gap-3">
              {SUBJECT_COLORS.map((c) => {
                const selected = color.toUpperCase() === c
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    aria-pressed={selected}
                    onClick={() => setColor(c)}
                    className={cn(
                      "flex size-11 items-center justify-center rounded-full",
                      selected && "ring-2 ring-slate-900 ring-offset-2"
                    )}
                    style={{ backgroundColor: c }}
                  >
                    {selected && <Check className="size-5 text-white" strokeWidth={3} />}
                  </button>
                )
              })}
            </div>
          </div>

          {(!subject || subject.isActive) && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="subject-default"
                checked={isDefault}
                onCheckedChange={(v) => setIsDefault(v === true)}
              />
              <Label htmlFor="subject-default">{t("subject_default_hint")}</Label>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="h-11 md:h-10">
            {t("cancel")}
          </Button>
          <Button onClick={save} disabled={!trimmed || isPending} className="h-11 md:h-10">
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
