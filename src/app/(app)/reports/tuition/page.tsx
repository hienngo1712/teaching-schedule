"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Search, Wallet, CheckCircle2, AlertCircle, Clock } from "lucide-react"
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

export default function TuitionPage() {
  const { year, month, monthLabel, prevMonth, nextMonth } = useCalendar()
  const { selectedGrade, setGrade, searchStudentName, setSearch } = useFilters()
  
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)

  const query = trpc.tuition.getMonthlyStatus.useQuery({
    year,
    month,
    grade: selectedGrade || undefined,
    search: searchStudentName || undefined,
  })

  const handleOpenPayment = (student: any) => {
    setSelectedStudent({
      ...student,
      year,
      month,
    })
    setIsPaymentOpen(true)
  }

  const getStatusBadge = (student: any) => {
    if (student.isFullPaid) {
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">
          <CheckCircle2 className="size-3 mr-1" /> Đã đóng đủ
        </Badge>
      )
    }
    if (student.paidAmount > 0) {
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none">
          <Clock className="size-3 mr-1" /> Chưa đóng đủ
        </Badge>
      )
    }
    if (student.totalExpected > 0) {
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none">
          <AlertCircle className="size-3 mr-1" /> Chưa đóng
        </Badge>
      )
    }
    return (
      <Badge variant="outline" className="text-slate-400 border-slate-200 font-normal">
        Không có buổi học
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý đóng học phí</h1>
          <p className="text-slate-500 text-sm mt-1">Theo dõi tình trạng đóng tiền hàng tháng của học sinh</p>
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

      <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                placeholder="Tìm tên học sinh..."
                className="pl-9 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                value={searchStudentName}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Select
                value={selectedGrade?.toString() || "all"}
                onValueChange={(v) => setGrade(v === "all" ? null : parseInt(v))}
              >
                <SelectTrigger className="w-[140px] bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Tất cả lớp" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả lớp</SelectItem>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={g.toString()}>
                      Lớp {g}
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
                <TableHead className="w-[60px] text-center font-bold">STT</TableHead>
                <TableHead className="font-bold">Họ và tên</TableHead>
                <TableHead className="w-[80px] text-center font-bold">Lớp</TableHead>
                <TableHead className="w-[120px] text-center font-bold">Số buổi</TableHead>
                <TableHead className="text-right font-bold">Tổng tiền</TableHead>
                <TableHead className="text-right font-bold">Đã đóng</TableHead>
                <TableHead className="w-[160px] text-center font-bold">Trạng thái</TableHead>
                <TableHead className="w-[120px] text-right font-bold">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isPending ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : query.data?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-slate-400 italic">
                    Không tìm thấy học sinh nào
                  </TableCell>
                </TableRow>
              ) : (
                query.data?.map((item, index) => (
                  <TableRow key={item.studentId} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="text-center text-slate-500 font-medium">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{item.fullName}</div>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none">
                        Lớp {item.grade}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium text-slate-600">
                      {item.presentSessions}/{item.totalSessions}
                    </TableCell>
                    <TableCell className="text-right font-bold text-slate-900">
                      {formatCurrency(item.totalExpected)}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-bold",
                      item.isFullPaid ? "text-green-600" : item.paidAmount > 0 ? "text-amber-600" : "text-slate-400"
                    )}>
                      {formatCurrency(item.paidAmount)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(item)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all"
                        onClick={() => handleOpenPayment(item)}
                      >
                        <Wallet className="size-3.5" />
                        Ghi nhận
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <PaymentDialog
        open={isPaymentOpen}
        onOpenChange={setIsPaymentOpen}
        data={selectedStudent}
        onSuccess={() => query.refetch()}
      />
    </div>
  )
}
