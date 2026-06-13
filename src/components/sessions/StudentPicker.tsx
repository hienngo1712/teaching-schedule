"use client"

import { useState, useMemo } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { trpc } from "@/lib/trpc"
import { GRADES } from "@/lib/constants"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = {
  value: number[]
  onChange: (value: number[]) => void
  /**
   * HS đang gắn với ca (kèm tên), dùng để hiển thị các HS đã được chọn nhưng đã bị
   * xóa khỏi danh sách (isActive=false) — vốn không xuất hiện trong list active —
   * để user vẫn có thể bỏ chọn / gỡ ra.
   */
  knownStudents?: Array<{ studentId: number; fullName: string; grade: number }>
}

export function StudentPicker({ value, onChange, knownStudents = [] }: Props) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const [grade, setGrade] = useState<string>("all")

  const { data: studentListData, isLoading } = trpc.student.list.useQuery({
    isActive: true,
    limit: 1000,
  })

  const filteredStudents = useMemo(() => {
    const students = studentListData?.items ?? []
    return students.filter((s) => {
      const matchSearch = s.fullName
        .toLowerCase()
        .includes(search.toLowerCase())
      const matchGrade = grade === "all" || s.grade === Number(grade)
      return matchSearch && matchGrade
    })
  }, [studentListData?.items, search, grade])

  // HS đã được chọn nhưng không còn trong danh sách active (đã bị xóa).
  // Hiện riêng ở đầu để user có thể bỏ chọn, dù chúng bị ẩn khỏi list active.
  const inactiveSelected = useMemo(() => {
    const activeIds = new Set((studentListData?.items ?? []).map((s) => s.id))
    const byId = new Map(knownStudents.map((s) => [s.studentId, s]))
    return value
      .filter((id) => !activeIds.has(id))
      .map((id) => byId.get(id))
      .filter((s): s is NonNullable<typeof s> => s != null)
  }, [studentListData?.items, knownStudents, value])

  const toggleStudent = (id: number) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id))
    } else {
      onChange([...value, id])
    }
  }

  const isAllSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => value.includes(s.id))

  const toggleAll = (checked: boolean) => {
    if (checked) {
      const newIds = filteredStudents
        .map((s) => s.id)
        .filter((id) => !value.includes(id))
      onChange([...value, ...newIds])
    } else {
      const filteredIds = filteredStudents.map((s) => s.id)
      onChange(value.filter((id) => !filteredIds.includes(id)))
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-slate-400" />
          <Input
            placeholder={t("search_student")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={grade} onValueChange={setGrade}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder={t("grade")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all_grades")}</SelectItem>
            {GRADES.map((g) => (
              <SelectItem key={g} value={String(g)}>
                {t("grade")} {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-md p-2">
        {inactiveSelected.length > 0 && (
          <div className="space-y-2 border-b pb-2 mb-2">
            {inactiveSelected.map((s) => (
              <div
                key={s.studentId}
                className="flex items-center space-x-2 rounded-sm p-1 bg-amber-50"
              >
                <Checkbox
                  id={`student-inactive-${s.studentId}`}
                  checked={value.includes(s.studentId)}
                  onCheckedChange={() => toggleStudent(s.studentId)}
                />
                <Label
                  htmlFor={`student-inactive-${s.studentId}`}
                  className="flex-1 cursor-pointer text-sm font-normal"
                >
                  <span className="font-medium text-slate-500 line-through">
                    {s.fullName}
                  </span>
                  <span className="ml-2 text-slate-400 text-xs">
                    {t("grade")} {s.grade}
                  </span>
                </Label>
                <Badge variant="outline" className="text-amber-700 border-amber-300 text-[10px]">
                  {t("deleted_student_badge")}
                </Badge>
              </div>
            ))}
          </div>
        )}
        {filteredStudents.length > 0 && (
          <div className="flex items-center space-x-2 border-b pb-2 mb-2 px-1">
            <Checkbox
              id="select-all"
              checked={isAllSelected}
              onCheckedChange={(checked) => toggleAll(!!checked)}
            />
            <Label
              htmlFor="select-all"
              className="flex-1 cursor-pointer text-sm font-semibold"
            >
              {t("select_all_count").replace("{count}", String(filteredStudents.length))}
            </Label>
          </div>
        )}
        <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
          {isLoading ? (
            <div className="text-center py-4 text-sm text-slate-500">
              {t("loading")}
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-4 text-sm text-slate-500">
              {t("no_students_found")}
            </div>
          ) : (
            filteredStudents.map((s) => (
              <div
                key={s.id}
                className="flex items-center space-x-2 rounded-sm p-1 hover:bg-slate-50"
              >
                <Checkbox
                  id={`student-${s.id}`}
                  checked={value.includes(s.id)}
                  onCheckedChange={() => toggleStudent(s.id)}
                />
                <Label
                  htmlFor={`student-${s.id}`}
                  className="flex-1 cursor-pointer text-sm font-normal"
                >
                  <span className="font-medium">{s.fullName}</span>
                  <span className="ml-2 text-slate-500 text-xs">
                    {t("grade")} {s.grade}
                  </span>
                </Label>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="text-xs text-slate-500">
        {t("selected_count").replace("{count}", String(value.length))}
      </div>
    </div>
  )
}
