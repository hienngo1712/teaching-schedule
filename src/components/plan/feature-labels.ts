import type vi from "@/language/vi.json"
import type { PlanFeatureId } from "@/lib/plans"

export const FEATURE_LABEL_KEY: Record<PlanFeatureId, keyof typeof vi> = {
  schedule: "plan_feat_schedule",
  attendance: "plan_feat_attendance",
  students: "plan_feat_students",
  tuitionCalc: "plan_feat_tuition_calc",
  dashboardStats: "plan_feat_dashboard_stats",
  backup: "plan_feat_backup",
  payments: "plan_feat_payments",
  tuitionNotice: "plan_feat_notice",
  monthlyReport: "plan_feat_monthly_report",
  parentLink: "plan_feat_parent_link",
  dashboardAlerts: "plan_feat_alerts",
  studentImport: "plan_feat_import",
  multiMonthReport: "plan_feat_multi_report",
  unlimitedStudents: "plan_unlimited",
}
