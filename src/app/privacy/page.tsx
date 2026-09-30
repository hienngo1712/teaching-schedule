import type { Metadata } from "next"
import { PrivacyContent } from "@/components/privacy/PrivacyContent"

export const metadata: Metadata = { title: "Chính sách bảo mật" }

// Công khai, không đọc query (luật next15-contract); layout gốc đã có LanguageProvider.
export default function PrivacyPage() {
  return <PrivacyContent />
}
