import type { Metadata } from "next"
import { auth } from "@/server/auth"
import { ADMIN_HOME, isAdminUsername } from "@/lib/admin"
import { GuideContent } from "@/components/guide/GuideContent"

export const metadata: Metadata = { title: "Hướng dẫn sử dụng" }

// Công khai để gửi link cho giáo viên khác; nút "Chỉ cho tôi" chỉ hiện cho giáo viên đã đăng nhập.
export default async function GuidePage() {
  const user = (await auth())?.user
  const admin = !!user && isAdminUsername(user.username)
  const canTour = !!user && !admin && user.mustChangePassword !== true
  return <GuideContent canTour={canTour} home={!user ? null : admin ? ADMIN_HOME : "/dashboard"} />
}
