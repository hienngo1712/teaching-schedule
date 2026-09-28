import { redirect } from "next/navigation"
import { ADMIN_HOME } from "@/lib/admin"

export default function AdminIndexPage() {
  redirect(ADMIN_HOME)
}
