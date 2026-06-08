"use client"

import {
  Users,
  CalendarDays,
  CalendarCheck,
  BarChart3,
  ArrowRight,
  Banknote,
  AlertCircle,
} from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { trpc } from "@/lib/trpc"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"

export default function DashboardPage() {
  const { data: stats, isLoading } = trpc.report.dashboard.useQuery()
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("dashboard")}</h1>
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard
          title={t("total_students")}
          value={stats?.totalStudents}
          icon={<Users className="size-4 text-blue-600" />}
          loading={isLoading}
          description={t("active_students")}
          className="bg-blue-50/50 border-blue-100"
        />
        <StatCard
          title={t("sessions_today")}
          value={stats?.sessionsToday}
          icon={<CalendarDays className="size-4 text-emerald-600" />}
          loading={isLoading}
          description={t("total_sessions_day")}
          className="bg-emerald-50/50 border-emerald-100"
        />
        <StatCard
          title={t("sessions_this_month")}
          value={stats?.totalSessionsMonth}
          icon={<CalendarCheck className="size-4 text-indigo-600" />}
          loading={isLoading}
          description={t("scheduled_this_month")}
          className="bg-indigo-50/50 border-indigo-100"
        />
        <StatCard
          title={t("attendance_rate")}
          value={stats ? `${stats.attendanceRate}%` : undefined}
          icon={<BarChart3 className="size-4 text-orange-600" />}
          loading={isLoading}
          description={t("average_this_month")}
          className="bg-orange-50/50 border-orange-100"
        />
        <StatCard
          title={t("expected_revenue")}
          value={stats ? formatCurrency(stats.expectedRevenueMonth) : undefined}
          icon={<Banknote className="size-4 text-violet-600" />}
          loading={isLoading}
          description={t("revenue_this_month")}
          className="bg-violet-50/50 border-violet-100"
        />
        <StatCard
          title={t("revenue_this_month")}
          value={stats ? formatCurrency(stats.totalRevenueMonth) : undefined}
          icon={<Banknote className="size-4 text-cyan-600" />}
          loading={isLoading}
          description={t("collected_this_month")}
          className="bg-cyan-50/50 border-cyan-100"
        />
        <StatCard
          title={t("unpaid_this_month")}
          value={stats ? formatCurrency(stats.totalUnpaidMonth) : undefined}
          icon={<AlertCircle className="size-4 text-red-600" />}
          loading={isLoading}
          description={t("uncollected_amount")}
          className="bg-red-50/50 border-red-100"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>{t("quick_links")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <QuickLink
              href="/calendar"
              title={t("calendar")}
              description={t("manage_calendar")}
              icon={<CalendarDays className="size-8 text-blue-500" />}
            />
            <QuickLink
              href="/students"
              title={t("students")}
              description={t("manage_students")}
              icon={<Users className="size-8 text-green-500" />}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon,
  description,
  loading,
  className,
}: {
  title: string
  value?: string | number
  icon: React.ReactNode
  description: string
  loading: boolean
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-2xl font-bold">{value ?? 0}</div>
        )}
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  )
}

function QuickLink({
  href,
  title,
  description,
  icon,
}: {
  href: string
  title: string
  description: string
  icon: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors group"
    >
      <div className="p-3 rounded-lg bg-slate-50 group-hover:bg-white transition-colors">
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <ArrowRight className="size-5 text-slate-300 group-hover:text-slate-600 transition-colors" />
    </Link>
  )
}
