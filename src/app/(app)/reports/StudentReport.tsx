"use client"

import { useMemo } from "react"
import { trpc } from "@/lib/trpc"
import { StudentScheduleView } from "@/components/students/StudentScheduleView"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import type { SessionDTO } from "@/server/services/session.service"
import { useTranslation } from "@/components/providers/LanguageProvider"

interface StudentReportProps {
  studentId: number
  year: number
  month: number
}

export function StudentReport({ studentId, year, month }: StudentReportProps) {
  const { t } = useTranslation()
  const { data, isLoading, error } = trpc.report.student.useQuery({
    studentId,
    year,
    month,
  })

  const sessions = useMemo<SessionDTO[]>(() => {
    return (data?.sessions ?? []).map((s) => ({
      ...s,
      sessionDate: new Date(s.sessionDate),
    })) as SessionDTO[]
  }, [data?.sessions])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t("error")}</AlertTitle>
        <AlertDescription>
          {error.message || t("student_report_error")}
        </AlertDescription>
      </Alert>
    )
  }

  if (!data) return null

  return (
    <div className="animate-in fade-in duration-500">
      <StudentScheduleView
        studentId={studentId}
        sessions={sessions}
      />
    </div>
  )
}
