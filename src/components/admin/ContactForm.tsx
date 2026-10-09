"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { contactInputSchema } from "@/lib/schemas/contact"
import { dateTimeVn } from "./admin-format"

type Row = RouterOutputs["contact"]["history"][number]

export function ContactForm() {
  const { t } = useTranslation()
  const current = trpc.contact.get.useQuery()
  const history = trpc.contact.history.useQuery()

  const columns: Column<Row>[] = [
    { header: t("admin_price_time"), cell: (r) => dateTimeVn(r.createdAt) },
    { header: t("contact_phone"), cell: (r) => r.phone },
    { header: t("contact_facebook"), cell: (r) => <span className="break-all">{r.facebookUrl ?? "-"}</span> },
    { header: t("admin_price_changed_by"), cell: (r) => r.changedBy },
  ]

  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold text-foreground">{t("contact_title")}</h2>
      {current.isPending ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : (
        // key theo liên hệ hiện hành: Lưu xong thì ô nhập khởi tạo lại từ dòng mới.
        <ContactInputs key={`${current.data?.phone ?? ""}|${current.data?.facebookUrl ?? ""}`} current={current.data ?? null} />
      )}
      <h3 className="text-sm font-semibold text-foreground">{t("contact_history")}</h3>
      <ResponsiveList
        isLoading={history.isPending}
        isError={history.isError}
        onRetry={() => history.refetch()}
        errorText={t("load_error")}
        retryText={t("retry")}
        items={history.data ?? []}
        getKey={(r) => r.id}
        columns={columns}
        emptyText="-"
        renderCard={(r) => (
          <div data-testid="contact-history-card" className="space-y-1 rounded-lg border bg-white p-4 text-sm">
            <p className="font-medium text-foreground">{r.phone}</p>
            {r.facebookUrl && <p className="break-all text-slate-600">{r.facebookUrl}</p>}
            <p className="text-xs text-slate-500">
              {r.changedBy} · {dateTimeVn(r.createdAt)}
            </p>
          </div>
        )}
      />
    </section>
  )
}

function ContactInputs({ current }: { current: { phone: string; facebookUrl: string | null } | null }) {
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const [phone, setPhone] = useState(current?.phone ?? "")
  const [facebookUrl, setFacebookUrl] = useState(current?.facebookUrl ?? "")
  const update = trpc.contact.update.useMutation({
    onSuccess: () => {
      toast.success(t("contact_saved"))
      void utils.contact.invalidate()
    },
    onError: (e) => toast.error(e.message),
  })

  const parsed = contactInputSchema.safeParse({ phone, facebookUrl })
  const errorOf = (field: "phone" | "facebookUrl") =>
    parsed.success ? null : (parsed.error.issues.find((i) => i.path[0] === field)?.message ?? null)
  const phoneError = phone === "" ? null : errorOf("phone")
  const facebookError = errorOf("facebookUrl")
  const unchanged = parsed.success && parsed.data.phone === current?.phone && parsed.data.facebookUrl === (current?.facebookUrl ?? null)
  const canSave = parsed.success && !unchanged && !update.isPending

  return (
    <div data-testid="contact-form" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 md:p-6">
      <div className="space-y-1.5">
        <Label htmlFor="contact-phone">{t("contact_phone")}</Label>
        <Input
          id="contact-phone"
          inputMode="tel"
          autoComplete="off"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="h-11 md:h-10 md:max-w-60"
        />
        {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contact-facebook">{t("contact_facebook")}</Label>
        <Input
          id="contact-facebook"
          inputMode="url"
          autoComplete="off"
          placeholder="https://www.facebook.com/..."
          value={facebookUrl}
          onChange={(e) => setFacebookUrl(e.target.value)}
          className="h-11 md:h-10 md:max-w-md"
        />
        {facebookError && <p className="text-xs text-destructive">{facebookError}</p>}
      </div>
      <Button
        type="button"
        className="h-11 w-full md:h-10 md:w-auto"
        disabled={!canSave}
        onClick={() => update.mutate({ phone, facebookUrl })}
      >
        {t("save")}
      </Button>
    </div>
  )
}
