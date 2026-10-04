"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, Receipt } from "lucide-react"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { useCalendar } from "@/hooks/useCalendar"
import { useFilters } from "@/hooks/useFilters"
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { GRADES } from "@/lib/constants"
import { cn, formatCurrency } from "@/lib/utils"
import { monthKey } from "@/lib/billing"
import { vnDateParts } from "@/lib/utils"
import { dueNow, isInProgressMonth } from "@/lib/tuition-display"
import { useRecordPayment } from "@/hooks/useRecordPayment"
import { TuitionAmountCell } from "@/components/tuition/TuitionAmountCell"
import { TuitionDetailSheet } from "@/components/tuition/TuitionDetailSheet"
import { TuitionNoticeDialog } from "@/components/tuition/TuitionNoticeDialog"
import { TuitionStatusBadge } from "@/components/tuition/TuitionStatusBadge"
import { TuitionNoticeBadge } from "@/components/tuition/TuitionNoticeBadge"
import { useFeatureGate } from "@/hooks/useFeatureGate"
import { LockBadge } from "@/components/plan/LockBadge"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { PageHeader } from "@/components/common/PageHeader"
import { FilterBar } from "@/components/common/FilterBar"
import { ResponsiveList, type Column } from "@/components/common/ResponsiveList"
import type { MonthlyTuitionFilterInput } from "@/lib/schemas/tuition"

type TuitionStatusItem = RouterOutputs["tuition"]["getMonthlyStatus"]["items"][number]

