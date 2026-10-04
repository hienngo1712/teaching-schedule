import type { Metadata } from "next"
import { GuideContent } from "@/components/guide/GuideContent"

export const metadata: Metadata = { title: "Hướng dẫn sử dụng" }

// Công khai để gửi link cho giáo viên khác.
export default function GuidePage() {
  return <GuideContent />
}
