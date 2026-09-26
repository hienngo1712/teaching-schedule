"use client"

import Link from "next/link"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { closeUpgrade, useUpgradeRequest } from "./upgrade-store"

// Host duy nhất, gắn trong AppLayout; mở bằng openUpgrade() từ bất kỳ đâu.
export function UpgradeDialog() {
  const { t } = useTranslation()
  const req = useUpgradeRequest()
  const text = req?.message ?? (req?.plan === "pro" ? t("upgrade_to_pro") : t("upgrade_to_plus_or_pro"))

  return (
    <Dialog open={req !== null} onOpenChange={(open) => !open && closeUpgrade()}>
      <DialogContent data-testid="upgrade-dialog" className="max-w-[calc(100%-2rem)] rounded-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock aria-hidden className="size-5 text-primary" />
            {t("upgrade_title")}
          </DialogTitle>
          <DialogDescription>{text}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" className="h-11 md:h-10" onClick={closeUpgrade}>
            {t("plan_later")}
          </Button>
          <Button asChild className="h-11 md:h-10">
            <Link href="/plan" onClick={closeUpgrade}>
              {t("plan_view_plans")}
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
