import { AdminPrices } from "@/components/admin/AdminPrices"
import { TrialDaysForm } from "@/components/admin/TrialDaysForm"

export default function AdminPricesPage() {
  return (
    <div className="space-y-8">
      <AdminPrices />
      <TrialDaysForm />
    </div>
  )
}
