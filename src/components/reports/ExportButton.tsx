"use client"

import { Camera, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useExport } from "@/hooks/useExport"
import { useTranslation } from "@/components/providers/LanguageProvider"

interface ExportButtonProps {
  elementRef: React.RefObject<HTMLDivElement>
  filename: string
  label?: string
}

export function ExportButton({
  elementRef,
  filename,
  label,
}: ExportButtonProps) {
  const { t } = useTranslation()
  const { isCapturing, captureElement } = useExport()
  const displayLabel = label ?? t("capture_schedule_png")

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        if (elementRef?.current) {
          await captureElement(elementRef.current, filename)
        } else {
          console.error("ExportButton: elementRef.current is null or undefined")
        }
      }}
      disabled={isCapturing}
      className="btn-action"
    >
      {isCapturing ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Camera className="mr-2 h-4 w-4" />
      )}
      {displayLabel}
    </Button>
  )
}
