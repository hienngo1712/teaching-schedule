import type { Metadata } from "next"
import { UpdatesContent } from "@/components/whats-new/UpdatesContent"

export const metadata: Metadata = { title: "Các bản cập nhật" }

// Công khai như /guide.
export default function UpdatesPage() {
  return <UpdatesContent />
}
