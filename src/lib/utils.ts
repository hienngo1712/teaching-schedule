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

// Format: "10/04/2026" — đọc theo UTC để khớp sessionDate (lưu UTC midnight) và
// lưới calendar (dựng theo UTC), tránh lệch 1 ngày ở các múi giờ ≠ UTC.
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  const day = String(d.getUTCDate()).padStart(2, "0")
  const month = String(d.getUTCMonth() + 1).padStart(2, "0")
  const year = d.getUTCFullYear()
  return `${day}/${month}/${year}`
}

// Ngày HÔM NAY theo giờ ĐỊA PHƯƠNG (dd/mm/yyyy). Dùng cho mốc "ngày xuất" —
// đây là giá trị wall-clock của người dùng, KHÁC sessionDate (lưu UTC midnight).
export function formatToday(): string {
  const d = new Date()
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  return `${day}/${month}/${d.getFullYear()}`
}

// Ngày "hôm nay" theo lịch VN (UTC+7), tách thành year/month/day.
// Dùng cho code CHẠY TRÊN SERVER: Vercel chạy UTC nên giờ local của process từ
// 00:00–07:00 giờ VN vẫn đang ở ngày hôm trước — lấy thẳng getDate() sẽ ra sai
// ngày với giáo viên. Cùng quy ước với formatVnDate trong lib/payment-notes.
export function vnDateParts(now: Date = new Date()): {
  year: number
  month: number
  day: number
} {
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  return {
    year: vn.getUTCFullYear(),
    month: vn.getUTCMonth() + 1,
    day: vn.getUTCDate(),
  }
}

// Format: "T2", "T3"... "CN" — đọc theo UTC (xem ghi chú formatDate).
export function formatDayOfWeek(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  const day = d.getUTCDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const names = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]
  return names[day]
}

// Format: "100.000 đ"
export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null) return "0 đ"
  return value.toLocaleString("vi-VN") + " đ"
}

// Loại bỏ dấu tiếng Việt để dùng cho tên file export
export function removeVietnameseTones(str: string): string {
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a")
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e")
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i")
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o")
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u")
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y")
  str = str.replace(/đ/g, "d")
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A")
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E")
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I")
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O")
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U")
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y")
  str = str.replace(/Đ/g, "D")
  // Một số bộ gõ có thể dùng dấu kết hợp
  str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, "") // huyền sắc ngã hỏi nặng
  str = str.replace(/\u02C6|\u0306|\u031B/g, "") // â, ă, ơ, ư
  // Loại bỏ các ký tự đặc biệt
  str = str.replace(/[^a-zA-Z0-9 ]/g, "")
  str = str.replace(/\s+/g, "_") // Thay space bằng underscore
  return str
}