export default function TuitionPage() {
  const { year, month, monthLabel, prevMonth, nextMonth, goToMonth } = useCalendar({ defaultOffset: -1 })
  const {
    selectedGrade,
    setGrade,
    searchStudentName,
    setSearch,
    selectedStatus,
    setStatus,
    selectedNoticeFilter,
    setNoticeFilter,
    selectedStudentId,
    setStudentId,
  } = useFilters()
  const [localSearch, setLocalSearch] = useDebouncedSearch(searchStudentName, setSearch)

  const [selectedStudent, setSelectedStudent] = useState<(TuitionStatusItem & { year: number; month: number }) | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [noticeStudentId, setNoticeStudentId] = useState<number | null>(null)
  const { t } = useTranslation()
  const paymentsGate = useFeatureGate("payments")
  const noticeGate = useFeatureGate("tuitionNotice")
  const recordPayment = useRecordPayment()

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // Chưa mở sheet cho selectedStudentId (deep link mới vào): lọc thẳng theo studentId
  // để chắc chắn tìm thấy HS đích, không phụ thuộc search/trang (xem effect bên dưới).
  const autoOpenedId = useRef<number | null>(null)
  const pendingDeepLinkId = selectedStudentId && autoOpenedId.current !== selectedStudentId ? selectedStudentId : undefined

  const query = trpc.tuition.getMonthlyStatus.useQuery({
    year,
    month,
    grade: selectedGrade || undefined,
    search: searchStudentName || undefined,
    studentId: pendingDeepLinkId,
    status: selectedStatus as MonthlyTuitionFilterInput["status"],
    noticeFilter: (selectedNoticeFilter && selectedNoticeFilter !== "all" ? selectedNoticeFilter : undefined) as MonthlyTuitionFilterInput["noticeFilter"],
    page: currentPage,
    limit: pageSize,
  })

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedGrade, searchStudentName, selectedStatus, selectedNoticeFilter, year, month])

  const items = query.data?.items ?? []
  const totalItems = query.data?.totalCount ?? 0
  const totalPages = query.data?.totalPages ?? 0

  const router = useRouter()
  // Từ sheet tháng đang học sang tháng đã học xong và mở lại sheet đúng HS (qua deep link studentId).
  const handleGoToMonth = (y: number, m: number) => {
    const qs = new URLSearchParams(window.location.search)
    qs.set("year", String(y))
    qs.set("month", String(m))
    if (selectedStudent) qs.set("studentId", String(selectedStudent.studentId))
    autoOpenedId.current = null
    setIsSheetOpen(false)
    router.push(`/tuition?${qs}`)
  }

  const handleOpenDetail = (item: TuitionStatusItem) => {
    setSelectedStudent({ ...item, year, month })
    setIsSheetOpen(true)
  }

  // Link từ Dashboard có studentId: mở sheet đúng HS một lần (tra theo id vì tên có thể trùng).
  useEffect(() => {
    if (!selectedStudentId || autoOpenedId.current === selectedStudentId) return
    const item = query.data?.items.find((i) => i.studentId === selectedStudentId)
    if (!item) return
    autoOpenedId.current = selectedStudentId
    setSelectedStudent({ ...item, year, month })
    setIsSheetOpen(true)
  }, [selectedStudentId, query.data, year, month])

  const offset = (currentPage - 1) * pageSize
  const payFullButton = (item: TuitionStatusItem, className?: string) => {
    const due = dueNow(item)
    // Tháng chưa học xong (cả HS trọn tháng) không thu tiền (người dùng chốt 2026-10-04).
    if (due === 0 || item.inProgress) return null
    return (
      <Button
        size="sm"
        className={className}
        disabled={recordPayment.isPending}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.stopPropagation()
        }}
        onClick={(e) => {
          e.stopPropagation()
          if (paymentsGate.locked) paymentsGate.openUpgrade()
          else recordPayment.payFull({ studentId: item.studentId, year, month }, due)
        }}
      >
        {t("pay_full").replace("{amount}", formatCurrency(due))}
        {paymentsGate.locked && <LockBadge plan={paymentsGate.requiredPlan} className="ml-1.5" />}
      </Button>
    )
  }

  const noticeButton = (item: TuitionStatusItem, className?: string) => (
    <Button
      size="icon"
      variant="outline"
      className={cn("relative", className)}
      aria-label={t("tuition_notice")}
      onClick={(e) => {
        e.stopPropagation()
        if (noticeGate.locked) noticeGate.openUpgrade()
        else setNoticeStudentId(item.studentId)
      }}
    >
      <Receipt className="size-4" />
      {noticeGate.locked && (
        <LockBadge plan={noticeGate.requiredPlan} className="absolute -right-2 -top-2 rounded-full bg-white px-0.5" />
      )}
    </Button>
  )

  const columns: Column<TuitionStatusItem>[] = [
    { header: t("stt"), cell: (_, i) => offset + i + 1, className: "w-[60px] text-center text-slate-400" },
    { header: t("full_name"), cell: (item) => <span className="font-medium text-slate-900">{item.fullName}</span> },
    {
      header: t("grade"),
      cell: (item) => (
        <Badge variant="secondary" className="min-w-[50px] justify-center border-none bg-slate-100 font-medium text-slate-600">
          {item.grade}
        </Badge>
      ),
      className: "w-[80px] text-center",
    },
    { header: t("sessions_count"), cell: (item) => `${item.presentSessions}/${item.totalSessions}`, className: "w-[120px] text-center text-slate-600" },
    {
      header: t("amount_to_pay"),
      cell: (item) => <TuitionAmountCell item={item} month={month} />,
      className: "w-[200px] text-right",
    },
    {
      header: t("status"),
      cell: (item) => (
        <div className="flex flex-col items-center gap-1">
          <TuitionStatusBadge item={item} />
          <TuitionNoticeBadge item={{ ...item, due: dueNow(item) }} />
        </div>
      ),
      className: "w-[160px] text-center",
    },
    {
      header: <span className="sr-only">{t("action")}</span>,
      cell: (item) => (
        <div className="flex justify-end gap-2">
          {noticeButton(item, "size-9")}
          {payFullButton(item)}
        </div>
      ),
      className: "w-[180px] text-right",
    },
  ]

  const activeFilterCount =
    (selectedGrade ? 1 : 0) +
    (selectedStatus && selectedStatus !== "all" ? 1 : 0) +
    (selectedNoticeFilter && selectedNoticeFilter !== "all" ? 1 : 0)

  const nowVn = vnDateParts()
  const prevMonthKey = monthKey(nowVn.year, nowVn.month) - 1
  const viewingMonthKey = monthKey(year, month)
  const isViewingPrev = viewingMonthKey === prevMonthKey
  const isCurrentOrFuture = isInProgressMonth(year, month)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("manage_tuition")}
        description={t("manage_tuition_desc")}
      />

      <FilterBar
        actions={
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="size-9">
              <ChevronLeft className="size-5" />
            </Button>
            <span className="min-w-[110px] px-2 text-center text-sm font-semibold">{monthLabel}</span>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="size-9">
              <ChevronRight className="size-5" />
            </Button>
          </div>
        }
        search={{ value: localSearch, onChange: setLocalSearch, placeholder: t("search_student") }}
        activeCount={activeFilterCount}
        filters={
          <>
            <Select value={selectedStatus || "all"} onValueChange={(v) => setStatus(v)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder={t("status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all_status")}</SelectItem>
                <SelectItem value="fully_paid">{t("fully_paid")}</SelectItem>
                <SelectItem value="paid_this_month">{t("paid_this_month")}</SelectItem>
                <SelectItem value="partial">{t("partial_paid")}</SelectItem>
                <SelectItem value="unpaid">{t("unpaid")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedNoticeFilter || "all"} onValueChange={(v) => setNoticeFilter(v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t("notice_filter")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all_notice")}</SelectItem>
                <SelectItem value="unsent">{t("notice_unsent")}</SelectItem>
                <SelectItem value="sent">{t("notice_sent")}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={selectedGrade?.toString() || "all"}
              onValueChange={(v) => setGrade(v === "all" ? null : parseInt(v))}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder={t("all_grades")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all_grades")}</SelectItem>
                {GRADES.map((g) => (
                  <SelectItem key={g} value={g.toString()}>
                    {t("grade")} {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      {isViewingPrev && (
        <div className="flex items-center justify-between rounded-lg bg-primary/[0.06] px-3 py-2 text-sm text-primary">
          <span>{t("tuition_viewing_prev")}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 font-medium text-primary hover:bg-transparent hover:underline"
            onClick={() => goToMonth(nowVn.year, nowVn.month)}
          >
            {t("tuition_view_month").replace("{m}", String(nowVn.month))}
          </Button>
        </div>
      )}

      {!isViewingPrev && isCurrentOrFuture && (
        <div className="rounded-lg bg-primary/[0.06] px-3 py-2 text-sm text-primary">
          {t("tuition_viewing_current")}
        </div>
      )}

      <ResponsiveList
        items={items}
        getKey={(item) => item.studentId}
        columns={columns}
        onRowClick={handleOpenDetail}
        isLoading={query.isPending}
        isError={query.isError}
        onRetry={() => query.refetch()}
        errorText={t("load_error")}
        retryText={t("retry")}
        emptyText={t("no_students_found")}
        renderCard={(item) => (
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleOpenDetail(item)}
            onKeyDown={(e) => e.target === e.currentTarget && e.key === "Enter" && handleOpenDetail(item)}
            className="rounded-lg border bg-white p-4 transition-transform active:scale-[0.98]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-base font-medium text-slate-900">{item.fullName}</p>
                <Badge variant="secondary" className="mt-1 border-none bg-slate-100 font-medium text-slate-500">
                  {t("grade")} {item.grade}
                </Badge>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex flex-wrap items-center justify-end gap-1">
                <TuitionStatusBadge item={item} />
                <TuitionNoticeBadge item={{ ...item, due: dueNow(item) }} />
                </div>
                <span className="text-xs text-slate-500">
                  {item.presentSessions}/{item.totalSessions} {t("sessions")}
                </span>
              </div>
            </div>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-slate-500">{t("amount_to_pay")}</div>
                  <TuitionAmountCell item={item} month={month} className="items-start" amountClassName="text-[17px]" />
                </div>
                {noticeButton(item, "size-11 shrink-0")}
              </div>
              {/* Nút rộng cả thẻ (spec Y §4.1): "Paid in full 100.000.000 đ" đặt cạnh số tiền sẽ tràn ngang ở 390px. */}
              {payFullButton(item, "mt-2 h-11 w-full")}
            </div>
          </div>
        )}
      />

        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          totalItems={totalItems}
        />

      <TuitionDetailSheet
        open={isSheetOpen}
        onOpenChange={(open) => {
          setIsSheetOpen(open)
          // Đóng sheet mà URL còn studentId (vào từ deep link) → bỏ đi, tránh Back mở lại.
          if (!open && selectedStudentId) setStudentId(null, { replace: true })
        }}
        data={selectedStudent}
        // TRPCProvider tự invalidate sau mutation
        onSuccess={() => {}}
        // Chưa biết gói cũng coi như khóa: sheet không gọi payment.list (tránh FORBIDDEN).
        paymentsLocked={!paymentsGate.allowed}
        onGoToMonth={handleGoToMonth}
      />

      {noticeStudentId !== null && (
        <TuitionNoticeDialog
          studentId={noticeStudentId}
          year={year}
          month={month}
          onClose={() => setNoticeStudentId(null)}
        />
      )}
    </div>
  )
}
