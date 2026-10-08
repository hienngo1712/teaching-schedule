# AD — Tour hướng dẫn "Chỉ cho tôi" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nút "Chỉ cho tôi" ở thẻ Bắt đầu và `/guide` mở đúng trang rồi chạy tour driver.js tô sáng nút thật, dẫn qua 6 việc (Thêm học sinh, Nhập Excel, Tạo ca dạy, Điểm danh, Thu học phí, Tài khoản ngân hàng), kể cả bên trong hộp nhập.

**Architecture:**
- `src/lib/tours.ts`: dữ liệu 6 tour (thuần, không import driver.js).
- `src/lib/tour-controller.ts`: chạy từng bước, chờ phần tử xuất hiện, bước 👆 chờ người dùng bấm; nhận `Driver` từ ngoài nên test được bằng driver giả.
- `src/lib/tour-store.ts`: cờ "đang có tour" dùng chung (`useTourActive`), để `WhatsNew` không tự bật đè.
- `src/components/tour/TourRunner.tsx` (gắn trong `AppLayout`): đọc `?tour=`, xoá khỏi URL, tải động `driver.js`, gọi controller.
- `src/lib/tour-guard.ts` + 3 wrapper shadcn (`dialog`, `sheet`, `dropdown-menu`): bấm vào khung tour không bị Radix coi là "bấm ra ngoài".
- `data-tour="..."` gắn vào các nút thật; `TourButton` ở `StartCard` và `GuideContent`.

**Tech Stack:** Next.js 15 App Router, React 19, tRPC v11 + React Query v5, shadcn/Radix, `driver.js` (mới), Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-07-ad-tour-huong-dan-design.md`

## Global Constraints

**Nhánh, version**
- Nhánh `feat/ad-tour-huong-dan` tạo từ `main` (main đã có commit spec + plan). Version cuối `0.15.0`. **Không migration, không lệnh prisma nào.**

**Thư viện**
- Người dùng đã đồng ý: chỉ chạy đúng `pnpm add driver.js` (Task 3). Không cài / nâng gì khác.

**Chạy lệnh**
- Không `pnpm build` / `pnpm dev`. Test chỉ chạy với `.env.test` (localhost:5433). Đọc `docs/coding-rule.md` §6.1 trước lệnh DB đầu tiên (e2e có ghi DB test).
- Quy tắc test 3 tầng (`.superpowers/gehihi/LENH.md`): mỗi task chỉ test của task + `pnpm exec tsc --noEmit` + `pnpm lint`; full `pnpm test` và full e2e **chỉ 1 lần ở Task 6**.
- e2e: RAM ≥ 3000 MB, chạy foreground, seed trước bằng `pnpm test tests/integration/plan-launch-migration.test.ts`, chỉ dừng đúng PID mình tạo.

**Hành vi tour**
- Tour **không tự điền, không tự bấm Lưu/Thêm**. Không tạo dữ liệu thay người dùng.
- Không tìm thấy phần tử trong `TOUR_WAIT_MS = 3000` ms: bước thường → bỏ qua; bước 👆 (`advanceOn: "click"`) → tắt tour + toast `tour_target_missing`.
- Phần tử target = phần tử **đang hiển thị** đầu tiên khớp `[data-tour="<target>"]` (kích thước > 0).
- Tour đang chạy thì `WhatsNew` không tự mở; có `[role="dialog"][data-state="open"]` lúc bắt đầu thì không chạy, toast `tour_close_dialog_first`.

**Chữ và giao diện**
- Mọi chữ mới qua i18n `vi.json` + `en.json` cùng bộ key (Task 1 thêm toàn bộ). Không dùng gạch dài (—, –).
- Màu A3: `primary` (teal), slate, nền trắng. **Không indigo/violet/purple.** Vùng chạm ≥ 44px trên mobile (`h-11 md:h-9`).
- `page.tsx` / `layout.tsx` không có định danh `params` / `searchParams` (kể cả comment) — `tests/unit/next15-contract.test.ts` canh.

**Commit**
- Commit của Gehihi: 1 dòng, không body, không attribution. Ghi chú code tiếng Việt có dấu, 1–2 dòng.
- Mỗi task: test của task xanh + tsc + lint sạch → commit → ghi ledger `.superpowers/sdd/2026-10-07-ad-tour-huong-dan/progress.md`.

## Review Focus

1. **Bấm Tiếp trên khung tour làm đóng hộp Radix.** Test: Task 3 e2e "hộp vẫn mở sau mỗi lần bấm Tiếp" ở 390px và 1280px; unit `keepOpenOnTour`.
2. **Tour treo vĩnh viễn hoặc để lại lớp phủ** khi phần tử không có (gói Standard bấm Nhập Excel mở hộp nâng cấp; tháng chưa có ca). Test: Task 2 unit "bước 👆 thiếu phần tử → onMissingClickTarget + onEnd", "bước thường thiếu → bỏ qua"; Task 6 e2e Esc không còn `.driver-overlay`.
3. **Cờ `tourActive` kẹt `true`** (tour kết thúc trước khi driver kịp hiện) làm Có gì mới không bao giờ tự mở. Test: Task 2 unit "onEnd luôn được gọi kể cả khi chưa highlight bước nào".
4. **Tham số `?tour=` còn trên URL** → tải lại trang chạy lại tour. Test: Task 3 component `TourRunner` "router.replace bỏ tour, giữ tham số khác".
5. **Đổi giao diện làm mất `data-tour`** mà không ai biết. Test: Task 4 test canh mọi target trong `TOURS` có trong `src/**/*.tsx`.

## Chia việc song song (người dùng chốt 2026-10-08)

| Bên | Thư mục / nhánh | Task |
|---|---|---|
| **Gehihi** | `D:\APINODEJS\student-managerment`, nhánh `feat/ad-tour-huong-dan` | Task 1 → Task 2 → Task 3 → ghi `DONE AD-1` rồi **chờ**. Sau khi Claude gộp nhánh của Claude-OTD: Task 6 + Task 5 Step 7. |
| **Claude-OTD** | worktree `D:\APINODEJS\student-managerment-otd`, nhánh `feat/ad-tour-otd` tạo từ commit Task 1 | Task 4 + Task 5 (trừ Step 7) + bước "student" bên dưới. |

- **Claude-OTD chỉ bắt đầu khi ledger `progress.md` có dòng `Task 1: complete`** (cần `src/lib/tours.ts` + i18n). Tạo worktree từ đúng commit đó: `git -C D:\APINODEJS\student-managerment worktree add D:\APINODEJS\student-managerment-otd -b feat/ad-tour-otd <sha Task 1>`.
- **File của Claude-OTD** (Gehihi không sửa): mọi file trong bảng Task 4 Step 3, `src/components/common/ResponsiveList.tsx`, `tests/unit/lib/tour-targets.test.ts`, `tests/unit/components/ResponsiveList.test.tsx`, `src/components/tour/TourButton.tsx`, `src/components/dashboard/StartCard.tsx`, `src/components/guide/GuideContent.tsx`, `src/app/guide/page.tsx`, `tests/unit/components/TourButton.test.tsx`, `tests/unit/components/StartCard.test.tsx`, `tests/unit/components/GuideContent.test.tsx`.
- **Bước "student" của Claude-OTD:** để test canh Task 4 xanh trên nhánh riêng, Claude-OTD cũng gắn 6 `data-tour` của Task 3 Step 10 (`AddStudentSplitButton.tsx`, `StudentFormDialog.tsx`) **giống hệt từng ký tự** như Task 3 Step 10 mô tả: thêm thuộc tính `data-tour="..."` làm thuộc tính **cuối cùng** của thẻ mở, không đổi gì khác trên dòng. Gehihi làm y như vậy ở Task 3. Claude gộp nhánh và xử lý nếu lệch.
- **Không bên nào sửa** `tests/e2e/ad-tour.spec.ts` ngoài Gehihi.
- **Khoá test:** mọi lệnh `pnpm test …` / `pnpm exec playwright test …` của cả hai bên phải giữ khoá `D:\APINODEJS\student-managerment\.superpowers\test-lock.txt` (luật trong `.superpowers/gehihi/LENH.md` mục 2026-10-08 và `.superpowers/claude-otd/CLAUDE-OTD.md`).
- Ledger: Gehihi ghi `progress.md`, Claude-OTD ghi `progress-otd.md` (cùng thư mục `.superpowers/sdd/2026-10-07-ad-tour-huong-dan/`).

---

### Task 1: Dữ liệu tour + i18n

**Files:**
- Create: `src/lib/tours.ts`
- Modify: `src/language/vi.json`, `src/language/en.json`
- Test: `tests/unit/lib/tours.test.ts`

**Interfaces:**
- Produces:
  - `type TourId = "student" | "import" | "session" | "attendance" | "tuition" | "bank"`
  - `type TourKey = keyof typeof vi`
  - `type TourStep = { target: string | null; titleKey: TourKey; bodyKey: TourKey; advanceOn?: "next" | "click"; nextTour?: TourId; nextLabelKey?: TourKey }`
  - `type Tour = { id: TourId; href: string; steps: TourStep[]; requires?: "student" | "session" }`
  - `TOURS: Record<TourId, Tour>`, `MISSING_STEPS: Record<"student" | "session", TourStep>`, `GUIDE_TOURS: Partial<Record<string, TourId>>`
  - `TOUR_PARAM = "tour"`, `TOUR_WAIT_MS = 3000`, `TOUR_POLL_MS = 100`
  - `tourHref(id: TourId): string`, `parseTourParam(v: string | null): TourId | null`

- [ ] **Step 1: Viết test đỏ** `tests/unit/lib/tours.test.ts`

```ts
import { describe, it, expect } from "vitest"
import vi from "@/language/vi.json"
import en from "@/language/en.json"
import { GUIDE_TOURS, MISSING_STEPS, TOURS, parseTourParam, tourHref, type TourStep } from "@/lib/tours"

const ALL_STEPS: TourStep[] = [...Object.values(TOURS).flatMap((t) => t.steps), ...Object.values(MISSING_STEPS)]

