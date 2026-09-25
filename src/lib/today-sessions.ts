import dayjs from "dayjs"

// So theo ngày lịch như MonthCalendar (dayjs local), bỏ ca hủy để khớp số "Ca dạy hôm nay".
export function filterTodaySessions<T extends { sessionDate: Date; status: string; startTime: string }>(
  sessions: T[],
  today: string
): T[] {
  return sessions
    .filter((s) => s.status !== "cancelled" && dayjs(s.sessionDate).format("YYYY-MM-DD") === today)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}
