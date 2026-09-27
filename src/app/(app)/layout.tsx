import { redirect } from "next/navigation"
import { auth } from "@/server/auth"
import { isAdminUsername } from "@/lib/admin"
import { AppLayout } from "@/components/layout/AppLayout"
import { SessionProvider } from "@/components/providers/SessionProvider"

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 1 lần auth() server-side cho tất cả route trong (app); pass xuống SessionProvider
  // để client không phải gọi /api/auth/session.
  const session = await auth()
  // Lưới thứ 2 nếu middleware bị bỏ qua: admin không dùng màn giáo viên (spec J Q3).
  if (isAdminUsername(session?.user?.username)) redirect("/admin/orders")

  return (
    <SessionProvider session={session}>
      <AppLayout>{children}</AppLayout>
    </SessionProvider>
  )
}