describe("tours", () => {
  it("đủ 6 tour, id khớp khoá, href đúng trang", () => {
    expect(Object.keys(TOURS).sort()).toEqual(["attendance", "bank", "import", "session", "student", "tuition"])
    for (const [id, tour] of Object.entries(TOURS)) expect(tour.id).toBe(id)
    expect(TOURS.student.href).toBe("/students")
    expect(TOURS.import.href).toBe("/students")
    expect(TOURS.session.href).toBe("/calendar")
    expect(TOURS.attendance.href).toBe("/calendar")
    expect(TOURS.tuition.href).toBe("/tuition")
    expect(TOURS.bank.href).toBe("/settings")
  })

  it("Điểm danh cần ca, Thu học phí cần học sinh; bước báo thiếu chuyển sang đúng tour", () => {
    expect(TOURS.attendance.requires).toBe("session")
    expect(TOURS.tuition.requires).toBe("student")
    expect(MISSING_STEPS.session).toMatchObject({ target: null, nextTour: "session" })
    expect(MISSING_STEPS.student).toMatchObject({ target: null, nextTour: "student" })
  })

  it("mọi key chữ có ở cả vi và en, không có gạch dài", () => {
    const keys = new Set<string>(["tour_next", "tour_prev", "tour_done", "tour_click_hint", "tour_show_me", "tour_close_dialog_first", "tour_target_missing"])
    for (const s of ALL_STEPS) {
      keys.add(s.titleKey)
      keys.add(s.bodyKey)
      if (s.nextLabelKey) keys.add(s.nextLabelKey)
    }
    for (const k of keys) {
      expect(vi, k).toHaveProperty(k)
      expect(en, k).toHaveProperty(k)
      expect((vi as Record<string, string>)[k]).not.toMatch(/[—–]/)
      expect((en as Record<string, string>)[k]).not.toMatch(/[—–]/)
    }
  })

  it("bước 👆 luôn có target", () => {
    for (const s of ALL_STEPS) if (s.advanceOn === "click") expect(s.target).not.toBeNull()
  })

  it("tourHref và parseTourParam", () => {
    expect(tourHref("student")).toBe("/students?tour=student")
    expect(tourHref("bank")).toBe("/settings?tour=bank")
    expect(parseTourParam("tuition")).toBe("tuition")
    expect(parseTourParam("abc")).toBeNull()
    expect(parseTourParam("toString")).toBeNull()
    expect(parseTourParam(null)).toBeNull()
  })

  it("/guide: 6 mục gắn đúng tour", () => {
    expect(GUIDE_TOURS).toEqual({
      "hoc-sinh": "student",
      "nhap-excel": "import",
      "lich-day": "session",
      "diem-danh": "attendance",
      "hoc-phi": "tuition",
      "tai-khoan-ngan-hang": "bank",
    })
  })
})
```

- [ ] **Step 2: Chạy test, phải đỏ**

Run: `pnpm test tests/unit/lib/tours.test.ts`
Expected: FAIL, `Cannot find module '@/lib/tours'`.

- [ ] **Step 3: Viết `src/lib/tours.ts`**

```ts
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
```

- [ ] **Step 4: Thêm key i18n** vào cuối object của `src/language/vi.json` (giữ JSON hợp lệ, thêm dấu phẩy sau key cuối cũ):

```json
  "tour_show_me": "Chỉ cho tôi",
  "tour_next": "Tiếp",
  "tour_prev": "Quay lại",
  "tour_done": "Xong",
  "tour_click_hint": "Bấm vào phần được tô sáng.",
  "tour_close_dialog_first": "Đóng hộp đang mở rồi bấm Chỉ cho tôi lại nhé.",
  "tour_target_missing": "Không tìm thấy mục cần chỉ trên trang này.",
  "tour_need_session_title": "Chưa có ca dạy",
  "tour_need_session_body": "Tạo một ca dạy trước rồi quay lại điểm danh nhé.",
  "tour_need_session_next": "Chỉ cách tạo ca",
  "tour_need_student_title": "Chưa có học sinh",
  "tour_need_student_body": "Thêm học sinh trước rồi quay lại thu học phí nhé.",
  "tour_need_student_next": "Chỉ cách thêm học sinh",
  "tour_student_1_title": "Thêm học sinh",
  "tour_student_1_body": "Bấm nút này để mở hộp thêm học sinh.",
  "tour_student_2_title": "Họ tên và lớp",
  "tour_student_2_body": "Nhập họ tên học sinh và chọn lớp. Hai ô này bắt buộc.",
  "tour_student_3_title": "Cách thu học phí",
  "tour_student_3_body": "Theo buổi: tính theo số buổi có mặt. Trọn tháng: thu cố định mỗi tháng. Nhập mức học phí ở ô ngay dưới.",
  "tour_student_4_title": "Thông tin phụ huynh",
  "tour_student_4_body": "Số điện thoại và tên phụ huynh, không bắt buộc, bổ sung sau cũng được.",
  "tour_student_5_title": "Lưu học sinh",
  "tour_student_5_body": "Tick ô đồng ý lưu dữ liệu rồi bấm Thêm.",
  "tour_import_1_title": "Thêm nhiều học sinh",
  "tour_import_1_body": "Bấm mũi tên cạnh nút Thêm học sinh.",
  "tour_import_2_title": "Nhập Excel",
  "tour_import_2_body": "Chọn Nhập Excel để thêm cả danh sách một lần.",
  "tour_import_3_title": "Tải file mẫu",
  "tour_import_3_body": "Tải file mẫu, điền mỗi học sinh 1 dòng theo đúng cột.",
  "tour_import_4_title": "Chọn file",
  "tour_import_4_body": "Chọn file đã điền. App hiện bảng xem trước, dòng lỗi tô đỏ; tick đồng ý rồi bấm nhập.",
  "tour_import_5_title": "Nhờ phụ huynh điền",
  "tour_import_5_body": "Chưa có danh sách? Mở mục này để tạo Google Form gửi phụ huynh, rồi nhập file trả lời như file mẫu.",
  "tour_session_1_title": "Tạo ca dạy",
  "tour_session_1_body": "Bấm nút này để tạo một ca dạy mới.",
  "tour_session_2_title": "Ngày và môn",
  "tour_session_2_body": "Chọn ngày dạy và môn học của ca.",
  "tour_session_3_title": "Giờ dạy",
  "tour_session_3_body": "Chọn giờ bắt đầu và giờ kết thúc. App báo nếu trùng giờ với ca khác.",
  "tour_session_4_title": "Học sinh trong ca",
  "tour_session_4_body": "Chọn các học sinh học ca này.",
  "tour_session_5_title": "Lưu ca dạy",
  "tour_session_5_body": "Bấm Tạo ca dạy để lưu. Muốn ca lặp hằng tuần, dùng nút Lịch lặp ở trang Lịch dạy.",
  "tour_attendance_1_title": "Mở ca dạy",
  "tour_attendance_1_body": "Bấm vào một ca trên lịch để mở chi tiết và điểm danh.",
  "tour_attendance_2_title": "Sang ca khác",
  "tour_attendance_2_body": "Dùng mũi tên để sang ca trước hoặc ca sau trong tháng.",
  "tour_attendance_3_title": "Có mặt hay vắng",
  "tour_attendance_3_body": "Bấm dấu tích nếu học sinh có mặt, dấu X nếu vắng.",
  "tour_attendance_4_title": "Đánh dấu nhanh",
  "tour_attendance_4_body": "Cả ca đều đi học thì bấm Tất cả có mặt.",
  "tour_attendance_5_title": "Lưu điểm danh",
  "tour_attendance_5_body": "Bấm Lưu điểm danh. Học phí theo buổi được tính theo điểm danh này.",
  "tour_tuition_1_title": "Chọn tháng",
  "tour_tuition_1_body": "App mở sẵn tháng vừa học xong. Dùng mũi tên để đổi tháng.",
  "tour_tuition_2_title": "Số cần đóng",
  "tour_tuition_2_body": "Mỗi dòng là 1 học sinh, ghi số cần đóng gồm nợ tháng cũ và tiền tháng này.",
  "tour_tuition_3_title": "Đã đóng đủ",
  "tour_tuition_3_body": "Phụ huynh đóng đủ thì bấm nút này. Lỡ tay thì bấm Hoàn tác trên thông báo.",
  "tour_tuition_4_title": "Phiếu báo",
  "tour_tuition_4_body": "Tạo phiếu học phí có mã QR để gửi phụ huynh.",
  "tour_tuition_5_title": "Xem chi tiết",
  "tour_tuition_5_body": "Bấm vào học sinh để mở chi tiết học phí.",
  "tour_tuition_6_title": "Đóng một phần",
  "tour_tuition_6_body": "Đóng thiếu hoặc đóng nhiều tháng: bấm Đóng một phần rồi nhập số tiền.",
  "tour_bank_1_title": "Ngân hàng",
  "tour_bank_1_body": "Gõ tên để tìm ngân hàng nhận học phí.",
  "tour_bank_2_title": "Số tài khoản",
  "tour_bank_2_body": "Nhập số tài khoản nhận tiền.",
  "tour_bank_3_title": "Tên chủ tài khoản",
  "tour_bank_3_body": "Nhập đúng tên chủ tài khoản như trên ứng dụng ngân hàng.",
  "tour_bank_4_title": "Lưu tài khoản",
  "tour_bank_4_body": "Tick ô đồng ý rồi bấm Lưu. Phiếu báo học phí sẽ có mã QR chuyển khoản."
