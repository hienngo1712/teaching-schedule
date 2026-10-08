"use client"

import Link from "next/link"
import { MousePointerClick } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { tourHref, type TourId } from "@/lib/tours"
import { cn } from "@/lib/utils"

export function TourButton({ id, className }: { id: TourId; className?: string }) {
  const { t } = useTranslation()
  return (
    <Button asChild variant="outline" size="sm" className={cn("h-11 gap-1.5 md:h-9", className)}>
      <Link href={tourHref(id)} data-testid={`tour-button-${id}`}>
        <MousePointerClick className="size-4" aria-hidden />
        {t("tour_show_me")}
      </Link>
    </Button>
  )
}
