import { notFound } from "next/navigation"
import { auth } from "@/server/auth"
import { isAdminUsername } from "@/server/services/plan.service"
import { AdminPanel } from "@/components/admin/AdminPanel"

export default async function AdminPage() {
  const session = await auth()
  // 404 như trang không tồn tại để không lộ có trang admin; router admin tự chặn thêm bằng adminProcedure.
  if (!isAdminUsername(session?.user?.username)) notFound()
  return <AdminPanel />
}
