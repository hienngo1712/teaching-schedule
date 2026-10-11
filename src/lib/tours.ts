import type vi from "@/language/vi.json"

export type TourId = "student" | "import" | "session" | "attendance" | "tuition" | "bank" | "place" | "income"
export type TourKey = keyof typeof vi
// target = giá trị data-tour; null = khung giữa màn. "click" = chờ người dùng bấm target (spec AD §3).
export type TourStep = {
  target: string | null
  titleKey: TourKey
  bodyKey: TourKey
  advanceOn?: "next" | "click"
  nextTour?: TourId
  nextLabelKey?: TourKey
  // Trang tự dùng ← → ở bước này (vd chuyển ca): tour không bắt phím mũi tên.
  pageArrows?: true
  // Phần tử chỉ có theo lựa chọn ở bước trước (vd Đơn giá khi chọn Theo ca/giờ): thiếu thì bỏ qua ngay, không chờ.
  optional?: true
}
export type TourRequire = "student" | "session" | "perSessionPlace"
export type Tour = { id: TourId; href: string; steps: TourStep[]; requires?: TourRequire }

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
      { target: "session-nav", titleKey: "tour_attendance_2_title", bodyKey: "tour_attendance_2_body", pageArrows: true },
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
  // Spec AP §6.
  place: {
    id: "place",
    href: "/places",
    steps: [
      { target: "place-add", titleKey: "tour_place_1_title", bodyKey: "tour_place_1_body", advanceOn: "click" },
      { target: "place-form-name", titleKey: "tour_place_2_title", bodyKey: "tour_place_2_body" },
      { target: "place-form-kind", titleKey: "tour_place_3_title", bodyKey: "tour_place_3_body" },
      { target: "place-form-billing", titleKey: "tour_place_4_title", bodyKey: "tour_place_4_body" },
      { target: "place-form-rate", titleKey: "tour_place_5_title", bodyKey: "tour_place_5_body", optional: true },
      { target: "place-form-submit", titleKey: "tour_place_6_title", bodyKey: "tour_place_6_body" },
    ],
  },
  income: {
    id: "income",
    href: "/timesheet?tab=income",
    requires: "perSessionPlace",
    steps: [
      { target: "income-month", titleKey: "tour_income_1_title", bodyKey: "tour_income_1_body" },
      { target: "income-row", titleKey: "tour_income_2_title", bodyKey: "tour_income_2_body" },
      { target: "income-notice", titleKey: "tour_income_3_title", bodyKey: "tour_income_3_body" },
      { target: "income-row", titleKey: "tour_income_4_title", bodyKey: "tour_income_4_body", advanceOn: "click" },
      { target: "income-record", titleKey: "tour_income_5_title", bodyKey: "tour_income_5_body" },
    ],
  },
}

// Thiếu dữ liệu trước (spec AD §3.1): 1 bước giữa màn, nút Tiếp chuyển sang tour tạo dữ liệu đó.
export const MISSING_STEPS: Record<TourRequire, TourStep> = {
  session: { target: null, titleKey: "tour_need_session_title", bodyKey: "tour_need_session_body", nextTour: "session", nextLabelKey: "tour_need_session_next" },
  student: { target: null, titleKey: "tour_need_student_title", bodyKey: "tour_need_student_body", nextTour: "student", nextLabelKey: "tour_need_student_next" },
  perSessionPlace: { target: null, titleKey: "tour_need_place_title", bodyKey: "tour_need_place_body", nextTour: "place", nextLabelKey: "tour_need_place_next" },
}

export const GUIDE_TOURS: Partial<Record<string, TourId>> = {
  "hoc-sinh": "student",
  "nhap-excel": "import",
  "lich-day": "session",
  "diem-danh": "attendance",
  "hoc-phi": "tuition",
  "tai-khoan-ngan-hang": "bank",
  "noi-day": "place",
  "bang-cong": "income",
  "phieu-noi-day": "income",
}

export function tourHref(id: TourId): string {
  const href = TOURS[id].href
  return `${href}${href.includes("?") ? "&" : "?"}${TOUR_PARAM}=${id}`
}

export function parseTourParam(v: string | null): TourId | null {
  return v !== null && Object.prototype.hasOwnProperty.call(TOURS, v) ? (v as TourId) : null
}