```

và `src/language/en.json` cùng bộ key:

```json
  "tour_show_me": "Show me",
  "tour_next": "Next",
  "tour_prev": "Back",
  "tour_done": "Done",
  "tour_click_hint": "Tap the highlighted item.",
  "tour_close_dialog_first": "Close the open window, then tap Show me again.",
  "tour_target_missing": "The item to show is not on this page.",
  "tour_need_session_title": "No sessions yet",
  "tour_need_session_body": "Create a session first, then come back to take attendance.",
  "tour_need_session_next": "Show how to create one",
  "tour_need_student_title": "No students yet",
  "tour_need_student_body": "Add a student first, then come back to collect fees.",
  "tour_need_student_next": "Show how to add one",
  "tour_student_1_title": "Add student",
  "tour_student_1_body": "Tap this button to open the add student form.",
  "tour_student_2_title": "Name and grade",
  "tour_student_2_body": "Enter the student's name and pick a grade. Both are required.",
  "tour_student_3_title": "Billing method",
  "tour_student_3_body": "Per session: based on attended sessions. Monthly: a fixed fee each month. Enter the fee just below.",
  "tour_student_4_title": "Parent info",
  "tour_student_4_body": "Parent phone and name are optional, you can add them later.",
  "tour_student_5_title": "Save student",
  "tour_student_5_body": "Tick the data consent box, then tap Add.",
  "tour_import_1_title": "Add many students",
  "tour_import_1_body": "Tap the arrow next to Add student.",
  "tour_import_2_title": "Import Excel",
  "tour_import_2_body": "Choose Import Excel to add a whole list at once.",
  "tour_import_3_title": "Download template",
  "tour_import_3_body": "Download the template and fill one student per row.",
  "tour_import_4_title": "Choose file",
  "tour_import_4_body": "Pick the filled file. A preview appears with error rows in red; tick consent, then import.",
  "tour_import_5_title": "Ask parents",
  "tour_import_5_body": "No list yet? Open this to create a Google Form for parents, then import the responses file.",
  "tour_session_1_title": "Create session",
  "tour_session_1_body": "Tap this button to create a new session.",
  "tour_session_2_title": "Date and subject",
  "tour_session_2_body": "Pick the session date and subject.",
  "tour_session_3_title": "Time",
  "tour_session_3_body": "Pick start and end time. The app warns about overlapping sessions.",
  "tour_session_4_title": "Students",
  "tour_session_4_body": "Pick the students in this session.",
  "tour_session_5_title": "Save session",
  "tour_session_5_body": "Tap Create session to save. For weekly sessions, use the Repeat button on the Calendar page.",
  "tour_attendance_1_title": "Open a session",
  "tour_attendance_1_body": "Tap a session on the calendar to open it and take attendance.",
  "tour_attendance_2_title": "Other sessions",
  "tour_attendance_2_body": "Use the arrows to move to the previous or next session this month.",
  "tour_attendance_3_title": "Present or absent",
  "tour_attendance_3_body": "Tap the check if the student attended, the X if absent.",
  "tour_attendance_4_title": "Quick mark",
  "tour_attendance_4_body": "Everyone came? Tap All present.",
  "tour_attendance_5_title": "Save attendance",
  "tour_attendance_5_body": "Tap Save attendance. Per session fees follow this attendance.",
  "tour_tuition_1_title": "Pick month",
  "tour_tuition_1_body": "The month you just finished is open. Use the arrows to change month.",
  "tour_tuition_2_title": "Amount due",
  "tour_tuition_2_body": "Each row is a student, showing the amount due including earlier debt.",
  "tour_tuition_3_title": "Paid in full",
  "tour_tuition_3_body": "Parent paid everything? Tap this. Tapped by mistake? Use Undo on the notice.",
  "tour_tuition_4_title": "Fee notice",
  "tour_tuition_4_body": "Create a fee notice with a QR code to send to parents.",
  "tour_tuition_5_title": "Details",
  "tour_tuition_5_body": "Tap a student to open fee details.",
  "tour_tuition_6_title": "Partial payment",
  "tour_tuition_6_body": "Paid less or for several months: tap Partial payment and enter the amount.",
  "tour_bank_1_title": "Bank",
  "tour_bank_1_body": "Type to search for the bank that receives fees.",
  "tour_bank_2_title": "Account number",
  "tour_bank_2_body": "Enter the receiving account number.",
  "tour_bank_3_title": "Account name",
  "tour_bank_3_body": "Enter the account holder name exactly as in your banking app.",
  "tour_bank_4_title": "Save account",
  "tour_bank_4_body": "Tick consent and tap Save. Fee notices will show a transfer QR code."
```

- [ ] **Step 5: Chạy test, phải xanh**

Run: `pnpm test tests/unit/lib/tours.test.ts tests/unit/language` (nếu không có thư mục `tests/unit/language` thì chỉ file đầu; test so khoá vi/en sẵn có — tìm bằng `grep -rln "en.json" tests/unit` và chạy kèm)
Expected: PASS.

- [ ] **Step 6: tsc + lint + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/lib/tours.ts src/language/vi.json src/language/en.json tests/unit/lib/tours.test.ts
git commit -m "feat: du lieu 6 tour huong dan va chu i18n"
```

---

### Task 2: Cờ dùng chung + bộ chạy bước (controller)

**Files:**
- Create: `src/lib/tour-store.ts`, `src/lib/tour-controller.ts`
- Test: `tests/unit/lib/tour-store.test.ts`, `tests/unit/lib/tour-controller.test.ts`

**Interfaces:**
- Consumes: `TourStep`, `TourId`, `TourKey`, `TOUR_WAIT_MS`, `TOUR_POLL_MS` (Task 1).
- Produces:
  - `setTourActive(v: boolean): void`, `isTourActive(): boolean`, `useTourActive(): boolean`
  - `findVisibleTarget(target: string): HTMLElement | null`
  - `type TourDriver = Pick<Driver, "highlight" | "destroy" | "isActive">` (Driver từ `driver.js`; Task 2 chỉ dùng kiểu, chưa cài gói nên khai báo kiểu tối thiểu tại chỗ — xem Step 3)
  - `runTour(opts: RunTourOptions): TourHandle` với `RunTourOptions = { driver: TourDriver; steps: TourStep[]; t: (k: TourKey) => string; waitMs?: number; onMissingClickTarget: () => void; onStartTour: (id: TourId) => void; onEnd: () => void }`, `TourHandle = { stop: () => void }`

- [ ] **Step 1: Viết test đỏ** `tests/unit/lib/tour-store.test.ts`

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { isTourActive, setTourActive, useTourActive } from "@/lib/tour-store"

afterEach(() => setTourActive(false))

describe("tour-store", () => {
  it("hook đổi theo setTourActive", () => {
    const { result } = renderHook(() => useTourActive())
    expect(result.current).toBe(false)
    act(() => setTourActive(true))
    expect(result.current).toBe(true)
    expect(isTourActive()).toBe(true)
    act(() => setTourActive(false))
    expect(result.current).toBe(false)
  })
})
```

và `tests/unit/lib/tour-controller.test.ts`

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { findVisibleTarget, runTour, type TourDriver } from "@/lib/tour-controller"
import type { TourStep } from "@/lib/tours"

type HighlightArg = { element?: Element; popover: { title: string; description: string; showButtons: string[]; nextBtnText: string; onNextClick: () => void; onPrevClick: () => void; onCloseClick: () => void } }

function fakeDriver() {
  let active = false
  const calls: HighlightArg[] = []
  const driver = {
    highlight: vi.fn((arg: HighlightArg) => { active = true; calls.push(arg) }),
    destroy: vi.fn(() => { active = false }),
    isActive: vi.fn(() => active),
  }
  return { driver: driver as unknown as TourDriver & typeof driver, calls }
}

// jsdom không tính layout: giả kích thước để "đang hiển thị".
function addTarget(name: string, visible = true) {
  const el = document.createElement("button")
  el.setAttribute("data-tour", name)
  el.getBoundingClientRect = () => ({ width: visible ? 10 : 0, height: visible ? 10 : 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) })
  document.body.appendChild(el)
  return el
}

const t = (k: string) => k
const flush = () => vi.advanceTimersByTimeAsync(0)

function setup(steps: TourStep[]) {
  const { driver, calls } = fakeDriver()
  const onMissingClickTarget = vi.fn()
  const onStartTour = vi.fn()
  const onEnd = vi.fn()
  const handle = runTour({ driver, steps, t: t as never, onMissingClickTarget, onStartTour, onEnd })
  return { driver, calls, onMissingClickTarget, onStartTour, onEnd, handle }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ""
})

describe("findVisibleTarget", () => {
  it("bỏ phần tử ẩn, lấy phần tử đang hiện", () => {
    addTarget("x", false)
    const shown = addTarget("x", true)
    expect(findVisibleTarget("x")).toBe(shown)
    expect(findVisibleTarget("y")).toBeNull()
  })
})

describe("runTour", () => {
  it("bước thường: Tiếp sang bước sau; bước cuối nút Xong rồi tắt + onEnd", async () => {
    const a = addTarget("a")
    const b = addTarget("b")
    const { calls, driver, onEnd } = setup([
      { target: "a", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body" },
      { target: "b", titleKey: "tour_student_3_title", bodyKey: "tour_student_3_body" },
    ])
    await flush()
    expect(calls[0].element).toBe(a)
    expect(calls[0].popover.title).toBe("1/2 · tour_student_2_title")
    expect(calls[0].popover.showButtons).toEqual(["next", "close"])
    expect(calls[0].popover.nextBtnText).toBe("tour_next")
    calls[0].popover.onNextClick()
    await flush()
    expect(calls[1].element).toBe(b)
    expect(calls[1].popover.showButtons).toEqual(["previous", "next", "close"])
    expect(calls[1].popover.nextBtnText).toBe("tour_done")
    calls[1].popover.onNextClick()
    await flush()
    expect(driver.destroy).toHaveBeenCalled()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it("Quay lại về bước đã hiện trước đó", async () => {
    const a = addTarget("a")
    addTarget("b")
    const { calls } = setup([
      { target: "a", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body" },
      { target: "b", titleKey: "tour_student_3_title", bodyKey: "tour_student_3_body" },
    ])
    await flush()
    calls[0].popover.onNextClick()
    await flush()
    calls[1].popover.onPrevClick()
    await flush()
    expect(calls[2].element).toBe(a)
  })

  it("bước 👆: không có nút Tiếp, chờ người dùng bấm phần tử rồi đi tiếp", async () => {
    const a = addTarget("a")
    const { calls } = setup([
      { target: "a", titleKey: "tour_student_1_title", bodyKey: "tour_student_1_body", advanceOn: "click" },
      { target: "b", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body" },
    ])
    await flush()
    expect(calls[0].popover.showButtons).toEqual(["close"])
    expect(calls[0].popover.description).toBe("tour_student_1_body tour_click_hint")
    a.click()
    const b = addTarget("b") // hộp mở sau khi bấm
    await vi.advanceTimersByTimeAsync(200)
    expect(calls[1].element).toBe(b)
  })

  it("bước thường thiếu phần tử quá 3 giây thì bỏ qua", async () => {
    const c = addTarget("c")
    const { calls } = setup([
      { target: "missing", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body" },
      { target: "c", titleKey: "tour_student_3_title", bodyKey: "tour_student_3_body" },
    ])
    await vi.advanceTimersByTimeAsync(2900)
    expect(calls).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(300)
    expect(calls[0].element).toBe(c)
  })

  it("bước 👆 thiếu phần tử: báo + tắt, onEnd được gọi dù chưa hiện bước nào", async () => {
    const { calls, onMissingClickTarget, onEnd } = setup([
      { target: "missing", titleKey: "tour_student_1_title", bodyKey: "tour_student_1_body", advanceOn: "click" },
    ])
    await vi.advanceTimersByTimeAsync(3200)
    expect(calls).toHaveLength(0)
    expect(onMissingClickTarget).toHaveBeenCalled()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it("bước báo thiếu dữ liệu: khung giữa màn, nút Tiếp mang nhãn riêng và chuyển tour", async () => {
    const { calls, onStartTour, onEnd } = setup([
      { target: null, titleKey: "tour_need_session_title", bodyKey: "tour_need_session_body", nextTour: "session", nextLabelKey: "tour_need_session_next" },
    ])
    await flush()
    expect(calls[0].element).toBeUndefined()
    expect(calls[0].popover.nextBtnText).toBe("tour_need_session_next")
    calls[0].popover.onNextClick()
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onStartTour).toHaveBeenCalledWith("session")
  })

  it("phần tử đang tô sáng bị gỡ khỏi trang (đóng hộp) thì tắt tour", async () => {
    const a = addTarget("a")
    addTarget("b")
    const { onEnd } = setup([
      { target: "a", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body" },
      { target: "b", titleKey: "tour_student_3_title", bodyKey: "tour_student_3_body" },
    ])
    await flush()
    a.remove()
    await vi.advanceTimersByTimeAsync(600)
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it("stop gọi nhiều lần chỉ kết thúc 1 lần; nút X tắt tour", async () => {
    addTarget("a")
    const { calls, handle, onEnd } = setup([{ target: "a", titleKey: "tour_student_2_title", bodyKey: "tour_student_2_body" }])
    await flush()
    calls[0].popover.onCloseClick()
    handle.stop()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Chạy test, phải đỏ**

Run: `pnpm test tests/unit/lib/tour-store.test.ts tests/unit/lib/tour-controller.test.ts`
Expected: FAIL, không tìm thấy module.

- [ ] **Step 3: Viết `src/lib/tour-store.ts`**

```ts
import { useSyncExternalStore } from "react"

