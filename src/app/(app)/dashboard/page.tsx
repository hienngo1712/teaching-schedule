"use client"

import { Fragment, useState } from "react"
import { AlertCircle, BarChart3, Banknote, CalendarCheck, CalendarDays, Clock, HandCoins, Users, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/common/PageHeader"
import { StatCard } from "@/components/common/StatCard"
import { TodaySessions } from "@/components/dashboard/TodaySessions"
import { DashboardAlerts } from "@/components/dashboard/DashboardAlerts"
import { StartCard } from "@/components/dashboard/StartCard"
import { FeedbackPrompt } from "@/components/feedback/FeedbackPrompt"
import { trpc } from "@/lib/trpc"
import { cn, formatCurrency } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { usePlaceSummary } from "@/hooks/usePlaceSummary"
import { formatHours } from "@/lib/timesheet-export"

export default function DashboardPage() {
  const { data: stats, isLoading } = trpc.report.dashboard.useQuery()
  const { t } = useTranslation()
  const [showMore, setShowMore] = useState(false)
  const money = (v?: number) => (v === undefined ? undefined : formatCurrency(v))
  // Chỉ dạy nơi tính theo ca/giờ: không có học phí → ẩn các ô tiền (spec AL §4.4, mẫu 04b).
  const summary = usePlaceSummary().summary
  const noPerStudent = summary?.hasPerStudent === false
  // Spec AM §4.3: có nơi theo ca/giờ thì có Giờ dạy; Thu nhập khi có nơi có đơn giá hoặc có học phí (GV chỉ theo học sinh không thêm).
  const hasPerSession = !!summary?.hasPerSession
  const showIncome = hasPerSession && (!!stats?.hasPlaceRate || !noPerStudent)

  const incomeCard = (
    <StatCard
      label={t("income_month")}
      value={stats && money((noPerStudent ? 0 : stats.totalRevenueMonth) + stats.placeIncomeMonth)}
      loading={isLoading}
      icon={<HandCoins className="size-4 text-muted-foreground" />}
      hint={
        stats && (
          <>
            {!noPerStudent && (
              <p>{t("income_hint_tuition").replace("{amount}", formatCurrency(stats.totalRevenueMonth))}</p>
            )}
            {stats.hasPlaceRate && (
              // Xuống dòng trước "đã nhận …" thay vì gãy giữa cụm (thẻ 2 cột ở 375px).
              <p>
                {t("income_hint_places")
                  .replace("{amount}", formatCurrency(stats.placeIncomeMonth))
                  .replace("{received}", formatCurrency(stats.placeReceivedMonth))
                  .split(" · ")
                  .map((part, i) => (
                    <Fragment key={i}>
                      {i > 0 && " · "}
                      <span className="whitespace-nowrap">{part}</span>
                    </Fragment>
                  ))}
              </p>
            )}
          </>
        )
      }
    />
  )
  const hoursCard = (className?: string) => (
    <StatCard
      label={t("teaching_hours_month")}
      value={stats && t("ts_hours").replace("{h}", formatHours(stats.teachingHoursMonth))}
      loading={isLoading}
      icon={<Clock className="size-4 text-muted-foreground" />}
      hint={t("teaching_hours_hint")}
      className={className}
    />
  )

  const todayCard = (
    <StatCard
      label={t("sessions_today")}
      value={stats?.sessionsToday}
      loading={isLoading}
      icon={<CalendarDays className="size-4 text-muted-foreground" />}
      hint={t("total_sessions_day")}
    />
  )
  const secondaryCards = (className?: string) => (
    <>
      <StatCard
        label={t("total_students")}
        value={stats?.totalStudents}
        loading={isLoading}
        icon={<Users className="size-4 text-muted-foreground" />}
        hint={t("active_students")}
        className={className}
      />
      <StatCard
        label={t("sessions_this_month")}
        value={stats?.totalSessionsMonth}
        loading={isLoading}
        icon={<CalendarCheck className="size-4 text-muted-foreground" />}
        hint={t("scheduled_this_month")}
        className={className}
      />
      <StatCard
        label={t("attendance_rate")}
        value={stats ? `${stats.attendanceRate}%` : undefined}
        loading={isLoading}
        icon={<BarChart3 className="size-4 text-muted-foreground" />}
        hint={t("average_this_month")}
        className={className}
      />
    </>
  )
  const expectedCard = (className?: string) => (
    <StatCard
      label={t("expected_revenue")}
      value={money(stats?.expectedRevenueMonth)}
      loading={isLoading}
      icon={<Banknote className="size-4 text-muted-foreground" />}
      hint={t("hint_expected_fees")}
      className={className}
    />
  )

  return (
    <div className="space-y-6">
      <PageHeader title={t("dashboard")} />

      <StartCard />
      <FeedbackPrompt />

      {noPerStudent ? (
        // Không có ô học phí: các ô còn lại chung 1 lưới để xếp liền (FIX AL F2); số ô lẻ thì ô cuối chiếm cả hàng ở mobile.
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          {todayCard}
          {showIncome && incomeCard}
          {secondaryCards()}
          {hasPerSession && hoursCard(showIncome ? undefined : "col-span-2 lg:col-span-1")}
        </div>
      ) : (
        <>
          {/* Có nơi theo ca/giờ: mọi ô chung 1 lưới (thêm Thu nhập, Giờ dạy thì 2 lưới sẽ có hàng lửng ở giữa); mobile ẩn ô phụ sau "Xem thêm". */}
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            {todayCard}
            {showIncome && incomeCard}
            <StatCard
              label={t("revenue_this_month")}
              value={money(stats?.totalRevenueMonth)}
              loading={isLoading}
              icon={<Banknote className="size-4 text-muted-foreground" />}
              hint={t("hint_taught_fees")}
            />
            <StatCard
              label={t("collected_amount")}
              value={money(stats?.totalPaidMonth)}
              valueClassName="text-primary"
              loading={isLoading}
              icon={<Wallet className="size-4 text-muted-foreground" />}
              hint={t("hint_collected")}
            />
            <StatCard
              label={t("unpaid_this_month")}
              value={money(stats?.totalUnpaidMonth)}
              valueClassName="text-debt"
              loading={isLoading}
              icon={<AlertCircle className="size-4 text-muted-foreground" />}
              hint={
                stats && (
                  <>
                    {/* Thẻ 2 cột ở 375px hẹp: xuống dòng giữa nhãn và số, không gãy số tiền. */}
                    <p>{t("unpaid_this_month_part")} <span className="whitespace-nowrap">{money(stats.totalUnpaidMonth - stats.unpaidPrevMonths)}</span></p>
                    <p>{t("unpaid_prev_months_part")} <span className="whitespace-nowrap">{money(stats.unpaidPrevMonths)}</span></p>
                  </>
                )
              }
            />
            {hasPerSession && hoursCard()}
            {hasPerSession && secondaryCards(cn(!showMore && "hidden md:block"))}
            {hasPerSession && expectedCard(cn(!showMore && "hidden md:block"))}
          </div>

          {/* Mobile ẩn 4 số phụ sau nút "Xem thêm"; desktop luôn hiện. */}
          {!hasPerSession && (
            <div className={cn("grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4", !showMore && "hidden md:grid")}>
              {secondaryCards()}
              {expectedCard()}
            </div>
          )}

          <Button variant="ghost" className="h-11 w-full md:hidden" onClick={() => setShowMore((v) => !v)}>
            {showMore ? t("show_less_stats") : t("show_more_stats")}
          </Button>
        </>
      )}

      <DashboardAlerts />

      <TodaySessions />
    </div>
  )
}
