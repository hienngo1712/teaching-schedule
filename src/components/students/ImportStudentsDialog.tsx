"use client"

import { useRef, useState } from "react"
import { saveAs } from "file-saver"
import { Download, FileSpreadsheet, Loader2 } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import { trpc } from "@/lib/trpc"
import { cn, formatCurrency } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { buildPreview, toImportPayload, type PreviewRow } from "@/lib/student-import"
import { buildImportTemplate, readImportWorkbook, type ImportReadError } from "@/lib/student-import-excel"

export function ImportStudentsButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label={t("import_excel")}
        className="h-11 px-3 md:h-10 md:px-4"
      >
        <FileSpreadsheet className="size-4 text-green-600 sm:mr-2" />
        <span className="hidden sm:inline">{t("import_excel")}</span>
      </Button>
      {open && <ImportStudentsDialog onClose={() => setOpen(false)} />}
    </>
  )
}

// Chỉ mount khi mở nên mỗi lần mở là state mới, không cần effect reset.
function ImportStudentsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [allowed, setAllowed] = useState<Set<number>>(new Set())
  const [readError, setReadError] = useState<ImportReadError | null>(null)
  const [reading, setReading] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const checkMut = trpc.student.importCheck.useMutation()
  const importMut = trpc.student.importMany.useMutation({
    onSuccess: (data) => {
      toast.success(t("import_success").replace("{n}", String(data.created)))
      onClose()
    },
    onError: (e) => toast.error(e.message),
  })

  const downloadTemplate = async () => {
    setDownloading(true)
    try {
      saveAs(new Blob([await buildImportTemplate()]), "mau-nhap-hoc-sinh.xlsx")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setDownloading(false)
    }
  }

  const handleFile = async (file: File) => {
    setReadError(null)
    setReading(true)
    try {
      const result = await readImportWorkbook(await file.arrayBuffer())
      if (!result.ok) {
        setReadError(result.error)
        return
      }
      const valid = result.rows.filter((r) => r.errors.length === 0)
      const { matches } =
        valid.length > 0
          ? await checkMut.mutateAsync({
              rows: valid.map((r) => ({ fullName: r.input.fullName, grade: r.input.grade })),
            })
          : { matches: [] }
      setAllowed(new Set())
      setPreview(buildPreview(result.rows, matches))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setReading(false)
      // Xóa giá trị để chọn lại đúng file đó vẫn bắn onChange.
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const toggleAllowed = (rowNumber: number, on: boolean) => {
    setAllowed((prev) => {
      const next = new Set(prev)
      if (on) next.add(rowNumber)
      else next.delete(rowNumber)
      return next
    })
  }

  const dupReason = (row: PreviewRow) =>
    row.existing
      ? t(row.existing.isActive ? "import_dup_existing" : "import_dup_inactive")
          .replace("{name}", row.existing.fullName)
          .replace("{grade}", String(row.existing.grade))
      : t("import_dup_in_file").replace("{n}", String(row.sameAsRow))

  const payload = preview ? toImportPayload(preview, allowed) : []
  const count = (s: PreviewRow["status"]) => String(preview?.filter((r) => r.status === s).length ?? 0)

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="left-0 top-0 flex h-full w-full max-w-none translate-x-0 translate-y-0 flex-col overflow-y-auto sm:left-[50%] sm:top-[50%] sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg">
        <DialogHeader>
          <DialogTitle>{t("import_students_title")}</DialogTitle>
        </DialogHeader>

        {preview === null ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{t("import_hint")}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={downloadTemplate} disabled={downloading} className="h-11 md:h-10">
                {downloading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
                {t("download_template")}
              </Button>
              <Button onClick={() => inputRef.current?.click()} disabled={reading} className="h-11 md:h-10">
                {reading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="mr-2 size-4" />
                )}
                {t("choose_file")}
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                data-testid="import-file-input"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleFile(file)
                }}
              />
            </div>
            {readError && (
              <p role="alert" className="text-sm text-red-600">
                {t(`import_err_${readError}`)}
              </p>
            )}
          </div>
        ) : (
          <>
            <p data-testid="import-summary" className="text-sm font-medium text-slate-700">
              {t("import_summary")
                .replace("{ok}", count("ok"))
                .replace("{dup}", count("duplicate"))
                .replace("{err}", count("error"))}
            </p>
            <ul className="space-y-2">
              {preview.map((row) => {
                const fee = row.input.tuitionFee
                const details = [
                  row.input.parentName,
                  row.input.parentPhone,
                  Number.isNaN(fee) ? null : formatCurrency(fee),
                  row.input.notes,
                ].filter(Boolean)
                const checkboxId = `import-anyway-${row.rowNumber}`
                return (
                  <li
                    key={row.rowNumber}
                    data-testid="import-row"
                    className={cn(
                      "rounded-lg border p-3",
                      row.status === "error" && "border-red-200 bg-red-50",
                      row.status === "duplicate" && "border-amber-300 bg-amber-50/40"
                    )}
                  >
                    <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="text-slate-500">{t("import_row").replace("{n}", String(row.rowNumber))}</span>
                      <span className="min-w-0 max-w-full truncate font-medium text-slate-900">{row.input.fullName}</span>
                      <span className="text-slate-600">
                        {t("grade")} {Number.isNaN(row.input.grade) ? "?" : row.input.grade}
                      </span>
                    </div>
                    {details.length > 0 && (
                      <p className="mt-1 truncate text-xs text-slate-500">{details.join(" · ")}</p>
                    )}
                    {row.status === "error" && (
                      <ul className="mt-2 space-y-0.5 text-xs text-red-700">
                        {row.errors.map((f) => (
                          <li key={f}>{t(`import_err_${f}`)}</li>
                        ))}
                      </ul>
                    )}
                    {row.status === "duplicate" && (
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3">
                        <p className="text-xs text-amber-700">{dupReason(row)}</p>
                        <Label htmlFor={checkboxId} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                          <Checkbox
                            id={checkboxId}
                            checked={allowed.has(row.rowNumber)}
                            onCheckedChange={(v) => toggleAllowed(row.rowNumber, v === true)}
                          />
                          {t("import_anyway")}
                        </Label>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 mt-auto gap-2 border-t bg-white px-6 py-3 sm:static sm:mx-0 sm:mb-0 sm:border-0 sm:p-0">
              <Button
                variant="outline"
                onClick={() => setPreview(null)}
                disabled={importMut.isPending}
                className="h-11 md:h-10"
              >
                {t("choose_other_file")}
              </Button>
              <Button
                onClick={() => importMut.mutate({ rows: payload })}
                disabled={payload.length === 0 || importMut.isPending}
                className="h-11 w-full sm:w-auto md:h-10"
              >
                {importMut.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {t("import_submit").replace("{n}", String(payload.length))}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
