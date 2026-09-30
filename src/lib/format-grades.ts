// Gộp dãy lớp liên tiếp ≥ 3 thành "3–5" để thẻ ca trên lịch không dài.
export function formatGrades(grades: number[], gradeWord: string, compact = false): string {
  if (grades.length === 0) return ""
  const parts: string[] = []
  let i = 0
  while (i < grades.length) {
    let j = i
    while (j + 1 < grades.length && grades[j + 1] === grades[j] + 1) j++
    if (j - i >= 2) parts.push(`${grades[i]}–${grades[j]}`)
    else for (let k = i; k <= j; k++) parts.push(String(grades[k]))
    i = j + 1
  }
  return `${compact ? gradeWord[0] : `${gradeWord} `}${parts.join(", ")}`
}
