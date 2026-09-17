export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

export const ATTENDANCE_STATUS = {
  PENDING: "pending",
  PRESENT: "present",
  ABSENT: "absent",
  LATE: "late",
} as const

export const ATTENDANCE_LABEL: Record<string, string> = {
  pending: "Chưa điểm danh",
  present: "Có mặt",
  absent: "Vắng",
  late: "Muộn",
}

export const DAY_NAMES = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const

export const COLORS = {
  primary: "#4F46E5",
  tieuHoc: "#3B82F6",
  thcs: "#10B981",
  present: "#22C55E",
  absent: "#EF4444",
  late: "#F59E0B",
  pending: "#9CA3AF",
} as const
