"use client"

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

// "Tải PDF" = hộp in của trình duyệt (chọn Lưu dưới dạng PDF), không cần thư viện PDF (spec W §3.2).
export function PrintButton({ label }: { label: string }) {
  return (
    <Button variant="outline" className="h-11 gap-2 md:h-10 print:hidden" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden />
      {label}
    </Button>
  )
}
