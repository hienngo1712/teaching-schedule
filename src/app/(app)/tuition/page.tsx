"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Search, Wallet, CheckCircle2, AlertCircle, Clock, CircleDollarSign } from "lucide-react"
import { trpc } from "@/lib/trpc"
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
import { formatCurrency, cn } from "@/lib/utils"
import { PaymentDialog } from "@/components/tuition/PaymentDialog"
import { usePagination } from "@/hooks/usePagination"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { useTranslation } from "@/components/providers/LanguageProvider"
import type { MonthlyTuitionFilterInput } from "@/lib/schemas/tuition"


interface TuitionStatusItem {
  studentId: number
  fullName: string
  grade: number
  totalSessions: number
  presentSessions: number
  totalExpected: number
  paidAmount: number
  isFullPaid: boolean
  notes: string | null
  previousBalance: number
}

export default function TuitionPage() {
  const { year, month, monthLabel, prevMonth, nextMonth } = useCalendar()
  const { selectedGrade, setGrade, searchStudentName, setSearch, selectedStatus, setStatus } = useFilters()

  const [selectedStudent, setSelectedStudent] = useState<(TuitionStatusItem & { year: number; month: number }) | null>(null)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)
  const { t } = useTranslation()
  const query = trpc.tuition.getMonthlyStatus.useQuery({
    year,
    month,
    grade: selectedGrade || undefined,
    search: searchStudentName || undefined,
    status: selectedStatus as MonthlyTuitionFilterInput["status"],
  })

  const {
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    paginatedData,
    totalItems,
    totalPages,
  } = usePagination(query.data)

  const handleOpenPayment = (item: TuitionStatusItem) => {
    setSelectedStudent({
      ...item,
      year,
      month,
    })
    setIsPaymentOpen(true)
  }

  const getStatusBadge = (item: TuitionStatusItem) => {
    const adjustedAmount = Math.max(0, item.totalExpected + item.previousBalance)

    // 1. Surplus
    if (item.paidAmount > adjustedAmount && adjustedAmount > 0) {
      return (
        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none">
          <CircleDollarSign className="size-3 mr-1" /> {t("overpaid")}
        </Badge>
      )
    }

    // 2. Cleared all debt and this month
    if (item.paidAmount >= adjustedAmount && adjustedAmount > 0) {
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">
          <CheckCircle2 className="size-3 mr-1" /> {t("fully_paid")}
        </Badge>
      )
    }

    // 3. Paid this month's fee but still owes debt
    if (item.paidAmount >= item.totalExpected && item.totalExpected > 0 && item.previousBalance > 0) {
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">
          <CheckCircle2 className="size-3 mr-1" /> {t("paid_this_month")}
        </Badge>
      )
    }

    // 4. Partial payment (doesn't even cover this month's fee)
    if (item.paidAmount > 0) {
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none">
          <Clock className="size-3 mr-1" /> {t("partial_paid")}
        </Badge>
      )
    }

    // 5. Unpaid
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

  return (
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t("manage_tuition")}</h1>
            <p className="text-slate-500 text-sm mt-1">{t("manage_tuition_desc")}</p>
          </div>

          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-bold px-2 min-w-[120px] text-center">
              {monthLabel}
            </span>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <Card className="bg-white border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input
                  placeholder={t("search_student")}
                  className="pl-9 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                  value={searchStudentName}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Select
                  value={selectedStatus || "all"}
                  onValueChange={(v) => setStatus(v)}
                >
                  <SelectTrigger className="w-[180px] bg-slate-50 border-slate-200">
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

                <Select
                  value={selectedGrade?.toString() || "all"}
                  onValueChange={(v) => setGrade(v === "all" ? null : parseInt(v))}
                >
                  <SelectTrigger className="w-[140px] bg-slate-50 border-slate-200">
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
              </div>
            </div>
          </CardContent>

          <div className="border-t border-slate-100 overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-[50px] text-center font-bold">{t("stt")}</TableHead>
                  <TableHead className="font-bold">{t("full_name")}</TableHead>
                  <TableHead className="w-[70px] text-center font-bold">{t("grade")}</TableHead>
                  <TableHead className="w-[90px] text-center font-bold">{t("sessions_count")}</TableHead>
                  <TableHead className="text-right font-bold whitespace-nowrap">{t("total_this_month")}</TableHead>
                  <TableHead className="text-right font-bold whitespace-nowrap">{t("total_last_month")}</TableHead>
                  <TableHead className="text-right font-bold whitespace-nowrap">{t("amount_to_pay")}</TableHead>
                  <TableHead className="w-[150px] text-center font-bold">{t("status")}</TableHead>
                  <TableHead className="text-right font-bold">{t("paid")}</TableHead>
                  <TableHead className="w-[90px] text-right font-bold">{t("action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.isPending ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 10 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-6 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : query.data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-slate-400 italic">
                      {t("no_students_found")}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((item, index) => {
                    const adjustedAmount = Math.max(0, item.totalExpected + item.previousBalance)
                    const actualIndex = (currentPage - 1) * pageSize + index + 1
                    return (
                      <TableRow key={item.studentId} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="text-center text-slate-500 font-medium">
                          {actualIndex}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-slate-900">{item.fullName}</div>
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none min-w-[60px] justify-center">
                            {t("grade")} {item.grade}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-medium text-slate-600">
                          {item.presentSessions}/{item.totalSessions}
                        </TableCell>
                        <TableCell className="text-right font-medium text-slate-900">
                          {formatCurrency(item.totalExpected)}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-medium",
                          item.previousBalance > 0 ? "text-red-600" : item.previousBalance < 0 ? "text-green-600" : "text-slate-400"
                        )}>
                          {item.previousBalance > 0 ? "+" : ""}{formatCurrency(item.previousBalance)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-indigo-600">
                          {formatCurrency(adjustedAmount)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(item)}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-bold",
                          item.paidAmount > adjustedAmount ? "text-purple-600" :
                          item.paidAmount >= adjustedAmount && adjustedAmount > 0 ? "text-green-600" :
                          item.paidAmount >= item.totalExpected && item.totalExpected > 0 && item.previousBalance > 0 ? "text-blue-600" :
                          item.paidAmount > 0 ? "text-amber-600" :
                          "text-slate-400"
                        )}>
                          {formatCurrency(item.paidAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all"
                            onClick={() => handleOpenPayment(item)}
                          >
                            <Wallet className="size-3.5" />
                            {t("record_payment")}
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

      <DataTablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        totalItems={totalItems}
      />

      <PaymentDialog
        open={isPaymentOpen}
        onOpenChange={setIsPaymentOpen}
        data={selectedStudent}
        onSuccess={() => query.refetch()}
      />
    </div>
  )
}
