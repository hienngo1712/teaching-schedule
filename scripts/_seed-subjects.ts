// Re-export từ nguồn sự thật duy nhất trong src/ để các script cũ import từ
// đây vẫn chạy được mà không cần sửa.
export { DEFAULT_SUBJECTS, seedSubjectsForUser } from "../src/server/services/subject-defaults"
