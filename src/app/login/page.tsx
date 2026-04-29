import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GraduationCap } from "lucide-react"
import { auth } from "@/server/auth"
import { LoginForm } from "./LoginForm"

export default async function LoginPage() {
  const session = await auth()
  if (session?.user) {
    redirect("/calendar")
  }

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
          <p className="text-sm text-slate-500">Đăng nhập để tiếp tục</p>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  )
}
