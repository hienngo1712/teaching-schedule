"use client"

import { Camera, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useExport } from "@/hooks/useExport"

interface ExportButtonProps {
  elementRef: React.RefObject<HTMLDivElement>
  filename: string
  label?: string
}

export function ExportButton({
  elementRef,
  filename,
  label = "Chụp lịch (PNG)",
}: ExportButtonProps) {
  const { isCapturing, captureElement } = useExport()

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
      {label}
    </Button>
  )
}
