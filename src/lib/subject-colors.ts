// Bảng màu cố định (spec A2 §5.3): đủ đậm trên nền trắng, gồm 5 màu của môn mặc định.
export const SUBJECT_COLORS = [
  "#4F46E5",
  "#0891B2",
  "#059669",
  "#D97706",
  "#DC2626",
  "#7C3AED",
  "#DB2777",
  "#2563EB",
  "#65A30D",
  "#475569",
] as const

export function pickNextColor(usedColors: string[]): string {
  const used = new Set(usedColors.map((c) => c.toUpperCase()))
  return SUBJECT_COLORS.find((c) => !used.has(c)) ?? SUBJECT_COLORS[0]
}
