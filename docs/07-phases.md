# 07 — Phases & Sub-phases

> **Claude Code AI đọc file này đầu mỗi phiên.** Tìm sub-phase tiếp theo chưa done → đọc docs liên quan → code → review → commit.

## Nguyên tắc bắt buộc

```
1 phiên làm việc = 1 sub-phase duy nhất
Trình tự trong 1 phiên:
  → Đọc spec trong docs/ liên quan
  → Code
  → Chạy tests
  → Review 2 lần (xem docs/08-review.md)
  → Commit nếu pass
  → DỪNG, sang phiên mới

PHÂN BIỆT DATABASE:
  - Dữ liệu Test: Chỉ dùng branch 'test' của Neon (.env.test / .env.local).
  - Dữ liệu Thật (Production): Chỉ dùng branch 'main' của Neon (.env).
  - TUYỆT ĐỐI không chạy test hay migrate reset trên database Production.
```

---

## Phase 0: Infrastructure Setup

> Đọc: `docs/05-deploy.md`

### Sub 0.1 — GitHub + Neon
- [x] Tạo GitHub repo `teaching-schedule`, init README
- [x] Tạo Neon project (region Singapore), lấy DATABASE_URL + DIRECT_URL
- [x] Lưu connection strings vào file local (KHÔNG commit)
- [x] Tạo Neon branch "dev" cho local development

### Sub 0.2 — Vercel
- [ ] Import repo vào Vercel
- [ ] Set env vars: DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
- [ ] Verify Vercel nhận diện Next.js framework

**✅ Phase 0 done khi:** GitHub repo + Neon DB + Vercel project sẵn sàng.

---

## Phase 1: Project Skeleton

> Đọc: `docs/01-overview.md`, `docs/02-database.md`, `docs/05-deploy.md`

### Sub 1.1 — Init Next.js + Config
- [x] `pnpm create next-app@14 teaching-schedule --typescript --tailwind --app --src-dir`
- [x] `tsconfig.json`: strict: true, paths: `@/*` → `./src/*`
- [x] `next.config.ts`: KHÔNG output standalone, ignoreBuildErrors: false
- [x] Tạo `.env.example`, `.env.local` (paste Neon dev branch strings), `.gitignore`
- [x] **Test:** `pnpm dev` → localhost:3000 hiện trang Next.js mặc định ✓
- [x] **Review 1:** tsconfig strict? paths đúng? .gitignore có .env.local?
- [x] **Review 2:** `pnpm build` pass?

### Sub 1.2 — Prisma + Database Schema
- [x] Install: `@prisma/client`, `prisma` (dev)
- [x] Tạo `prisma/schema.prisma` (**5 models**: User, Subject, Student, TeachingSession, SessionStudent theo `docs/02-database.md`)
- [x] Lưu ý: `startTime`/`endTime` dùng `@db.Time(0)`, `TeachingSession.subject` là FK vào Subject
- [x] Tạo `src/server/db.ts` (singleton pattern)
- [x] `pnpm prisma migrate dev --name init` → tạo tables trên Neon
- [x] Tạo `prisma/seed.ts` → seed user teacher/teacher123 + 5 subjects mặc định
- [x] `pnpm db:seed` → verify OK
- [x] **Test:** `pnpm prisma studio` → 5 bảng + 1 user + 5 subjects ✓
- [x] **Review 1:** Schema đúng spec? directUrl có? `@db.Time(0)` đúng? FK Subject?
- [x] **Review 2:** `pnpm build` pass? Prisma generate OK?

### Sub 1.3 — tRPC Setup
- [x] Install: `@trpc/server`, `@trpc/client`, `@trpc/react-query`, `@tanstack/react-query`
- [x] Tạo `src/server/trpc/index.ts` (context, publicProcedure, protectedProcedure)
- [x] Tạo `src/server/trpc/root.ts` (root router, thêm `health.ping`)
- [x] Tạo `src/app/api/trpc/[trpc]/route.ts`
- [x] Tạo `src/lib/trpc.ts` (client hooks)
- [x] Tạo `src/components/providers/TRPCProvider.tsx`
- [x] **Test:** GET `localhost:3000/api/trpc/health.ping` → `{ status: "ok" }` ✓
- [x] **Review 1:** Context có db? protectedProcedure check session?
- [x] **Review 2:** `pnpm build` pass?
- [x] Viết `tests/integration/health.test.ts` (2 cases)