// Cờ "đang có tour" để WhatsNew không tự mở đè lên tour (spec AD §4.2).
let active = false
const listeners = new Set<() => void>()

export function setTourActive(v: boolean): void {
  if (active === v) return
  active = v
  listeners.forEach((l) => l())
}

export function isTourActive(): boolean {
  return active
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function useTourActive(): boolean {
  return useSyncExternalStore(subscribe, isTourActive, () => false)
}
```

- [ ] **Step 4: Viết `src/lib/tour-controller.ts`** (chưa cài `driver.js` ở task này nên khai báo kiểu tối thiểu; Task 3 vẫn truyền `Driver` thật vào vì khớp cấu trúc)

```ts
import { TOUR_POLL_MS, TOUR_WAIT_MS, type TourId, type TourKey, type TourStep } from "./tours"

type PopoverButton = "next" | "previous" | "close"
type HighlightStep = {
  element?: Element
  popover: {
    title: string
    description: string
    showButtons: PopoverButton[]
    nextBtnText: string
    prevBtnText: string
    onNextClick: () => void
    onPrevClick: () => void
    onCloseClick: () => void
  }
}
// Phần dùng tới của Driver (driver.js); khai báo tại chỗ để test dùng driver giả.
export type TourDriver = { highlight: (step: HighlightStep) => void; destroy: () => void; isActive: () => boolean }

export type RunTourOptions = {
  driver: TourDriver
  steps: TourStep[]
  t: (key: TourKey) => string
  waitMs?: number
  onMissingClickTarget: () => void
  onStartTour: (id: TourId) => void
  onEnd: () => void
}
export type TourHandle = { stop: () => void }

// Mobile và desktop có thể cùng gắn 1 data-tour cho 2 nút; lấy nút đang hiện.
export function findVisibleTarget(target: string): HTMLElement | null {
  const els = document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)
  for (const el of Array.from(els)) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

function waitForTarget(target: string, timeoutMs: number, isStopped: () => boolean): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const started = Date.now()
    const tick = () => {
      if (isStopped()) return resolve(null)
      const el = findVisibleTarget(target)
      if (el) return resolve(el)
      if (Date.now() - started >= timeoutMs) return resolve(null)
      setTimeout(tick, TOUR_POLL_MS)
    }
    tick()
  })
}

export function runTour(opts: RunTourOptions): TourHandle {
  const { driver, steps, t, waitMs = TOUR_WAIT_MS } = opts
  let stopped = false
  let current: HTMLElement | null = null
  let removeClick: (() => void) | null = null
  const shown: number[] = []
  // Hộp chứa bước hiện tại bị đóng thì phần tử rời khỏi DOM → tắt tour.
  const watch = setInterval(() => {
    if (current && !current.isConnected) stop()
  }, 500)

  function clearStep() {
    removeClick?.()
    removeClick = null
    current = null
  }

  function stop() {
    if (stopped) return
    stopped = true
    clearInterval(watch)
    clearStep()
    if (driver.isActive()) driver.destroy()
    opts.onEnd()
  }

  async function show(i: number): Promise<void> {
    clearStep()
    if (stopped) return
    if (i >= steps.length) return stop()
    const step = steps[i]
    let el: HTMLElement | undefined
    if (step.target) {
      const found = await waitForTarget(step.target, waitMs, () => stopped)
      if (stopped) return
      if (!found) {
        if (step.advanceOn === "click") {
          opts.onMissingClickTarget()
          return stop()
        }
        return show(i + 1)
      }
      el = found
    }
    shown.push(i)
    const isClick = step.advanceOn === "click"
    const isLast = i === steps.length - 1
    const buttons: PopoverButton[] = isClick ? ["close"] : shown.length > 1 ? ["previous", "next", "close"] : ["next", "close"]
    driver.highlight({
      element: el,
      popover: {
        title: `${i + 1}/${steps.length} · ${t(step.titleKey)}`,
        description: isClick ? `${t(step.bodyKey)} ${t("tour_click_hint")}` : t(step.bodyKey),
        showButtons: buttons,
        nextBtnText: step.nextLabelKey ? t(step.nextLabelKey) : isLast ? t("tour_done") : t("tour_next"),
        prevBtnText: t("tour_prev"),
        onNextClick: () => {
          if (step.nextTour) {
            const next = step.nextTour
            stop()
            opts.onStartTour(next)
            return
          }
          void show(i + 1)
        },
        onPrevClick: () => {
          shown.pop()
          const prev = shown.pop()
          if (prev !== undefined) void show(prev)
        },
        onCloseClick: () => stop(),
      },
    })
    current = el ?? null
    if (isClick && el) {
      const target = el
      const onClick = () => void show(i + 1)
      target.addEventListener("click", onClick, { once: true })
      removeClick = () => target.removeEventListener("click", onClick)
    }
  }

  void show(0)
  return { stop }
}
```

- [ ] **Step 5: Chạy test, phải xanh**

Run: `pnpm test tests/unit/lib/tour-store.test.ts tests/unit/lib/tour-controller.test.ts`
Expected: PASS (10 test).

- [ ] **Step 6: tsc + lint + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/lib/tour-store.ts src/lib/tour-controller.ts tests/unit/lib/tour-store.test.ts tests/unit/lib/tour-controller.test.ts
git commit -m "feat: bo chay buoc tour va co dang co tour"
```

---

### Task 3: Cài driver.js, TourRunner, chặn Radix đóng hộp, tour Thêm học sinh chạy thật (SPIKE)

Task này là **thử nghiệm rủi ro chính** (spec §4.3). Kết quả quyết định các bước trong hộp có giữ hay không.

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (qua `pnpm add driver.js`)
- Create: `src/lib/tour-guard.ts`, `src/components/tour/TourRunner.tsx`
- Modify: `src/components/ui/dialog.tsx`, `src/components/ui/sheet.tsx`, `src/components/ui/dropdown-menu.tsx`, `src/app/globals.css`, `src/components/layout/AppLayout.tsx`, `src/components/whats-new/WhatsNew.tsx`, `src/components/students/AddStudentSplitButton.tsx`, `src/components/students/StudentFormDialog.tsx`
- Test: `tests/unit/lib/tour-guard.test.ts`, `tests/unit/components/TourRunner.test.tsx`, `tests/unit/components/WhatsNew.test.tsx` (thêm 1 test), `tests/e2e/ad-tour.spec.ts` (tạo, phần tour Thêm học sinh)

**Interfaces:**
- Consumes: `runTour`, `TourHandle` (Task 2); `TOURS`, `MISSING_STEPS`, `TOUR_PARAM`, `parseTourParam`, `tourHref`, `TourStep` (Task 1); `setTourActive`, `useTourActive` (Task 2).
- Produces: `isTourEvent(e: { target: EventTarget | null }): boolean`, `keepOpenOnTour<E extends { target: EventTarget | null; preventDefault(): void }>(handler?: (e: E) => void): (e: E) => void`; component `TourRunner` (không props).

- [ ] **Step 1: Cài thư viện** (người dùng đã đồng ý, chỉ lệnh này)

Run: `pnpm add driver.js`
Expected: `package.json` có `"driver.js"` trong `dependencies`.

- [ ] **Step 2: Test đỏ cho guard** `tests/unit/lib/tour-guard.test.ts`

