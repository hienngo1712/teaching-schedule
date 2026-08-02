"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, Search, Wallet, CheckCircle2, AlertCircle, Clock, CircleDollarSign, BadgeCheck } from "lucide-react"
import { trpc, type RouterOutputs } from "@/lib/trpc"
import { useCalendar } from "@/hooks/useCalendar"
import { useFilters } from "@/hooks/useFilters"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { GRADES } from "@/lib/constants"
import { formatCurrency } from "@/lib/utils"
import { TuitionDetailSheet } from "@/components/tuition/TuitionDetailSheet"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { useTranslation } from "@/components/providers/LanguageProvider"
import type { MonthlyTuitionFilterInput } from "@/lib/schemas/tuition"


type TuitionStatusItem = RouterOutputs["tuition"]["getMonthlyStatus"]["items"][number]

function getStatusBadge(item: TuitionStatusItem, t: ReturnType<typeof useTranslation>["t"]) {
  const adjustedAmount = Math.max(0, item.totalAmountDue)

  if (item.paidAmount > adjustedAmount && adjustedAmount > 0) {
    return (
      <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none">
        <CircleDollarSign className="size-3 mr-1" /> {t("overpaid")}
      </Badge>
    )
  }

  // Tất toán nhưng số tiền thực đóng chưa đủ → là MIỄN/GIẢM, không phải "đóng đủ".
  // Hiển thị riêng để danh sách không nói dối khi GV lỡ tick rồi sửa tiền xuống.
  if (item.isFullPaid && item.paidAmount < adjustedAmount) {
    return (
      <Badge className="bg-teal-100 text-teal-700 hover:bg-teal-100 border-none">
        <BadgeCheck className="size-3 mr-1" /> {t("settled_waived")}
      </Badge>
    )
  }

  // Đã tất toán (GV đánh dấu) → xanh "đóng đủ" dù paidAmount chưa khớp tổng nợ
  // (có thể miễn/giảm). Khớp StudentScheduleView, dashboard và carry-over backend.
  if (item.isFullPaid) {
    return (
      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">
        <CheckCircle2 className="size-3 mr-1" /> {t("fully_paid")}
      </Badge>
    )
  }

  if (item.paidAmount >= adjustedAmount && adjustedAmount > 0) {
    return (
      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">
        <CheckCircle2 className="size-3 mr-1" /> {t("fully_paid")}
      </Badge>
    )
  }

  if (item.paidAmount >= item.totalExpected && item.totalExpected > 0 && item.previousBalance > 0) {
    return (
      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">
        <CheckCircle2 className="size-3 mr-1" /> {t("paid_this_month")}
      </Badge>
    )
  }

  if (item.paidAmount > 0) {
    return (
      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none">
        <Clock className="size-3 mr-1" /> {t("partial_paid")}
      </Badge>
    )
  }

  if (adjustedAmount > 0) {
    return (
      <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none">
        <AlertCircle className="size-3 mr-1" /> {t("unpaid")}
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="text-slate-400 border-slate-200 font-normal">
      {t("no_sessions")}
    </Badge>
  )
}

export default function TuitionPage() {
  const { year, month, monthLabel, prevMonth, nextMonth } = useCalendar()
  const { selectedGrade, setGrade, searchStudentName, setSearch, selectedStatus, setStatus } = useFilters()

  const [selectedStudent, setSelectedStudent] = useState<(TuitionStatusItem & { year: number; month: number }) | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const { t } = useTranslation()

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  const query = trpc.tuition.getMonthlyStatus.useQuery({
    year,
    month,
    grade: selectedGrade || undefined,
    search: searchStudentName || undefined,
    status: selectedStatus as MonthlyTuitionFilterInput["status"],
    page: currentPage,
    limit: pageSize,
  })

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedGrade, searchStudentName, selectedStatus, year, month])

  const items = query.data?.items ?? []
  const totalItems = query.data?.totalCount ?? 0
  const totalPages = query.data?.totalPages ?? 0

  const handleOpenDetail = (item: TuitionStatusItem) => {
    setSelectedStudent({ ...item, year, month })
    setIsSheetOpen(true)
  }

  return (
    <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t("manage_tuition")}</h1>
            <p className="text-slate-500 text-sm mt-1">{t("manage_tuition_desc")}</p>
          </div>

          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1 shadow-sm w-full md:w-auto justify-between md:justify-start">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="h-9 w-9 rounded-lg">
              <ChevronLeft className="size-5" />
            </Button>
            <span className="text-sm font-bold px-4 min-w-[120px] text-center">
              {monthLabel}
            </span>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-9 w-9 rounded-lg">
              <ChevronRight className="size-5" />
            </Button>
          </div>
        </div>

        <div className="px-1 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                placeholder={t("search_student")}
                className="pl-10 h-11 bg-white border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500/20 transition-all"
                value={searchStudentName}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select
                value={selectedStatus || "all"}
                onValueChange={(v) => setStatus(v)}
              >
                <SelectTrigger className="flex-1 md:w-[160px] h-11 bg-white border-slate-200 rounded-xl shadow-sm">
                  <SelectValue placeholder={t("status")} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">{t("all_status")}</SelectItem>
                  <SelectItem value="fully_paid">{t("fully_paid")}</SelectItem>
                  <SelectItem value="paid_this_month">{t("paid_this_month")}</SelectItem>
                  <SelectItem value="partial">{t("partial_paid")}</SelectItem>
                  <SelectItem value="unpaid">{t("unpaid")}</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={selectedGrade?.toString() || "all"}
                onValueChange={(v) => setGrade(v === "all" ? null : parseInt(v))}
              >
                <SelectTrigger className="w-[110px] md:w-[130px] h-11 bg-white border-slate-200 rounded-xl shadow-sm">
                  <SelectValue placeholder={t("all_grades")} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">{t("all_grades")}</SelectItem>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={g.toString()}>
                      {t("grade")} {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Mobile View: Card List */}
          <div className="md:hidden space-y-3">
            {query.isPending ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                      <Skeleton className="h-6 w-20" />
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                       <Skeleton className="h-5 w-24" />
                       <Skeleton className="h-8 w-24" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : items.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                <p className="text-slate-400 italic">{t("no_students_found")}</p>
              </div>
            ) : (
              items.map((item) => (
                <Card 
                  key={item.studentId} 
                  className="border-slate-200 shadow-sm rounded-2xl overflow-hidden active:scale-[0.98] transition-transform"
                  onClick={() => handleOpenDetail(item)}
                >
                  <CardContent className="p-4 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-slate-900 text-lg leading-tight">{item.fullName}</div>
                        <Badge variant="secondary" className="mt-1 bg-slate-100 text-slate-500 border-none font-medium">
                          {t("grade")} {item.grade}
                        </Badge>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {getStatusBadge(item, t)}
                        <span className="text-[10px] text-slate-400 font-medium">
                          {item.presentSessions}/{item.totalSessions} {t("sessions")}
                        </span>
                      </div>
                    </div>
                    
                    <div className="pt-3 border-t border-slate-100 flex justify-between items-end">
                      <div className="space-y-0.5">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t("amount_to_pay")}</div>
                        <div className="text-lg font-medium text-slate-900">{formatCurrency(item.totalAmountDue)}</div>
                      </div>
                      <Button size="sm" className="rounded-xl h-9 px-4 font-bold bg-slate-900 hover:bg-slate-800 shadow-md shadow-slate-200">
                        <Wallet className="size-3.5 mr-1.5" />
                        {t("record_payment")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Desktop View: Table */}
          <Card className="hidden md:flex flex-col bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="w-[60px] text-center font-bold text-slate-400 uppercase text-[11px] tracking-wider">{t("stt")}</TableHead>
                    <TableHead className="w-[220px] font-bold text-slate-400 uppercase text-[11px] tracking-wider">{t("full_name")}</TableHead>
                    <TableHead className="w-[80px] text-center font-bold text-slate-400 uppercase text-[11px] tracking-wider">{t("grade")}</TableHead>
                    <TableHead className="w-[140px] text-center font-bold text-slate-400 uppercase text-[11px] tracking-wider">{t("sessions_count")}</TableHead>
                    <TableHead className="w-[160px] text-right font-bold text-slate-400 uppercase text-[11px] tracking-wider whitespace-nowrap">{t("amount_to_pay")}</TableHead>
                    <TableHead className="w-[180px] text-center font-bold text-slate-400 uppercase text-[11px] tracking-wider">{t("status")}</TableHead>
                    <TableHead className="w-[100px] text-right font-bold text-slate-400 uppercase text-[11px] tracking-wider">{t("action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.isPending ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-6 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-slate-400 italic">
                        {t("no_students_found")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item, index) => {
                      const actualIndex = (currentPage - 1) * pageSize + index + 1
                      return (
                        <TableRow key={item.studentId} className="hover:bg-slate-50/50 transition-colors border-slate-100 cursor-pointer" onClick={() => handleOpenDetail(item)}>
                          <TableCell className="text-center text-slate-400 font-medium text-sm">
                            {actualIndex}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-slate-900">{item.fullName}</div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none min-w-[50px] justify-center font-medium">
                              {item.grade}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-medium text-slate-600 text-sm">
                            {item.presentSessions}/{item.totalSessions}
                          </TableCell>
                          <TableCell className="text-right font-medium text-slate-900">
                            {formatCurrency(item.totalAmountDue)}
                          </TableCell>
                          <TableCell className="text-center">
                            {getStatusBadge(item, t)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenDetail(item)
                              }}
                            >
                              <Wallet className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

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
        onOpenChange={setIsSheetOpen}
        data={selectedStudent}
        onSuccess={() => query.refetch()}
      />
    </div>
  )
}
