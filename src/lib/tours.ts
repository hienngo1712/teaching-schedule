import type vi from "@/language/vi.json"

export type TourId = "student" | "import" | "session" | "attendance" | "tuition" | "bank"
export type TourKey = keyof typeof vi
// target = giá trị data-tour; null = khung giữa màn. "click" = chờ người dùng bấm target (spec AD §3).
export type TourStep = {
  target: string | null
  titleKey: TourKey
  bodyKey: TourKey
  advanceOn?: "next" | "click"
  nextTour?: TourId
  nextLabelKey?: TourKey
}
export type Tour = { id: TourId; href: string; steps: TourStep[]; requires?: "student" | "session" }

export const TOUR_PARAM = "tour"
export const TOUR_WAIT_MS = 3000
// Bước đầu: trang vừa chuyển có thể tải nguội (dev, mạng chậm) lâu hơn 3 giây.
export const TOUR_FIRST_WAIT_MS = 8000
export const TOUR_POLL_MS = 100

export const TOURS: Record<TourId, Tour> = {
  student: {
    id: "student",
    href: "/students",
    steps: [
      { target: "student-add", titleKey: "tour_student_1_title", bodyKey: "tour_student_1_body", advanceOn: "click" },
      { target: "student-form-name", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body" },
      { target: "student-form-billing", titleKey: "tour_student_3_title", bodyKey: "tour_student_3_body" },
      { target: "student-form-parent", titleKey: "tour_student_4_title", bodyKey: "tour_student_4_body" },
      { target: "student-form-submit", titleKey: "tour_student_5_title", bodyKey: "tour_student_5_body" },
    ],
  },
  import: {
    id: "import",
    href: "/students",
    steps: [
      { target: "student-add-more", titleKey: "tour_import_1_title", bodyKey: "tour_import_1_body", advanceOn: "click" },
      { target: "student-import-item", titleKey: "tour_import_2_title", bodyKey: "tour_import_2_body", advanceOn: "click" },
      { target: "import-template", titleKey: "tour_import_3_title", bodyKey: "tour_import_3_body" },
      { target: "import-file", titleKey: "tour_import_4_title", bodyKey: "tour_import_4_body" },
      { target: "import-google-form", titleKey: "tour_import_5_title", bodyKey: "tour_import_5_body" },
    ],
  },
  session: {
    id: "session",
    href: "/calendar",
    steps: [
      { target: "session-add", titleKey: "tour_session_1_title", bodyKey: "tour_session_1_body", advanceOn: "click" },
      { target: "session-form-date", titleKey: "tour_session_2_title", bodyKey: "tour_session_2_body" },
      { target: "session-form-time", titleKey: "tour_session_3_title", bodyKey: "tour_session_3_body" },
      { target: "session-form-students", titleKey: "tour_session_4_title", bodyKey: "tour_session_4_body" },
      { target: "session-form-submit", titleKey: "tour_session_5_title", bodyKey: "tour_session_5_body" },
    ],
  },
  attendance: {
    id: "attendance",
    href: "/calendar",
    requires: "session",
    steps: [
      { target: "session-card", titleKey: "tour_attendance_1_title", bodyKey: "tour_attendance_1_body", advanceOn: "click" },
      { target: "session-nav", titleKey: "tour_attendance_2_title", bodyKey: "tour_attendance_2_body" },
      { target: "attendance-marks", titleKey: "tour_attendance_3_title", bodyKey: "tour_attendance_3_body" },
      { target: "attendance-all-present", titleKey: "tour_attendance_4_title", bodyKey: "tour_attendance_4_body" },
      { target: "attendance-save", titleKey: "tour_attendance_5_title", bodyKey: "tour_attendance_5_body" },
    ],
  },
  tuition: {
    id: "tuition",
    href: "/tuition",
    requires: "student",
    steps: [
      { target: "tuition-month", titleKey: "tour_tuition_1_title", bodyKey: "tour_tuition_1_body" },
      { target: "tuition-row", titleKey: "tour_tuition_2_title", bodyKey: "tour_tuition_2_body" },
      { target: "tuition-pay-full", titleKey: "tour_tuition_3_title", bodyKey: "tour_tuition_3_body" },
      { target: "tuition-notice", titleKey: "tour_tuition_4_title", bodyKey: "tour_tuition_4_body" },
      { target: "tuition-row", titleKey: "tour_tuition_5_title", bodyKey: "tour_tuition_5_body", advanceOn: "click" },
      { target: "tuition-pay-partial", titleKey: "tour_tuition_6_title", bodyKey: "tour_tuition_6_body" },
    ],
  },
  bank: {
    id: "bank",
    href: "/settings",
    steps: [
      { target: "bank-select", titleKey: "tour_bank_1_title", bodyKey: "tour_bank_1_body" },
      { target: "bank-number", titleKey: "tour_bank_2_title", bodyKey: "tour_bank_2_body" },
      { target: "bank-name", titleKey: "tour_bank_3_title", bodyKey: "tour_bank_3_body" },
      { target: "bank-submit", titleKey: "tour_bank_4_title", bodyKey: "tour_bank_4_body" },
    ],
  },
}

// Thiếu dữ liệu trước (spec AD §3.1): 1 bước giữa màn, nút Tiếp chuyển sang tour tạo dữ liệu đó.
export const MISSING_STEPS: Record<"student" | "session", TourStep> = {
  session: { target: null, titleKey: "tour_need_session_title", bodyKey: "tour_need_session_body", nextTour: "session", nextLabelKey: "tour_need_session_next" },
  student: { target: null, titleKey: "tour_need_student_title", bodyKey: "tour_need_student_body", nextTour: "student", nextLabelKey: "tour_need_student_next" },
}

export const GUIDE_TOURS: Partial<Record<string, TourId>> = {
  "hoc-sinh": "student",
  "nhap-excel": "import",
  "lich-day": "session",
  "diem-danh": "attendance",
  "hoc-phi": "tuition",
  "tai-khoan-ngan-hang": "bank",
}

export function tourHref(id: TourId): string {
  return `${TOURS[id].href}?${TOUR_PARAM}=${id}`
}

export function parseTourParam(v: string | null): TourId | null {
  return v !== null && Object.prototype.hasOwnProperty.call(TOURS, v) ? (v as TourId) : null
}
