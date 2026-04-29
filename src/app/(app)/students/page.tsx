import { StudentList } from "@/components/students/StudentList"

export default function StudentsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Học sinh</h1>
      <StudentList />
    </div>
  )
}
