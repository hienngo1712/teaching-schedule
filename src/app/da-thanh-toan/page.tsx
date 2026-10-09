import type { Metadata } from "next"
import { PaidReturnContent } from "@/components/parent/PaidReturnContent"

export const metadata: Metadata = { title: "Thanh toán", robots: { index: false, follow: false } }

// payOS đưa phụ huynh về đây sau khi trả/huỷ (link tạo từ phía giáo viên); công khai, không đọc query.
export default function PaidReturnPage() {
  return <PaidReturnContent />
}