### Sub 1.4 — shadcn/ui + Layout Shell
- [x] `pnpm dlx shadcn@latest init` (style: default, color: slate)
- [x] Install components: button, card, dialog, table, input, select, form, badge, toast, toaster, dropdown-menu, popover, calendar, switch, checkbox, skeleton
- [x] Install `lucide-react`
- [x] Tạo `src/components/layout/AppLayout.tsx`
- [x] Tạo `src/components/layout/AppSidebar.tsx` (4 menu items + icons)
- [x] Tạo `src/components/layout/AppHeader.tsx` (placeholder)
- [x] Cập nhật `globals.css`: calendar styles + export styles (theo `docs/04-frontend.md`)
- [x] Tạo placeholder pages: `/login`, `/calendar`, `/students`, `/reports`, `/dashboard`
- [x] **Test:** Navigate tất cả trang → sidebar highlight đúng ✓, responsive collapse ✓
- [x] **Review 1:** Menu tiếng Việt? Icons đúng? Mobile collapsible?
- [x] **Review 2:** `pnpm build` pass? Mobile viewport OK?

### Sub 1.5 — Testing Infrastructure
- [x] Install: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`
- [x] Tạo `vitest.config.ts` (theo `docs/06-testing.md`)
- [x] Tạo `tests/setup.ts`, `tests/helpers/trpc.ts`, `tests/helpers/db.ts`
- [x] Viết `tests/unit/utils/utils.test.ts` (test cn, getLevel, calcAttendanceRate)
- [x] **Test:** `pnpm test:unit` → pass ✓
- [x] **Review:** Path alias `@/` hoạt động trong tests?

### Sub 1.6 — First Deploy
- [x] `git add . && git commit -m "feat: project skeleton" && git push`
- [x] Verify Vercel build thành công
- [x] **Verify URL:** layout hiển thị ✓, navigation hoạt động ✓, `/api/trpc/health.ping` OK ✓

**✅ Phase 1 done khi:** App live trên Vercel, layout đẹp, DB có tables, tRPC + tests sẵn sàng.

---

## Phase 2: Authentication + Security + Multi-tenant Foundation

> Đọc: `docs/03-api.md` (Auth, Rate limit, Ownership), `docs/02-database.md` (LoginAttempt model, userId FK), `docs/06-testing.md` (auth + multi-tenant tests)

### Sub 2.1 — NextAuth Config + Rate Limit
- [x] Install: `next-auth@5.0.0-beta.25`, `bcryptjs`, `@types/bcryptjs`
- [x] Tạo `src/server/auth.ts` + `src/server/auth-credentials.ts`:
  - Credentials provider với **rate limit check** (5 fail / 15 phút)
  - bcrypt cost **12** (production), **4** (test)
  - Ghi `LoginAttempt` mọi lần thử (thành công và thất bại)
  - Cập nhật `user.lastLoginAt` khi login thành công
  - JWT expire **8h**
- [x] Tạo `src/app/api/auth/[...nextauth]/route.ts`
- [x] Tạo `src/components/providers/SessionProvider.tsx`
- [x] Wrap app trong SessionProvider
- [x] **Review 1:** Rate limit logic đúng? LoginAttempt được ghi? lastLoginAt update?
- [x] **Review 2:** `pnpm build` pass?
- [x] Viết `tests/integration/auth.test.ts` (login + rate limit — 6 cases; me/changePassword sẽ thêm ở Sub 2.3)

### Sub 2.2 — Middleware + Login Page
- [x] Tạo `src/middleware.ts`
- [x] Tạo `src/app/login/page.tsx` (+ `LoginForm.tsx` + `actions.ts`):
  - Hiển thị lỗi `RATE_LIMITED` rõ ràng: "Tài khoản tạm khóa 15 phút do đăng nhập sai nhiều lần"
  - Không cho biết username có tồn tại không
- [x] **Test:** Guard route, login OK, rate limit message ✓ (build pass; verify thủ công sau khi deploy)

### Sub 2.3 — Auth tRPC (me + changePassword) + Logout
- [x] Tạo `src/server/trpc/routers/auth.ts` (`auth.me`, `auth.changePassword`)
- [x] Thêm vào root.ts
- [x] Cập nhật AppHeader: tên GV, nút Logout, link "Đổi mật khẩu" (DropdownMenu + ChangePasswordDialog)
- [x] **Test:** pass ✓ (5 cases mới: me OK/UNAUTHORIZED, changePassword OK/sai currentPw/validation)

### Sub 2.4 — `_base.service.ts` — Ownership Helper
- [x] Tạo `src/server/services/_base.service.ts` với `assertOwnership()`
- [x] **Quan trọng:** Trả `NOT_FOUND` thay `FORBIDDEN` (xem lý do trong `docs/03-api.md`)
- [x] Viết unit test cho `assertOwnership`:
  - null record → NOT_FOUND ✓
  - userId khác → NOT_FOUND ✓
  - userId đúng → không throw ✓

### Sub 2.5 — Admin CLI Scripts
- [x] Tạo `scripts/create-user.ts` (validate password strength, seed subjects)
- [x] Tạo `scripts/list-users.ts`
- [x] Tạo `scripts/deactivate-user.ts`
- [x] Tạo `scripts/reset-password.ts`
- [x] Thêm npm scripts: `user:create`, `user:list`, `user:deactivate`, `user:reset-pw`
- [x] **Test thủ công:** `pnpm user:create --username test2 --password "TestPass@2026"` → user tạo + 5 subjects ✓
- [x] **Test thủ công:** `pnpm user:list` → thấy 2 users ✓
- [x] **Test thủ công:** `pnpm user:deactivate --username test2` → isActive=false ✓ (login chặn ở Sub 2.1 đã verify)

### Sub 2.6 — Deploy + Verify Auth
- [x] `pnpm test && pnpm build && git push`
- [x] **Verify Vercel:** login ✓, rate limit ✓, logout ✓, route guard ✓
- [x] **Verify CLI trên server:** tạo user thứ 2, login được ✓

**✅ Phase 2 done khi:** Auth + rate limit + CLI + ownership helper hoàn chỉnh.

---

## Phase 3: Students CRUD

> Đọc: `docs/03-api.md` (student router), `docs/04-frontend.md` (StudentList, StudentFormDialog), `docs/06-testing.md` (student tests)

### Sub 3.1 — Zod Schemas + Service
- [x] Tạo `src/lib/schemas/student.ts` (create, update, filter schemas)
- [x] Tạo `src/server/services/student.service.ts` (list, create, update, softDelete)
- [x] **Test:** `pnpm test:unit` → student.schema.test.ts pass (10 cases) ✓
- [x] **Review 1:** Zod catch edge cases? Service có try-catch?

### Sub 3.2 — tRPC Student Router
- [x] Tạo `src/server/trpc/routers/student.ts` (list, create, update, delete)
- [x] Thêm vào root.ts
- [x] Viết `tests/integration/student.test.ts` (16 cases — bao gồm 2 multi-tenant)
- [x] **Test:** `pnpm test:integration` → student.test.ts pass ✓
- [x] **Review 1:** Prisma có index? search insensitive? level computed?
- [x] **Review 2:** Error handling đúng code (NOT_FOUND, UNAUTHORIZED)?

### Sub 3.3 — Students Page UI
- [x] Tạo `src/app/students/page.tsx`
- [x] Tạo `src/components/students/StudentList.tsx` (Table, Badge, Actions)
- [x] Tạo `src/components/students/StudentFormDialog.tsx` (create + edit mode)
- [x] Filter bar: Select lớp + Input tìm tên
- [x] Confirm dialog trước xóa, Toast sau actions
- [x] **Test thủ công:** Thêm 5 HS → sửa 1 → xóa 1 → lọc → search ✓ (tự verify trên dev server)
- [x] **Review 1:** Validation message tiếng Việt? Badge màu đúng?
- [x] **Review 2:** Mobile responsive? Loading state? Empty state?

### Sub 3.4 — Deploy + Full Test
- [x] `pnpm test && pnpm build` → pass ✓ (53/53)
- [x] `git push` → verify Vercel ✓

### Sub 3.5 — Multi-tenant Isolation Tests ← MỚI (chạy sau Sub 3.2 + 4.2 + 5.1 xong)
> Chạy riêng sau khi có đủ student + session + attendance routers.
- [x] Cập nhật `tests/helpers/trpc.ts`: thêm `getAuthedCallerForUser(username)` cho multi-user
- [x] Tạo user test thứ 2 trong `tests/setup.ts`
- [x] Viết `tests/integration/multi-tenant.test.ts` (15 isolation cases theo `docs/06-testing.md`)
- [x] **Test:** `pnpm test:integration` → ALL isolation cases pass ✓
- [x] **Review:** Mọi case đều trả NOT_FOUND (không FORBIDDEN) khi truy cập data user khác?

**✅ Phase 3 done khi:** CRUD HS + test coverage + multi-tenant isolation verified.

---

## Phase 4: Calendar + Sessions

> Đọc: `docs/03-api.md` (session router), `docs/04-frontend.md` (Calendar components, useCalendar), `docs/06-testing.md` (session + calendar tests)

### Sub 4.1 — Session Schemas + Service
- [x] Tạo `src/lib/schemas/subject.ts` (create, update schemas)
- [x] Tạo `src/lib/schemas/session.ts` (create dùng `subjectId`, filter, bulkCreate theo `docs/03-api.md`)
- [x] Tạo `src/server/services/session.service.ts` bao gồm **`checkOverlap()`** (raw query, xem `docs/02-database.md`)
- [x] Thêm helpers vào `src/lib/utils.ts`: `parseTimeToDate`, `formatTime`, `calcDurationMinutes`, `formatDuration`
- [x] **Test:** schema tests (6 cases) + time helper tests (11 cases) pass ✓ (41/41 unit tests)

### Sub 4.1b — Subject Router ← MỚI (sub-phase riêng)
- [x] Tạo `src/server/trpc/routers/subject.ts` (list, create, update, delete/soft)
- [x] Thêm vào root.ts
- [x] Viết `tests/integration/subject.test.ts` (8 cases)
- [x] **Test:** pass ✓ (78/78 toàn bộ test, build OK)
- [x] **Review 1:** list sort sortOrder ASC ✓; isDefault=true tự unset cái khác ✓; chặn xóa subject đang dùng + chặn xóa subject cuối cùng ✓

### Sub 4.2 — tRPC Session Router (CRUD cơ bản)
- [x] Tạo `src/server/trpc/routers/session.ts` (getMonth, create, update, delete)
- [x] **`create`**: gọi `checkOverlap()` trước khi insert → throw CONFLICT nếu trùng
- [x] **`update`**: gọi `checkOverlap(..., excludeId)` trước khi update (chỉ khi đổi giờ/ngày)
- [x] **`getMonth`**: include `subject` + sessionStudents, format `startTime`/`endTime` → "HH:mm", thêm `durationMins` + `studentCount`
- [x] Thêm vào root.ts
- [x] Viết `tests/integration/session.test.ts` (14 cases — CRUD + 8 overlap + ownership subject của user khác)
- [x] **Test:** pass ✓ (99/99)
- [x] **Review 1:** Overlap cases: trùng hoàn toàn ✗, trùng 1 phần ✗, tiếp nối ✓, khác ngày ✓, tự update ✓

### Sub 4.3 — useCalendar Hook
- [x] Tạo `src/hooks/useCalendar.ts` (`buildCalendarGrid`, `buildMonthLabel`, `useCalendar` hook + prev/next/goToMonth)
- [x] **Test:** useCalendar.test.ts pass (7 cases grid logic) ✓
- [x] **Review 1:** Monday-first ✓; Tháng 4/2026 bắt đầu T4 → 2 ô trống ✓; Tháng 2/2026 bắt đầu CN → 6 ô trống ✓

### Sub 4.4 — Calendar UI + SessionCard
- [x] Tạo `src/components/calendar/MonthCalendar.tsx` (header navigation + grid + DAY_NAMES header row)
- [x] Tạo `src/components/calendar/CalendarDayCell.tsx` (today/outside variants, click ô trống)
- [x] Tạo `src/components/calendar/SessionCard.tsx` (border màu theo cấp: tieu_hoc / thcs / mixed)
- [x] Cập nhật `src/app/(app)/calendar/page.tsx` — render MonthCalendar
- [x] Navigate tháng ◄ ►, highlight hôm nay (today flag trong grid cell)
- [x] **Test thủ công:** Tạo seed sessions → cards đúng vị trí (verify trên dev server)

### Sub 4.5 — SessionFormDialog
- [x] Tạo `src/components/sessions/SessionFormDialog.tsx`
- [x] Click ô trống → dialog pre-fill ngày ✓
- [x] Create + Edit mode, validate endTime > startTime
- [x] **Test thủ công:** Tạo ca → card xuất hiện ✓, sửa → cập nhật ✓

### Sub 4.6 — Deploy + Full Test
- [x] `pnpm test && pnpm build && git push` → verify Vercel ✓

**✅ Phase 4 done khi:** Calendar + Session CRUD live.

---

## Phase 5: Gán Học Sinh + Điểm Danh

> Đọc: `docs/03-api.md` (attendance), `docs/04-frontend.md` (StudentPicker, AttendancePanel, SessionDetailDialog)

### Sub 5.1 — tRPC: addStudents + Attendance
- [x] Thêm vào session router: `addStudents`, `removeStudent`
- [x] Tạo `src/lib/schemas/attendance.ts`
- [x] Tạo `src/server/trpc/routers/attendance.ts` (update, get)
- [x] Tạo `src/server/services/attendance.service.ts`
- [x] Viết `tests/integration/attendance.test.ts` (8 cases)
- [x] **Test:** pass ✓

### Sub 5.2 — StudentPicker
- [x] Tạo `src/components/sessions/StudentPicker.tsx`
- [x] Tích hợp vào SessionFormDialog
- [x] **Test thủ công:** Tạo ca + gán 3 HS → card hiện "3 HS" ✓

### Sub 5.3 — SessionDetailDialog + AttendancePanel
- [x] Tạo `src/components/sessions/SessionDetailDialog.tsx`
- [x] Tạo `src/components/sessions/AttendancePanel.tsx`
- [x] Click SessionCard → detail dialog ✓
- [x] Điểm danh → lưu → đóng → mở lại → đúng ✓
- [x] Quick-all "Có mặt" button ✓

### Sub 5.4 — Deploy + Full Test
- [x] `pnpm test && pnpm build && git push` → verify Vercel ✓

**✅ Phase 5 done khi:** Gán HS + điểm danh live.

---

## Phase 6: Filters + Student Schedule

> Đọc: `docs/04-frontend.md` (FilterBar, StudentScheduleView, useFilters), `docs/06-testing.md` (useFilters tests)

### Sub 6.1 — useFilters + FilterBar
- [x] Tạo `src/hooks/useFilters.ts` (state + URL searchParams sync)
- [x] Tạo `src/components/filters/FilterBar.tsx`
- [x] Tích hợp vào CalendarView → auto refetch khi filter thay đổi
- [x] **Test:** useFilters.test.ts pass (6 cases) ✓
- [x] **Test thủ công:** Lọc lớp 3 → chỉ hiện ca lớp 3 ✓, URL có ?grade=3 ✓

### Sub 6.2 — StudentScheduleView
- [x] Tạo `src/components/students/StudentScheduleView.tsx`
- [x] Tích hợp vào CalendarView (hiện khi filter 1 HS)
- [x] ref={exportRef} bao đúng export area
- [x] **Test thủ công:** Filter 1 HS → schedule view hiện ✓, tổng kết đúng % ✓

### Sub 6.3 — Deploy + Full Test
- [x] `pnpm test && pnpm build && git push` → verify Vercel ✓

**✅ Phase 6 done khi:** Filters + Student Schedule live.

---

## Phase 7: Export + Reports

> Đọc: `docs/04-frontend.md` (useExport, useExcelExport, ExportExcelButton), `docs/03-api.md` (report router)

### Sub 7.1 — Export PNG
- [x] Tạo `src/hooks/useExport.ts` (html2canvas)
- [x] Tạo `src/components/reports/ExportButton.tsx`
- [x] Tích hợp vào StudentScheduleView
- [x] **Test thủ công:** Chụp PNG → ảnh sạch, không có nút ✓

### Sub 7.2 — Export Excel chế độ 1 + 2
- [x] Install: `exceljs`, `file-saver`, `@types/file-saver`
- [x] `src/hooks/useExcelExport.ts`: `exportMonthlySchedule` + `exportStudentSchedule`
- [x] **Test thủ công:** Xuất 2 chế độ → mở Excel → đúng format ✓

### Sub 7.3 — Export Excel chế độ 3 + 4 + Button
- [x] `exportGradeReport` + `exportAttendanceSummary`
- [x] Tạo `src/components/reports/ExportExcelButton.tsx` (DropdownMenu context-aware)
- [x] Tích hợp vào: FilterBar, StudentScheduleView
- [x] **Test thủ công:** 4 chế độ đều xuất được, file naming đúng ✓

### Sub 7.4 — Report tRPC + ReportsView
- [x] Tạo `src/server/trpc/routers/report.ts` + `report.service.ts`
- [x] Viết `tests/integration/report.test.ts` (6 cases)
- [x] Tạo `src/app/reports/page.tsx` + `StudentReport.tsx`
- [x] Tích hợp ExportExcelButton vào ReportsView
- [x] **Test:** pass ✓

### Sub 7.5 — Deploy + Full Test
- [x] `pnpm test && pnpm build && git push` → verify Vercel ✓

**✅ Phase 7 done khi:** Export PNG + Excel (4 chế độ) + Reports live.

---

## Phase 8: Bulk Create + Polish + Final

> Đọc: `docs/06-testing.md` (E2E), `docs/08-review.md` (Final Acceptance Checklist)

### Sub 8.1 — Bulk Create + Duplicate
- [x] Thêm `session.bulkCreate` + `session.duplicate` vào session router
- [x] Tạo `src/components/sessions/BulkCreateDialog.tsx`
- [x] Thêm nút Duplicate vào SessionDetailDialog
- [x] Viết integration tests (5 cases bulkCreate + duplicate)
- [x] **Test:** pass ✓

### Sub 8.2 — Dashboard
- [x] Tạo `src/app/dashboard/page.tsx` (4 stat cards)
- [x] **Test thủ công:** Số liệu đúng ✓

### Sub 8.3 — Responsive Mobile
- [x] Calendar: grid → list view < 768px
- [x] Sidebar: hamburger menu
- [x] Dialog: full-screen mobile
- [x] Table: horizontal scroll
- [x] **Test:** Chrome DevTools → iPhone SE ✓, Galaxy S8 ✓

### Sub 8.4 — UI Polish
- [x] Skeleton loading cho table + calendar
- [x] Empty states cho tất cả list
- [x] Confirm dialog trước xóa (đồng nhất)
- [x] Toast cho tất cả actions
- [x] Error states khi API fail
- [x] Favicon + `<title>Quản lý lịch dạy</title>`
- [x] **Review 1:** Mọi action có loading/success/error feedback?
- [x] **Review 2:** UI consistent? Console sạch?

### Sub 8.5 — E2E Tests
- [x] Install: `@playwright/test`, chạy `pnpm playwright install`
- [x] Tạo `playwright.config.ts`
- [x] Viết 5 spec files (auth, students, calendar, attendance, export)
- [x] **Test:** `pnpm test:e2e` → pass ✓

### Sub 8.6 — Final Deploy + Acceptance
- [x] `pnpm test:all` → ALL pass ✓
- [x] `pnpm build` → no errors, no warnings ✓
- [x] `git push` → Vercel deploy ✓
- [x] Chạy **Final Acceptance Checklist** (xem `docs/08-review.md`) ✓

**✅ Phase 8 done khi:** SẢN PHẨM HOÀN CHỈNH.**
