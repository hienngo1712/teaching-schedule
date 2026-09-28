"use client"

import Link from "next/link"
import { PageHeader } from "@/components/common/PageHeader"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { trpc } from "@/lib/trpc"
import { cn } from "@/lib/utils"
import { shortDateTimeVn } from "./admin-format"
import { AccountTrend } from "./AccountTrend"

// Viền trên theo nhóm, bảng màu A3 (spec K A14); amber chỉ khi cần admin xử lý.
const TONE = {
  primary: "border-t-primary",
  teal: "border-t-teal-400",
  emerald: "border-t-emerald-600",
  warn: "border-t-amber-500",
  muted: "border-t-slate-300",
} as const
type Tone = keyof typeof TONE

function StatCard({ id, label, value, hint, extra, tone, href }: { id: string; label: string; value: number; hint: string; extra?: string; tone: Tone; href?: string }) {
  const card = (
    <div data-testid={`card-${id}`} className={cn("h-full rounded-lg border border-slate-200 border-t-4 bg-white p-4", TONE[tone])}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn("text-2xl font-bold", tone === "warn" ? "text-amber-700" : "text-foreground")}>{value}</p>
      <p className="text-xs text-slate-500">{hint}</p>
      {extra && <p className="text-xs font-medium text-primary">{extra}</p>}
    </div>
  )
  return href ? (
    <Link href={href} className="block min-h-11 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {card}
    </Link>
  ) : (
    card
  )
}

export function AdminOverview() {
  const { t } = useTranslation()
  const query = trpc.admin.stats.useQuery()
  const s = query.data

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin_overview")}
        description={s ? t("admin_updated_at").replace("{time}", shortDateTimeVn(String(s.updatedAt))) : undefined}
      />

      {query.isError ? (
        <div className="space-y-2 text-sm">
          <p className="text-destructive">{t("load_error")}</p>
          <Button variant="outline" className="h-11 md:h-10" onClick={() => query.refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : !s ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div data-testid="overview-cards" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatCard id="total" tone="primary" label={t("admin_card_total")} value={s.totalAccounts} hint={t("admin_card_total_hint")} />
          <StatCard id="active" tone="primary" label={t("admin_card_active")} value={s.activeAccounts} hint={t("admin_card_active_hint")} />
          <StatCard
            id="pending"
            href="/admin/orders"
            tone={s.pendingOrders > 0 ? "warn" : "muted"}
            label={t("admin_card_pending")}
            value={s.pendingOrders}
            hint={t(s.pendingOrders > 0 ? "admin_card_pending_hint" : "admin_card_pending_none")}
            extra={s.newAccounts > 0 ? t("admin_card_pending_new").replace("{n}", String(s.newAccounts)) : undefined}
          />
          <StatCard id="active24h" tone="teal" label={t("admin_card_active24h")} value={s.active24h} hint={t("admin_card_active24h_hint")} />
          <StatCard id="active7d" tone="teal" label={t("admin_card_active7d")} value={s.active7d} hint={t("admin_card_active7d_hint")} />
          <StatCard
            id="paying"
            tone="emerald"
            label={t("admin_card_paying")}
            value={s.paying.plus + s.paying.pro}
            hint={t("admin_card_paying_hint").replace("{plus}", String(s.paying.plus)).replace("{pro}", String(s.paying.pro))}
          />
          <StatCard id="trial" tone="emerald" label={t("admin_card_trial")} value={s.trial} hint={t("admin_card_trial_hint")} />
          <StatCard
            id="expiring"
            tone={s.expiringSoon.paid + s.expiringSoon.trial > 0 ? "warn" : "muted"}
            label={t("admin_card_expiring")}
            value={s.expiringSoon.paid + s.expiringSoon.trial}
            hint={t("admin_card_expiring_hint").replace("{paid}", String(s.expiringSoon.paid)).replace("{trial}", String(s.expiringSoon.trial))}
          />
          <StatCard id="std-after-trial" tone="teal" label={t("admin_card_std_after_trial")} value={s.standardAfterTrial} hint={t("admin_card_std_after_trial_hint")} />
        </div>
      )}

      <AccountTrend />
    </div>
  )
}
