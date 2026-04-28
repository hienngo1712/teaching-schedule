import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GraduationCap } from "lucide-react"

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="size-12 rounded-lg bg-indigo-600 flex items-center justify-center">
              <GraduationCap className="size-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-xl">Quản lý lịch dạy</CardTitle>
          <p className="text-sm text-slate-500">
            Form đăng nhập sẽ hoàn thiện ở Phase 2.
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
            Login form (placeholder)
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
