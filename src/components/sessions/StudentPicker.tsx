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

type Props = {
  value: number[]
  onChange: (value: number[]) => void
}

export function StudentPicker({ value, onChange }: Props) {
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

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-slate-400" />
          <Input
            placeholder="Tìm tên học sinh..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={grade} onValueChange={setGrade}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Lớp" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả lớp</SelectItem>
            {GRADES.map((g) => (
              <SelectItem key={g} value={String(g)}>
                Lớp {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-md p-2">
        <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
          {isLoading ? (
            <div className="text-center py-4 text-sm text-slate-500">
              Đang tải danh sách...
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-4 text-sm text-slate-500">
              Không tìm thấy học sinh nào
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
                    Lớp {s.grade}
                  </span>
                </Label>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="text-xs text-slate-500">
        Đã chọn: {value.length} học sinh
      </div>
    </div>
  )
}