```ts
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { isTourEvent, keepOpenOnTour } from "@/lib/tour-guard"

function eventOn(el: Element) {
  return { target: el, preventDefault: vi.fn() }
}

describe("tour-guard", () => {
  it("bấm trong khung tour hoặc lớp phủ tour: chặn Radix đóng hộp, không gọi handler gốc", () => {
    const pop = document.createElement("div")
    pop.className = "driver-popover"
    const btn = document.createElement("button")
    pop.appendChild(btn)
    const overlay = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    overlay.setAttribute("class", "driver-overlay")
    const original = vi.fn()
    const e1 = eventOn(btn)
    keepOpenOnTour(original)(e1)
    expect(isTourEvent(e1)).toBe(true)
    expect(e1.preventDefault).toHaveBeenCalled()
    const e2 = eventOn(overlay)
    keepOpenOnTour(original)(e2)
    expect(e2.preventDefault).toHaveBeenCalled()
    expect(original).not.toHaveBeenCalled()
  })

  it("bấm chỗ khác: để Radix xử lý như cũ, gọi handler gốc", () => {
    const other = document.createElement("div")
    const original = vi.fn()
    const e = eventOn(other)
    keepOpenOnTour(original)(e)
    expect(e.preventDefault).not.toHaveBeenCalled()
    expect(original).toHaveBeenCalledWith(e)
  })
})
```

Run: `pnpm test tests/unit/lib/tour-guard.test.ts` → FAIL (chưa có module).

- [ ] **Step 3: Viết `src/lib/tour-guard.ts`**

```ts
// Khung tour driver.js gắn ngoài hộp Radix; bấm vào nó không được tính là "bấm ra ngoài" làm đóng hộp.
export function isTourEvent(e: { target: EventTarget | null }): boolean {
  return e.target instanceof Element && e.target.closest(".driver-popover, .driver-overlay") !== null
}

export function keepOpenOnTour<E extends { target: EventTarget | null; preventDefault(): void }>(handler?: (e: E) => void) {
  return (e: E) => {
    if (isTourEvent(e)) e.preventDefault()
    else handler?.(e)
  }
}
```

Run lại → PASS.

- [ ] **Step 4: Gắn guard vào 3 wrapper shadcn**

`src/components/ui/dialog.tsx` — `DialogContent`:

```tsx
>(({ className, children, onInteractOutside, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(/* giữ nguyên chuỗi class cũ */)}
      onInteractOutside={keepOpenOnTour(onInteractOutside)}
      {...props}
    >
```

`src/components/ui/sheet.tsx` — `SheetContent`: thêm `onInteractOutside` vào destructuring `({ side = "right", className, children, hideClose = false, onInteractOutside, ...props }, ref)` và prop `onInteractOutside={keepOpenOnTour(onInteractOutside)}` trên `SheetPrimitive.Content`.

`src/components/ui/dropdown-menu.tsx` — `DropdownMenuContent`: `({ className, sideOffset = 4, onInteractOutside, ...props }, ref)` và `onInteractOutside={keepOpenOnTour(onInteractOutside)}` trên `DropdownMenuPrimitive.Content` (đặt **trước** `{...props}` không được, vì props đã bỏ `onInteractOutside`; đặt ở đâu cũng được).

Mỗi file thêm `import { keepOpenOnTour } from "@/lib/tour-guard"`.

- [ ] **Step 5: CSS khung tour** — thêm cuối `src/app/globals.css`:

```css
/* === TOUR (driver.js) === */
/* Radix đặt pointer-events:none lên body khi mở hộp; khung tour nằm ngoài hộp nên phải mở lại. */
.driver-popover.app-tour {
  pointer-events: auto;
  border-radius: 10px;
  max-width: min(320px, calc(100vw - 32px));
  color: theme("colors.slate.600");
  font-family: inherit;
}
.driver-popover.app-tour .driver-popover-title {
  color: theme("colors.slate.900");
  font-size: 15px;
  font-weight: 600;
}
.driver-popover.app-tour .driver-popover-footer button {
  min-height: 44px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 14px;
  text-shadow: none;
}
.driver-popover.app-tour .driver-popover-next-btn {
  background: hsl(var(--primary));
  border-color: transparent;
  color: hsl(var(--primary-foreground));
}
@media (min-width: 768px) {
  .driver-popover.app-tour .driver-popover-footer button {
    min-height: 36px;
  }
}
```

- [ ] **Step 6: Test đỏ cho TourRunner** `tests/unit/components/TourRunner.test.tsx`

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, cleanup, waitFor } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"

const nav = vi.hoisted(() => ({ search: "tour=student&month=3", pathname: "/students", replace: vi.fn(), push: vi.fn() }))
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  usePathname: () => nav.pathname,
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
}))
const status = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock("@/lib/trpc", () => ({ trpc: { useUtils: () => ({ onboarding: { status: { fetch: status.fetch } } }) } }))
const toast = vi.hoisted(() => vi.fn())
vi.mock("sonner", () => ({ toast }))
const run = vi.hoisted(() => ({ runTour: vi.fn(() => ({ stop: vi.fn() })) }))
vi.mock("@/lib/tour-controller", () => run)
vi.mock("driver.js", () => ({ driver: vi.fn(() => ({ highlight: vi.fn(), destroy: vi.fn(), isActive: () => false })) }))
vi.mock("driver.js/dist/driver.css", () => ({}))

import { TourRunner } from "@/components/tour/TourRunner"
import { isTourActive, setTourActive } from "@/lib/tour-store"

const renderVi = () => render(<LanguageProvider forcedLanguage="vi"><TourRunner /></LanguageProvider>)

beforeEach(() => {
  nav.search = "tour=student&month=3"
  nav.pathname = "/students"
  status.fetch.mockResolvedValue({ steps: { student: true, session: true } })
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  setTourActive(false)
  document.body.innerHTML = ""
})

describe("TourRunner", () => {
  it("xoá ?tour= khỏi URL, giữ tham số khác, rồi chạy tour đúng bước", async () => {
    renderVi()
    expect(nav.replace).toHaveBeenCalledWith("/students?month=3", { scroll: false })
    await waitFor(() => expect(run.runTour).toHaveBeenCalled())
    const opts = (run.runTour.mock.calls[0] as unknown as [{ steps: { target: string | null }[] }])[0]
    expect(opts.steps[0].target).toBe("student-add")
    expect(isTourActive()).toBe(true)
  })

  it("giá trị lạ: chỉ xoá tham số, không chạy", async () => {
    nav.search = "tour=hack"
    renderVi()
    expect(nav.replace).toHaveBeenCalledWith("/students", { scroll: false })
    await new Promise((r) => setTimeout(r, 0))
    expect(run.runTour).not.toHaveBeenCalled()
  })

  it("đang có hộp mở: báo và không chạy", async () => {
    const d = document.createElement("div")
    d.setAttribute("role", "dialog")
    d.setAttribute("data-state", "open")
    document.body.appendChild(d)
    renderVi()
    expect(toast).toHaveBeenCalledWith("Đóng hộp đang mở rồi bấm Chỉ cho tôi lại nhé.")
    await new Promise((r) => setTimeout(r, 0))
    expect(run.runTour).not.toHaveBeenCalled()
  })

  it("Điểm danh khi chưa có ca: chạy bước báo thiếu", async () => {
    nav.search = "tour=attendance"
    nav.pathname = "/calendar"
    status.fetch.mockResolvedValue({ steps: { student: true, session: false } })
    renderVi()
    await waitFor(() => expect(run.runTour).toHaveBeenCalled())
    const opts = (run.runTour.mock.calls[0] as unknown as [{ steps: { nextTour?: string }[] }])[0]
    expect(opts.steps).toHaveLength(1)
    expect(opts.steps[0].nextTour).toBe("session")
  })

  it("không có ?tour=: không làm gì", () => {
    nav.search = ""
    renderVi()
    expect(nav.replace).not.toHaveBeenCalled()
  })
})
```

Run: `pnpm test tests/unit/components/TourRunner.test.tsx` → FAIL (chưa có component).

- [ ] **Step 7: Viết `src/components/tour/TourRunner.tsx`**

```tsx
"use client"

import "driver.js/dist/driver.css"
import { useEffect, useRef } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { trpc } from "@/lib/trpc"
import { MISSING_STEPS, TOURS, TOUR_PARAM, parseTourParam, tourHref, type TourStep } from "@/lib/tours"
import { runTour, type TourHandle } from "@/lib/tour-controller"
import { setTourActive } from "@/lib/tour-store"

// Chạy tour khi URL có ?tour=<id> (nút "Chỉ cho tôi"), spec AD §4.2.
export function TourRunner() {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useTranslation()
  const utils = trpc.useUtils()
  const handle = useRef<TourHandle | null>(null)
  const alive = useRef(true)
  const raw = params.get(TOUR_PARAM)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // Chuyển trang thì tắt tour đang chạy.
  useEffect(
    () => () => {
      handle.current?.stop()
    },
    [pathname]
  )

  useEffect(() => {
    if (raw === null) return
    const rest = new URLSearchParams(params.toString())
    rest.delete(TOUR_PARAM)
    const qs = rest.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })

    const id = parseTourParam(raw)
    if (!id) return
    if (document.querySelector('[role="dialog"][data-state="open"]')) {
      toast(t("tour_close_dialog_first"))
      return
    }
    handle.current?.stop()
    setTourActive(true)
    const end = () => {
      handle.current = null
      setTourActive(false)
    }

    void (async () => {
      try {
        const tour = TOURS[id]
        let steps: TourStep[] = tour.steps
        if (tour.requires) {
          const status = await utils.onboarding.status.fetch()
          if (!status.steps[tour.requires]) steps = [MISSING_STEPS[tour.requires]]
        }
        const { driver } = await import("driver.js")
        if (!alive.current) return end()
        const drv = driver({
          overlayOpacity: 0.5,
          stagePadding: 4,
          stageRadius: 10,
          popoverClass: "app-tour",
          allowClose: true,
          disableActiveInteraction: false,
          // Esc hoặc bấm ra lớp phủ: driver tự huỷ → dọn controller.
          onDestroyed: () => handle.current?.stop(),
        })
        handle.current = runTour({
          driver: drv,
          steps,
          t,
          onMissingClickTarget: () => toast(t("tour_target_missing")),
          onStartTour: (next) => router.push(tourHref(next)),
          onEnd: end,
        })
      } catch {
        end()
      }
    })()
    // Chỉ phản ứng khi giá trị ?tour= đổi; router.replace làm raw về null nhưng không được huỷ tour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw])

  return null
}
```

Lưu ý kiểu: `runTour` nhận `TourDriver` (Task 2); `Driver` của driver.js có `highlight(step: DriveStep)` rộng hơn nên gán được. Nếu tsc báo lệch kiểu ở `driver: drv`, ghi Ruling và ép `drv as unknown as TourDriver` (import kiểu `TourDriver` từ controller), không sửa controller.

Run: `pnpm test tests/unit/components/TourRunner.test.tsx` → PASS.

- [ ] **Step 8: Gắn vào `AppLayout`** (`src/components/layout/AppLayout.tsx`)

```tsx
import { Suspense } from "react"
import { TourRunner } from "@/components/tour/TourRunner"
// ...
      <BottomTabBar />
      <UpgradeDialog />
      {/* useSearchParams cần Suspense khi trang render tĩnh. */}
      <Suspense fallback={null}>
        <TourRunner />
      </Suspense>
