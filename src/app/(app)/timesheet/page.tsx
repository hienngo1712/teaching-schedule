"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/common/PageHeader"
import { TimesheetTab } from "@/components/timesheet/TimesheetTab"
import { IncomeTab } from "@/components/timesheet/IncomeTab"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { useCalendar } from "@/hooks/useCalendar"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import { cn } from "@/lib/utils"

// Bảng công | Thu nhập (spec AM §4.1). Tab nằm trên URL (?tab=income) để Tổng quan mở thẳng Thu nhập tháng trước.
export default function TimesheetPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const query = useSearchParams()
  const tab = query.get("tab") === "income" ? "income" : "timesheet"
  const { year, month, monthLabel, prevMonth, nextMonth } = useCalendar()
  const isDesktop = useMediaQuery("(min-width: 768px)")

  const setTab = (next: "timesheet" | "income") => {
    const nextQuery = new URLSearchParams(query.toString())
    if (next === "income") nextQuery.set("tab", "income")
    else nextQuery.delete("tab")
    router.replace(`${pathname}${nextQuery.size ? `?${nextQuery}` : ""}`)
  }

  const period = (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
      <Button variant="ghost" size="icon" onClick={prevMonth} className="size-9" aria-label={t("prev_month")}>
        <ChevronLeft className="size-5" />
      </Button>
      <span className="whitespace-nowrap px-2 text-center text-sm font-semibold md:min-w-[110px]">
        {isDesktop ? monthLabel : `${t("month_abbr")}${month}/${year}`}
      </span>
      <Button variant="ghost" size="icon" onClick={nextMonth} className="size-9" aria-label={t("next_month")}>
        <ChevronRight className="size-5" />
      </Button>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader title={t("timesheet")} description={t("timesheet_desc")} />
      <div role="tablist" className="grid w-full grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 md:w-80">
        {(["timesheet", "income"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn("min-h-11 rounded-md text-sm font-semibold md:min-h-9", tab === k ? "bg-white text-primary shadow-sm" : "text-slate-500")}
          >
            {t(k === "timesheet" ? "timesheet" : "income_tab")}
          </button>
        ))}
      </div>
      {tab === "timesheet" ? <TimesheetTab year={year} month={month} period={period} /> : <IncomeTab year={year} month={month} period={period} />}
    </div>
  )
}
