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
import { trpc } from "@/lib/trpc"
import { GRADES } from "@/lib/constants"
import { useTranslation } from "@/components/providers/LanguageProvider"

type Props = {
  value: number[]
  onChange: (value: number[]) => void
}

export function StudentPicker({ value, onChange }: Props) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const [grade, setGrade] = useState<string>("all")

  const { data: students = [], isLoading } = trpc.student.list.useQuery({
    isActive: true,
  })

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchSearch = s.fullName
        .toLowerCase()
        .includes(search.toLowerCase())
      const matchGrade = grade === "all" || s.grade === Number(grade)
      return matchSearch && matchGrade
    })
  }, [students, search, grade])

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