```

- [ ] **Step 9: `WhatsNew` không tự mở khi có tour** — thêm test vào `tests/unit/components/WhatsNew.test.tsx` (theo mock sẵn có của file đó: chưa xem bản mới thì tự mở):

```tsx
it("đang có tour thì không tự mở; tour tắt thì mở", async () => {
  status.current = { lastSeenRelease: null }
  setTourActive(true)
  renderVi(<WhatsNew />)
  expect(screen.queryByText(LATEST.title)).toBeNull()
  act(() => setTourActive(false))
  expect(await screen.findByText(LATEST.title)).toBeTruthy()
})
```

Thêm vào import đầu file: `act` từ `@testing-library/react`, `setTourActive` từ `@/lib/tour-store`. Chạy → FAIL. Rồi sửa `src/components/whats-new/WhatsNew.tsx`:

```tsx
import { useTourActive } from "@/lib/tour-store"
// ...
  const tourActive = useTourActive()
  useEffect(() => {
    // Đang chạy tour thì để sau, tour tắt mới tự mở (spec AD §4.2).
    if (unseen && !autoOpened.current && !tourActive) {
      autoOpened.current = true
      setOpen(true)
    }
  }, [unseen, tourActive])
```

Run: `pnpm test tests/unit/components/WhatsNew.test.tsx` → PASS.

- [ ] **Step 10: Gắn `data-tour` cho tour Thêm học sinh**

`src/components/students/AddStudentSplitButton.tsx`:
- nút chính `<Button onClick={onAdd} ...>` thêm `data-tour="student-add"`;
- nút mũi tên (`data-testid="add-student-more"`) thêm `data-tour="student-add-more"`;
- `<DropdownMenuItem ...>` Nhập Excel thêm `data-tour="student-import-item"`.

`src/components/students/StudentFormDialog.tsx`:
- `<div className="space-y-2">` bao ô `fullName` → `data-tour="student-form-name"`;
- `<div className="space-y-2">` bao `billing_mode_label` → `data-tour="student-form-billing"`;
- `<div className="space-y-2">` bao `parentPhone` → `data-tour="student-form-parent"`;
- `<DialogFooter>` → `<DialogFooter data-tour="student-form-submit">`.

- [ ] **Step 11: e2e SPIKE** — tạo `tests/e2e/ad-tour.spec.ts`

```ts
import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { EXPECTED_TEST_ENDPOINT } from '../env-setup';
import { RELEASES } from '../../src/lib/releases';

test.describe.configure({ mode: 'serial' });

const db = new PrismaClient();
const USER = 'tour_demo';

// Tài khoản mới tinh: chưa có học sinh, chưa có ca (để thử bước báo thiếu dữ liệu).
async function cleanup() {
  await db.loginAttempt.deleteMany({ where: { username: USER } });
  const u = await db.user.findUnique({ where: { username: USER } });
  if (!u) return;
  await db.sessionStudent.deleteMany({ where: { session: { userId: u.id } } });
  await db.teachingSession.deleteMany({ where: { userId: u.id } });
  await db.student.deleteMany({ where: { userId: u.id } });
  await db.subject.deleteMany({ where: { userId: u.id } });
  await db.user.delete({ where: { id: u.id } });
}

test.beforeAll(async () => {
  expect(process.env.DATABASE_URL ?? '').toContain(`@${EXPECTED_TEST_ENDPOINT}/`);
  await cleanup();
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  await db.user.create({
    data: {
      username: USER,
      passwordHash: await bcrypt.hash('teacher123', 4),
      fullName: 'Cô Tour',
      plan: 'pro',
      planExpiresAt: expires,
      lastSeenRelease: RELEASES[0].version,
      feedbackPromptAt: new Date(),
      onboardingDismissedAt: null,
      mustChangePassword: false,
    },
  });
});

test.afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[name="username"]', USER);
  await page.fill('input[name="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard/);
}

const popover = (page: Page) => page.locator('.driver-popover');

for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  test(`${vp.width}px: tour Thêm học sinh đi vào trong hộp, bấm Tiếp không đóng hộp`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: vp });
    await login(page);
    await page.getByTestId('tour-button-student').first().click();
    await expect(page).toHaveURL(/\/students$/);
    await expect(popover(page)).toContainText('Thêm học sinh');
    await page.locator('[data-tour="student-add"]:visible').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(popover(page)).toContainText('Họ tên và lớp');
    for (const title of ['Cách thu học phí', 'Thông tin phụ huynh', 'Lưu học sinh']) {
      await popover(page).locator('.driver-popover-next-btn').click();
      await expect(dialog).toBeVisible();
      await expect(popover(page)).toContainText(title);
    }
    await expect(popover(page).locator('.driver-popover-next-btn')).toHaveText('Xong');
    await popover(page).locator('.driver-popover-next-btn').click();
    await expect(page.locator('.driver-overlay')).toHaveCount(0);
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(vp.width);
    await page.close();
  });
}
```

Bước 11 dùng `tour-button-student` (có ở Task 5). **Để chạy được spike ngay ở Task 3**, tạm thay 2 dòng đầu sau `login` bằng `await page.goto('/students?tour=student');` rồi `await expect(page).toHaveURL(/\/students$/);`. Task 5 Step 7 đổi lại về nút.

Run (RAM ≥ 3000 MB, foreground, seed trước):
```bash
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test tests/e2e/ad-tour.spec.ts
```
Expected: 2 passed.

- [ ] **Step 12: Nếu spike KHÔNG qua** (bấm Tiếp đóng hộp / nút không bấm được / tour đơ) sau khi đã thử theo thứ tự: (a) guard Step 4; (b) CSS `pointer-events: auto` Step 5; (c) thêm `onPopoverRender: (popover) => { const host = document.querySelector('[role="dialog"][data-state="open"]'); if (host) host.appendChild(popover.wrapper) }` vào config `driver(...)` ở TourRunner — thì **lùi về "chỉ tới cửa"**:
  - Lỗi chỉ xảy ra khi bấm nút **trên khung tour** lúc đang có hộp/menu mở; bước 👆 không có nút Tiếp nên vẫn giữ được. Trong `src/lib/tours.ts`, **xoá các bước thường (không phải 👆) nằm trong hộp/sheet/menu**: `student` 2–5, `import` 3–5, `session` 2–5, `attendance` 2–5, `tuition` 6. Còn lại: `student` [1], `import` [1, 2], `session` [1], `attendance` [1], `tuition` [1–5], `bank` giữ nguyên (không có hộp).
  - Đổi `bodyKey` của bước 👆 cuối ở 4 tour sang key "cửa" (thêm vào vi/en): `student` bước 1 → `tour_student_door_body` = "Bấm nút này, điền Họ tên, Lớp, cách thu học phí rồi bấm Thêm. Xem chi tiết ở trang Hướng dẫn." / "Tap this, fill name, grade and billing, then tap Add. Details are in the Guide."; `import` bước 2 → `tour_import_door_body` = "Chọn Nhập Excel. Trong hộp: tải file mẫu, điền rồi chọn file." / "Choose Import Excel. In the window: download the template, fill it, then choose the file."; `session` bước 1 → `tour_session_door_body` = "Bấm nút này, chọn ngày, giờ, môn và học sinh rồi bấm Tạo ca dạy." / "Tap this, pick date, time, subject and students, then tap Create session."; `attendance` bước 1 → `tour_attendance_door_body` = "Bấm vào một ca, đánh dấu có mặt hoặc vắng rồi bấm Lưu điểm danh." / "Tap a session, mark present or absent, then tap Save attendance.". Xoá key i18n của các bước đã bỏ.
  - `tuition` bước 5 (👆 mở sheet) trở thành bước cuối: đổi `bodyKey` sang `tour_tuition_door_body` = "Bấm vào học sinh để mở chi tiết. Đóng thiếu hoặc nhiều tháng thì bấm Đóng một phần." / "Tap a student to open details. Paid less or for several months: tap Partial payment.".
  - Bước 👆 cuối của tour giờ là bước cuối: sau khi người dùng bấm, controller tự kết thúc (i ≥ steps.length) — đúng hành vi mong muốn.
  - Sửa test Task 1 (tours.test) và e2e Step 11 cho khớp (e2e: bấm nút → hộp mở → không còn `.driver-overlay`, hộp vẫn mở). Ghi `Ruling: spike Radix thất bại (<lý do quan sát được>) — lùi về chỉ tới cửa theo spec §4.3`. Không cần hỏi người dùng.

- [ ] **Step 13: tsc + lint + test task + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
pnpm test tests/unit/lib/tour-guard.test.ts tests/unit/components/TourRunner.test.tsx tests/unit/components/WhatsNew.test.tsx
git add package.json pnpm-lock.yaml src/lib/tour-guard.ts src/components/tour/TourRunner.tsx src/components/ui/dialog.tsx src/components/ui/sheet.tsx src/components/ui/dropdown-menu.tsx src/app/globals.css src/components/layout/AppLayout.tsx src/components/whats-new/WhatsNew.tsx src/components/students/AddStudentSplitButton.tsx src/components/students/StudentFormDialog.tsx tests/unit/lib/tour-guard.test.ts tests/unit/components/TourRunner.test.tsx tests/unit/components/WhatsNew.test.tsx tests/e2e/ad-tour.spec.ts
git commit -m "feat: chay tour driver.js, chan hop Radix dong khi bam khung tour"
```

