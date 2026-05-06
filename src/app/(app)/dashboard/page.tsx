"use client"

import {
  Users,
  CalendarDays,
  CalendarCheck,
  BarChart3,
  ArrowRight,
  Banknote,
} from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { trpc } from "@/lib/trpc"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"

export default function DashboardPage() {
  const { data: stats, isLoading } = trpc.report.dashboard.useQuery()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Tổng quan</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Tổng học sinh"
          value={stats?.totalStudents}
          icon={<Users className="size-4 text-blue-600" />}
          loading={isLoading}
          description="Học sinh đang hoạt động"
          className="bg-blue-50/50 border-blue-100"
        />
        <StatCard
          title="Ca dạy hôm nay"
          value={stats?.sessionsToday}
          icon={<CalendarDays className="size-4 text-emerald-600" />}
          loading={isLoading}
          description="Tổng số ca dạy trong ngày"
          className="bg-emerald-50/50 border-emerald-100"
        />
        <StatCard
          title="Ca dạy tháng này"
          value={stats?.totalSessionsMonth}
          icon={<CalendarCheck className="size-4 text-indigo-600" />}
          loading={isLoading}
          description="Đã lên lịch trong tháng này"
          className="bg-indigo-50/50 border-indigo-100"
        />
        <StatCard
          title="Tỉ lệ điểm danh"
          value={stats ? `${stats.attendanceRate}%` : undefined}
          icon={<BarChart3 className="size-4 text-orange-600" />}
          loading={isLoading}
          description="Trung bình tháng này"
          className="bg-orange-50/50 border-orange-100"
        />
        <StatCard
          title="Doanh thu tháng này"
          value={stats ? formatCurrency(stats.totalRevenueMonth) : undefined}
          icon={<Banknote className="size-4 text-cyan-600" />}
          loading={isLoading}
          description="Học phí thu được tháng này"
          className="bg-cyan-50/50 border-cyan-100"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Lối tắt nhanh</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <QuickLink
              href="/calendar"
              title="Lịch dạy"
              description="Xem và quản lý lịch dạy tháng"
              icon={<CalendarDays className="size-8 text-blue-500" />}
            />
            <QuickLink
              href="/students"
              title="Học sinh"
              description="Quản lý danh sách học sinh"
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
