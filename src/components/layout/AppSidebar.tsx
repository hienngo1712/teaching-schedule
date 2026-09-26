"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { GraduationCap } from "lucide-react"
import { cn } from "@/lib/utils"
import { FEATURE_PLAN } from "@/lib/plans"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { usePlan } from "@/hooks/usePlan"
import { LockBadge } from "@/components/plan/LockBadge"
import { openUpgrade } from "@/components/plan/upgrade-store"
import { MANAGE_ITEMS, NAV_ITEMS, isNavActive, type NavItem } from "./nav-items"

function SidebarLink({ item, pathname, label, locked }: { item: NavItem; pathname: string; label: string; locked: boolean }) {
  const Icon = item.icon
  const active = isNavActive(pathname, item.href)
  if (locked && item.feature) {
    const plan = FEATURE_PLAN[item.feature]
    // P12: vẫn hiện như gói Pro, bấm mở popup nâng cấp thay vì điều hướng.
    return (
      <button
        type="button"
        onClick={() => openUpgrade({ plan })}
        className="flex min-h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm font-medium text-[#4B5563] transition-colors hover:bg-accent hover:text-foreground"
      >
        <Icon className="size-4" />
        <span className="flex-1">{label}</span>
        <LockBadge plan={plan} />
      </button>
    )
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-10 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
        active
          ? "bg-primary/[0.08] font-semibold text-primary"
          : "font-medium text-[#4B5563] hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className="size-4" />
      <span>{label}</span>
    </Link>
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  const { t } = useTranslation()
  const { ready, has } = usePlan()
  const isLocked = (item: NavItem) => !!item.feature && ready && !has(item.feature)

  return (
    <aside className="flex h-full w-[232px] shrink-0 flex-col gap-7 border-r bg-white px-3.5 py-5">
      <div className="flex items-center gap-2.5 px-1">
        <span className="flex size-8 items-center justify-center rounded-[9px] bg-primary">
          <GraduationCap className="size-[18px] text-white" />
        </span>
        <span className="text-base font-semibold text-foreground">{t("calendar")}</span>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <SidebarLink key={item.href} item={item} pathname={pathname} label={t(item.labelKey)} locked={isLocked(item)} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-1 border-t border-[#F0F1F4] pt-4">
        <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          {t("manage_group")}
        </p>
        {MANAGE_ITEMS.map((item) => (
          <SidebarLink key={item.href} item={item} pathname={pathname} label={t(item.labelKey)} locked={isLocked(item)} />
        ))}
      </div>

      <div className="px-1 font-mono text-[11px] leading-tight text-muted-foreground">
        <div>
          v{process.env.NEXT_PUBLIC_APP_VERSION} · {process.env.NEXT_PUBLIC_BUILD_SHA}
        </div>
        <div>{process.env.NEXT_PUBLIC_BUILD_TIME}</div>
      </div>
    </aside>
  )
}
