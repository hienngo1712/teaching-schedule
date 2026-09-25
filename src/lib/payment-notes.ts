/**
 * Ngày theo giờ VN (UTC+7) dạng dd/mm/yyyy. Không dùng giờ local của process vì
 * server chạy UTC (Vercel) — sẽ lệch ngày với giáo viên trước 07:00 sáng.
 */
export function formatVnDate(now: Date): string {
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const day = String(vn.getUTCDate()).padStart(2, "0")
  const month = String(vn.getUTCMonth() + 1).padStart(2, "0")
  return `${day}/${month}/${vn.getUTCFullYear()}`
}
