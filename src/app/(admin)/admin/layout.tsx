import { notFound } from "next/navigation"
import { auth } from "@/server/auth"
import { isAdminUsername } from "@/lib/admin"
import { SessionProvider } from "@/components/providers/SessionProvider"
import { AdminLayout } from "@/components/admin/AdminLayout"

export default async function AdminGroupLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  // 404 như trang không tồn tại để không lộ có khu quản trị; router admin.* tự chặn thêm bằng adminProcedure.
  if (!isAdminUsername(session?.user?.username)) notFound()
  return (
    <SessionProvider session={session}>
      <AdminLayout>{children}</AdminLayout>
    </SessionProvider>
  )
}
