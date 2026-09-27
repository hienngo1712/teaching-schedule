import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { auth } from "@/server/auth"
import { ForcedChangePassword } from "./ForcedChangePassword"
import { PasswordAlreadyChanged } from "./PasswordAlreadyChanged"

// Nằm ngoài nhóm (app) để không gọi tRPC nghiệp vụ (đang bị chặn) từ header/sidebar.
export default async function ChangePasswordPage() {
  const session = await auth()
  if (!session?.user) redirect("/login?expired=1")

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          {/* Cờ DB đã tắt (vd sửa tay) mà cookie còn cờ: không redirect để khỏi vòng với middleware (spec P N1). */}
          {session.user.mustChangePassword === true ? <ForcedChangePassword /> : <PasswordAlreadyChanged />}
        </CardContent>
      </Card>
    </div>
  )
}
