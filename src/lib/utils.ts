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

// "HH:mm" → Date (UTC), tương thích với Prisma @db.Time(0)
export function parseTimeToDate(timeStr: string): Date {
  const [h, m] = timeStr.split(":").map(Number)
  const d = new Date(0)
  d.setUTCHours(h, m, 0, 0)
  return d
}

// Date (UTC) → "HH:mm"
export function formatTime(date: Date): string {
  const h = String(date.getUTCHours()).padStart(2, "0")
  const m = String(date.getUTCMinutes()).padStart(2, "0")
  return `${h}:${m}`
}

// Số phút giữa 2 Date (end - start)
export function calcDurationMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 60000)
}

// 45 → "45 phút", 60 → "1h", 90 → "1h 30p"
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} phút`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}p`
}

// Format: "10/04/2026"
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

// Format: "T2", "T3"... "CN"
export function formatDayOfWeek(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  const day = d.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const names = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]
  return names[day]
}
