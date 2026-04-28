import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Tính cấp học từ lớp (1–5 = tiểu học, 6–9 = THCS)
export function getLevel(grade: number): "tieu_hoc" | "thcs" {
  return grade <= 5 ? "tieu_hoc" : "thcs"
}

// Tỉ lệ điểm danh — không chia cho 0
export function calcAttendanceRate(present: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((present / total) * 10000) / 100
}