Ghi kết quả spike vào ledger (`spike: qua` hoặc Ruling lùi về cửa).

---

### Task 4: Gắn `data-tour` cho 5 tour còn lại + test canh

**Files:**
- Modify: `src/components/students/ImportStudentsDialog.tsx`, `src/components/calendar/CalendarToolbar.tsx`, `src/components/sessions/SessionFormDialog.tsx`, `src/components/calendar/SessionCard.tsx`, `src/components/calendar/SessionListItem.tsx`, `src/components/sessions/SessionNavBar.tsx`, `src/components/sessions/AttendancePanel.tsx`, `src/components/common/ResponsiveList.tsx`, `src/app/(app)/tuition/page.tsx`, `src/components/tuition/PayBlock.tsx`, `src/components/settings/BankAccountCard.tsx`
- Test: `tests/unit/lib/tour-targets.test.ts`, `tests/unit/components/ResponsiveList.test.tsx` (thêm test nếu file có sẵn, không có thì tạo)

**Interfaces:**
- Consumes: `TOURS`, `MISSING_STEPS` (Task 1).
- Produces: prop mới `firstRowTour?: string` của `ResponsiveList` (gắn `data-tour` lên dòng đầu ở bảng desktop và thẻ đầu ở mobile).

- [ ] **Step 1: Test canh đỏ** `tests/unit/lib/tour-targets.test.ts`

```ts
import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { TOURS } from "@/lib/tours"

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return tsxFiles(p)
    return p.endsWith(".tsx") ? [p] : []
  })
}

const source = tsxFiles(join(process.cwd(), "src")).map((f) => readFileSync(f, "utf8")).join("\n")

describe("data-tour", () => {
  // Đổi giao diện mà mất data-tour thì tour gãy âm thầm; test này báo ngay.
  it("mọi target trong TOURS có trong giao diện", () => {
    const targets = new Set(Object.values(TOURS).flatMap((t) => t.steps.map((s) => s.target)).filter((x): x is string => x !== null))
    const missing = [...targets].filter((x) => !source.includes(`data-tour="${x}"`) && !source.includes(`firstRowTour="${x}"`))
    expect(missing).toEqual([])
  })
})
```

Run: `pnpm test tests/unit/lib/tour-targets.test.ts` → FAIL, liệt kê các target chưa gắn (import-*, session-*, attendance-*, tuition-*, bank-*).

- [ ] **Step 2: `ResponsiveList` nhận `firstRowTour`** — test đỏ trong `tests/unit/components/ResponsiveList.test.tsx`:

```tsx
it("firstRowTour gắn data-tour lên dòng đầu (bảng) và thẻ đầu (mobile)", () => {
  render(
    <ResponsiveList
      items={[{ id: 1, name: "A" }, { id: 2, name: "B" }]}
      getKey={(i) => i.id}
      columns={[{ header: "Tên", cell: (i) => i.name }]}
      renderCard={(i) => <div>{i.name}</div>}
      onRowClick={() => {}}
      firstRowTour="tuition-row"
    />
  )
  const tagged = document.querySelectorAll('[data-tour="tuition-row"]')
  expect(tagged).toHaveLength(2)
  expect(tagged[0].textContent).toContain("A")
  expect(tagged[1].textContent).toContain("A")
})
```

(Điều chỉnh prop bắt buộc theo `Props<T>` thật của `ResponsiveList` — đọc file trước; giữ nguyên ý: 2 phần tử gắn, đều là item đầu.) Chạy → FAIL. Sửa `src/components/common/ResponsiveList.tsx`: thêm `firstRowTour?: string` vào `Props<T>` và destructuring; trên `<TableRow ...>` thêm `data-tour={index === 0 ? firstRowTour : undefined}`; trên `<div key={getKey(item)} data-testid="list-card">` thêm `data-tour={index === 0 ? firstRowTour : undefined}`. Chạy → PASS.

- [ ] **Step 3: Gắn các `data-tour` còn lại**

| File | Phần tử | `data-tour` |
|---|---|---|
| `ImportStudentsDialog.tsx` | `<Button variant="outline" onClick={downloadTemplate} ...>` | `import-template` |
| `ImportStudentsDialog.tsx` | `<Button onClick={() => inputRef.current?.click()} ...>` (Chọn file) | `import-file` |
| `ImportStudentsDialog.tsx` | `<details data-testid="import-google-form" ...>` | `import-google-form` |
| `CalendarToolbar.tsx` | `<Button onClick={onCreateClick} ...>` (Tạo ca dạy) | `session-add` |
| `SessionFormDialog.tsx` | `<div className="grid grid-cols-2 gap-4">` đầu tiên (chứa `sessionDate` + `subjectId`) | `session-form-date` |
| `SessionFormDialog.tsx` | `<div className="grid grid-cols-2 gap-4">` thứ hai (chứa `startTime`) | `session-form-time` |
| `SessionFormDialog.tsx` | `<FormItem>` của field `studentIds` | `session-form-students` |
| `SessionFormDialog.tsx` | `<DialogFooter>` | `session-form-submit` |
| `SessionCard.tsx` | `<button>` gốc của thẻ ca (desktop) | `session-card` |
| `SessionListItem.tsx` | `<button>` gốc của dòng ca (mobile) | `session-card` |
| `SessionNavBar.tsx` | `<div className="flex items-center justify-between border-b ...">` gốc | `session-nav` |
| `AttendancePanel.tsx` | `<div className="order-2 flex gap-2 md:order-4 md:gap-1.5">` (cặp nút tích/X mỗi dòng; dòng đầu được chọn vì phần tử hiện đầu tiên) | `attendance-marks` |
| `AttendancePanel.tsx` | `<Button variant="outline" onClick={handleMarkAllPresent} ...>` | `attendance-all-present` |
| `AttendancePanel.tsx` | `<Button onClick={handleSave} ...>` (Lưu điểm danh) | `attendance-save` |
| `tuition/page.tsx` | `<div className="flex items-center gap-1 rounded-lg border ...">` (2 mũi tên + nhãn tháng) | `tuition-month` |
| `tuition/page.tsx` | `<Button size="sm" ...>` trong hàm nút **Đã đóng đủ** (`t("pay_full")`) | `tuition-pay-full` |
| `tuition/page.tsx` | `<Button size="icon" variant="outline" ...>` trong `noticeButton` | `tuition-notice` |
| `tuition/page.tsx` | `<ResponsiveList ...>` | prop `firstRowTour="tuition-row"` |
| `PayBlock.tsx` | nút **Đóng một phần** (`t("pay_partial")`) | `tuition-pay-partial` |
| `BankAccountCard.tsx` | `<div className="space-y-2">` bao `BankSelect` | `bank-select` |
| `BankAccountCard.tsx` | `<div className="space-y-2">` bao `bank-account-number` | `bank-number` |
| `BankAccountCard.tsx` | `<div className="space-y-2">` bao `bank-account-name` | `bank-name` |
| `BankAccountCard.tsx` | `<div className="flex flex-col gap-2 sm:flex-row sm:justify-between">` (nút Lưu/Xoá) | `bank-submit` |

`FormItem`, `DialogFooter`, `Button` đều chuyển tiếp props lạ xuống thẻ DOM nên gắn trực tiếp được.

- [ ] **Step 4: Chạy test, phải xanh**

Run: `pnpm test tests/unit/lib/tour-targets.test.ts tests/unit/components/ResponsiveList.test.tsx`
Expected: PASS. Rồi chạy test component sẵn có của các file đã sửa: `pnpm test tests/unit/components -t "ImportStudents|Attendance|SessionNav|Bank|Tuition|Calendar"` (chạy các file liên quan; tìm bằng `ls tests/unit/components`). Expected: PASS, không đổi kỳ vọng cũ.

- [ ] **Step 5: tsc + lint + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src tests/unit/lib/tour-targets.test.ts tests/unit/components/ResponsiveList.test.tsx
git commit -m "feat: gan data-tour cho tour nhap excel, ca day, diem danh, hoc phi, ngan hang"
```

---

### Task 5: Nút "Chỉ cho tôi" ở thẻ Bắt đầu và `/guide`

**Files:**
- Create: `src/components/tour/TourButton.tsx`
- Modify: `src/components/dashboard/StartCard.tsx`, `src/components/guide/GuideContent.tsx`, `src/app/guide/page.tsx`
- Test: `tests/unit/components/TourButton.test.tsx`, `tests/unit/components/StartCard.test.tsx`, `tests/unit/components/GuideContent.test.tsx`

**Interfaces:**
- Consumes: `tourHref`, `GUIDE_TOURS`, `TourId` (Task 1).
- Produces: `TourButton({ id, className }: { id: TourId; className?: string })` render `Link` có `data-testid="tour-button-<id>"`; `GuideContent({ canTour }: { canTour?: boolean })` (mặc định `false`).

- [ ] **Step 1: Test đỏ** `tests/unit/components/TourButton.test.tsx`

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { LanguageProvider } from "@/components/providers/LanguageProvider"
import { TourButton } from "@/components/tour/TourButton"

afterEach(cleanup)

describe("TourButton", () => {
  it("link tới trang có ?tour=, chữ Chỉ cho tôi", () => {
    render(<LanguageProvider forcedLanguage="vi"><TourButton id="tuition" /></LanguageProvider>)
    const link = screen.getByRole("link", { name: "Chỉ cho tôi" })
    expect(link.getAttribute("href")).toBe("/tuition?tour=tuition")
    expect(link.getAttribute("data-testid")).toBe("tour-button-tuition")
  })
})
```

