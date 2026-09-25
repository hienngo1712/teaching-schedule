"use client"

import { useState } from "react"
import { AlertCircle, BarChart3, Banknote, CalendarCheck, CalendarDays, Users, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/common/PageHeader"
import { StatCard } from "@/components/common/StatCard"
import { TodaySessions } from "@/components/dashboard/TodaySessions"
import { trpc } from "@/lib/trpc"
import { cn, formatCurrency } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"

export default function DashboardPage() {
  const { data: stats, isLoading } = trpc.report.dashboard.useQuery()
  const { t } = useTranslation()
  const [showMore, setShowMore] = useState(false)
  const money = (v?: number) => (v === undefined ? undefined : formatCurrency(v))

  return (
    <div className="space-y-6">
      <PageHeader title={t("dashboard")} />

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard
          label={t("sessions_today")}
          value={stats?.sessionsToday}
          loading={isLoading}
          icon={<CalendarDays className="size-4 text-emerald-600" />}
          hint={t("total_sessions_day")}
        />
        <StatCard
          label={t("revenue_this_month")}
          value={money(stats?.totalRevenueMonth)}
          loading={isLoading}
          icon={<Banknote className="size-4 text-cyan-600" />}
          hint={t("hint_taught_fees")}
        />
        <StatCard
          label={t("collected_amount")}
          value={money(stats?.totalPaidMonth)}
          loading={isLoading}
          icon={<Wallet className="size-4 text-green-600" />}
          hint={t("hint_collected")}
        />
        <StatCard
          label={t("unpaid_this_month")}
          value={money(stats?.totalUnpaidMonth)}
          loading={isLoading}
          icon={<AlertCircle className="size-4 text-red-600" />}
          hint={t("hint_outstanding")}
        />
      </div>

      {/* Mobile ẩn 4 số phụ sau nút "Xem thêm"; desktop luôn hiện */}
      <div className={cn("grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4", !showMore && "hidden md:grid")}>
        <StatCard
          label={t("total_students")}
          value={stats?.totalStudents}
          loading={isLoading}
          icon={<Users className="size-4 text-blue-600" />}
          hint={t("active_students")}
        />
        <StatCard
          label={t("sessions_this_month")}
          value={stats?.totalSessionsMonth}
          loading={isLoading}
          icon={<CalendarCheck className="size-4 text-indigo-600" />}
          hint={t("scheduled_this_month")}
        />
        <StatCard
          label={t("attendance_rate")}
          value={stats ? `${stats.attendanceRate}%` : undefined}
          loading={isLoading}
          icon={<BarChart3 className="size-4 text-orange-600" />}
          hint={t("average_this_month")}
        />
        <StatCard
          label={t("expected_revenue")}
          value={money(stats?.expectedRevenueMonth)}
          loading={isLoading}
          icon={<Banknote className="size-4 text-violet-600" />}
          hint={t("hint_expected_fees")}
        />
      </div>

      <Button variant="ghost" className="h-11 w-full md:hidden" onClick={() => setShowMore((v) => !v)}>
        {showMore ? t("show_less_stats") : t("show_more_stats")}
      </Button>

      <TodaySessions />
    </div>
  )
}