Thêm vào `tests/unit/components/StartCard.test.tsx` (dùng mock sẵn có của file, trạng thái chưa bước nào xong):

```tsx
it("mỗi bước có nút Chỉ cho tôi đúng tour", () => {
  statusData.current = { dismissed: false, steps: steps({ student: true }) }
  renderVi()
  const hrefs = screen.getAllByRole("link", { name: "Chỉ cho tôi" }).map((a) => a.getAttribute("href"))
  expect(hrefs).toEqual([
    "/students?tour=student",
    "/calendar?tour=session",
    "/calendar?tour=attendance",
    "/tuition?tour=tuition",
    "/settings?tour=bank",
  ])
})
```

Thêm vào `tests/unit/components/GuideContent.test.tsx`:

```tsx
it("canTour: 6 mục có nút Chỉ cho tôi; mặc định không có", () => {
  const { unmount } = render(<LanguageProvider forcedLanguage="vi"><GuideContent canTour /></LanguageProvider>)
  const hrefs = screen.getAllByRole("link", { name: "Chỉ cho tôi" }).map((a) => a.getAttribute("href"))
  expect(hrefs).toEqual([
    "/students?tour=student",
    "/students?tour=import",
    "/calendar?tour=session",
    "/calendar?tour=attendance",
    "/tuition?tour=tuition",
    "/settings?tour=bank",
  ])
  unmount()
  render(<LanguageProvider forcedLanguage="vi"><GuideContent /></LanguageProvider>)
  expect(screen.queryByRole("link", { name: "Chỉ cho tôi" })).toBeNull()
})
```

(File GuideContent.test có sẵn mock `window.matchMedia` trong `beforeEach`; test mới nằm trong cùng `describe` nên dùng chung.) Chạy cả 3 file → FAIL.

- [ ] **Step 2: Viết `src/components/tour/TourButton.tsx`**

```tsx
"use client"

import Link from "next/link"
import { MousePointerClick } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/providers/LanguageProvider"
import { tourHref, type TourId } from "@/lib/tours"
import { cn } from "@/lib/utils"

export function TourButton({ id, className }: { id: TourId; className?: string }) {
  const { t } = useTranslation()
  return (
    <Button asChild variant="outline" size="sm" className={cn("h-11 gap-1.5 md:h-9", className)}>
      <Link href={tourHref(id)} data-testid={`tour-button-${id}`}>
        <MousePointerClick className="size-4" aria-hidden />
        {t("tour_show_me")}
      </Link>
    </Button>
  )
}
```

- [ ] **Step 3: `StartCard`** — thêm trường `tour: TourId` vào kiểu phần tử `START_STEPS` và giá trị: `student` → `"student"`, `session` → `"session"`, `attendance` → `"attendance"`, `payment` → `"tuition"`, `bank` → `"bank"`. Trong `<li>`, đặt `<TourButton id={s.tour} />` **ngay sau** thẻ `<a href={`/guide#${s.guideId}`} ...>` (hiện cả khi bước đã xong, để xem lại được). Import `TourButton` và kiểu `TourId`.

- [ ] **Step 4: `GuideContent`** — đổi chữ ký `export function GuideContent({ canTour = false }: { canTour?: boolean })`; thay dòng `<h2 ...>{i + 1}. {s.title}</h2>` bằng:

```tsx
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">{i + 1}. {s.title}</h2>
            {canTour && GUIDE_TOURS[s.id] && <TourButton id={GUIDE_TOURS[s.id]!} className="print:hidden" />}
          </div>
```

Import `GUIDE_TOURS` từ `@/lib/tours`, `TourButton`.

- [ ] **Step 5: `src/app/guide/page.tsx`**

```tsx
import type { Metadata } from "next"
import { auth } from "@/server/auth"
import { isAdminUsername } from "@/lib/admin"
import { GuideContent } from "@/components/guide/GuideContent"

export const metadata: Metadata = { title: "Hướng dẫn sử dụng" }

// Công khai để gửi link cho giáo viên khác; nút "Chỉ cho tôi" chỉ hiện cho giáo viên đã đăng nhập.
export default async function GuidePage() {
  const user = (await auth())?.user
  const canTour = !!user && !isAdminUsername(user.username) && user.mustChangePassword !== true
  return <GuideContent canTour={canTour} />
}
```

- [ ] **Step 6: Chạy test, phải xanh**

Run: `pnpm test tests/unit/components/TourButton.test.tsx tests/unit/components/StartCard.test.tsx tests/unit/components/GuideContent.test.tsx tests/unit/next15-contract.test.ts`
Expected: PASS.

- [ ] **Step 7: e2e về lại nút** — trong `tests/e2e/ad-tour.spec.ts`, bỏ dòng tạm `page.goto('/students?tour=student')` của Task 3, dùng lại `await page.getByTestId('tour-button-student').first().click();` (bấm từ thẻ Bắt đầu ở Dashboard).

- [ ] **Step 8: tsc + lint + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/components/tour/TourButton.tsx src/components/dashboard/StartCard.tsx src/components/guide/GuideContent.tsx src/app/guide/page.tsx tests/unit/components/TourButton.test.tsx tests/unit/components/StartCard.test.tsx tests/unit/components/GuideContent.test.tsx tests/e2e/ad-tour.spec.ts
git commit -m "feat: nut Chi cho toi o the Bat dau va trang huong dan"
```

---

### Task 6: e2e còn lại, RELEASES 0.15.0, kiểm toàn bộ

**Files:**
- Modify: `tests/e2e/ad-tour.spec.ts`, `src/lib/releases.ts`, `package.json`, `.superpowers/sdd/2026-10-03-y-thu-hoc-phi/half1.txt`
- Test: toàn bộ

- [ ] **Step 1: Thêm e2e** vào cuối `tests/e2e/ad-tour.spec.ts`

```ts
test('Điểm danh khi chưa có ca: bước báo thiếu → chuyển sang tour Tạo ca dạy', async ({ page }) => {
  await login(page);
  await page.getByTestId('tour-button-attendance').first().click();
  await expect(popover(page)).toContainText('Chưa có ca dạy');
  await popover(page).getByRole('button', { name: 'Chỉ cách tạo ca' }).click();
  await expect(popover(page)).toContainText('Tạo ca dạy');
  await expect(page.locator('[data-tour="session-add"]:visible')).toBeVisible();
});

test('Esc tắt tour sạch, không còn lớp phủ; tải lại không chạy lại', async ({ page }) => {
  await login(page);
  await page.goto('/settings?tour=bank');
  await expect(popover(page)).toContainText('Ngân hàng');
  await expect(page).toHaveURL(/\/settings$/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.driver-overlay')).toHaveCount(0);
  await expect(popover(page)).toHaveCount(0);
  await page.reload();
  await page.waitForTimeout(1000);
  await expect(popover(page)).toHaveCount(0);
});

test('/guide: chưa đăng nhập không có nút; giáo viên đăng nhập có 6 nút', async ({ browser }) => {
  const guest = await browser.newPage();
  await guest.goto('/guide');
  await expect(guest.locator('section#hoc-sinh')).toBeVisible();
  await expect(guest.getByRole('link', { name: 'Chỉ cho tôi' })).toHaveCount(0);
  await guest.close();
  const page = await browser.newPage();
  await login(page);
  await page.goto('/guide');
  await expect(page.getByRole('link', { name: 'Chỉ cho tôi' })).toHaveCount(6);
  await page.close();
});
```

- [ ] **Step 2: Đưa file e2e vào danh sách chạy** — thêm ` tests/e2e/ad-tour.spec.ts` vào cuối `.superpowers/sdd/2026-10-03-y-thu-hoc-phi/half1.txt` (cùng dòng, cách bằng dấu cách).

- [ ] **Step 3: RELEASES + version** — `package.json` `"version": "0.15.0"`; thêm đầu mảng `RELEASES` trong `src/lib/releases.ts`:

```ts
  {
    version: "0.15.0",
    date: "2026-10-07",
    title: "Nút Chỉ cho tôi",
    summary: "App chỉ từng bước ngay trên màn hình cho 6 việc đầu tiên: thêm học sinh, nhập Excel, tạo ca, điểm danh, thu học phí, tài khoản ngân hàng.",
    notify: true,
    items: [
      { kind: "new", title: "Chỉ cho tôi", body: "Bấm Chỉ cho tôi ở thẻ Bắt đầu hoặc trang Hướng dẫn, app tô sáng đúng nút cần bấm và hướng dẫn từng bước.", guideId: "bat-dau" },
    ],
  },
```

Test `WhatsNew`/release sẵn có tìm theo tiêu đề có thể trùng chữ "Chỉ cho tôi" giữa title và item: nếu `findByText` báo trùng, đổi tiêu đề item thành "Hướng dẫn tận nơi", ghi Ruling.

- [ ] **Step 4: Kiểm toàn bộ (1 lần duy nhất)**

```bash
pnpm exec tsc --noEmit && pnpm lint
pnpm test
```
Expected: tất cả PASS. Rồi full e2e 2 nửa (RAM ≥ 3000 MB, foreground, seed trước mỗi nửa):
```bash
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test $(cat .superpowers/sdd/2026-10-03-y-thu-hoc-phi/half1.txt)
pnpm test tests/integration/plan-launch-migration.test.ts
pnpm exec playwright test $(cat .superpowers/sdd/2026-10-03-y-thu-hoc-phi/half2.txt)
```
Expected: tất cả PASS (test bỏ qua sẵn có giữ nguyên). **Phải chạy FULL e2e, không chỉ file mới.** e2e cũ hỏng vì thêm nút (vd đếm link trong thẻ Bắt đầu / `/guide`) thì sửa kỳ vọng cho đúng hành vi mới, ghi Ruling; không xoá/nới test.

- [ ] **Step 5: Commit + báo cáo**

```bash
git add tests/e2e/ad-tour.spec.ts src/lib/releases.ts package.json
git commit -m "test: e2e tour huong dan, phat hanh 0.15.0"
```

Ghi DONE vào `.superpowers/gehihi/kenh.md` + báo cáo `.superpowers/gehihi/bao-cao-AD.md` (kết quả spike, số test, Rulings).
