# AL — Nơi dạy (nền tảng): Implementation Plan

> **For agentic workers:** superpowers:executing-plans. Từng task: test trước (RED) → code (GREEN) → test liên quan → commit. Bước `- [ ]`.

**Goal:** Thêm Nơi dạy + cách tính tiền theo nơi. HS/ca gắn nơi. Ẩn phần học phí khi không có nơi tính theo học sinh. Popup đăng ký chọn nơi dạy + gói. Giới hạn 20/50.

**Architecture:**
- Bảng `teaching_places` + `place_billing_changes`; cột `place_id` ở students/teaching_sessions; migration SQL backfill "Lớp tại nhà".
- Hàm thuần `resolvePlaceBilling` cắm vào các điểm tính học phí qua một chỗ chung (`loadBillingChanges` / `resolveBilling` hiện có), để các service khác hưởng theo.
- UI dùng hook `usePlaceSummary`.

**Tech Stack:** Prisma 5, tRPC v11, Next.js 15, shadcn/ui, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-11-al-noi-day-nen-tang-design.md` (đọc kỹ §3 quy tắc tính tiền). Mẫu `.superpowers/mockups/aj/` (AJ5).

**Nhánh:** `feat/al-noi-day` từ `main` **sau khi AK đã merge** (dùng FilterBar mới).

## Global Constraints

- Migration chỉ chạy trên DB test (`.env.test`, localhost:5433). Vercel tự chạy lên prod khi merge. **Không bao giờ** `db push` / `migrate reset` / dùng `.env`.
- Tài khoản cũ sau migration nhìn thấy app **y hệt** trước. Mọi chỗ "chỉ hiện khi ≥ 2 nơi" phải giữ đúng.
- Học phí HS tính theo **nơi học của HS** (không theo nơi của ca).
- Đổi cách tính tiền áp dụng từ **tháng hiện tại VN**, tháng cũ giữ nguyên.
- Giới hạn HS: 20 / 50 / không giới hạn. Giá dự phòng 39000 / 69000.
- Mobile-first 375 trước, nút ≥ 44px, không cuộn ngang. Chữ mới đủ vi + en. Ghi chú code tiếng Việt 1–2 dòng.
- Version **0.20.0**. Commit 1 dòng `[AL] ...`, không body, không Co-Authored-By. Khoá test bắt buộc.

## Review Focus

1. HS đổi từ nơi theo HS sang nơi theo ca/giờ giữa chừng, còn nợ cũ: vẫn hiện ở Học phí kèm nhãn nơi, nợ không mất, Tổng quan "Còn nợ" vẫn tính nợ cũ.
2. User có đúng 1 nơi và nơi đó là trung tâm (`per_session`): popup không hiện lại, tab Học phí/Báo cáo ẩn, `/tuition` gõ tay ra trang trống có nút, StartCard không đòi bước thu tiền.
3. Gọi `setupInitial` 2 lần (bấm đúp / 2 tab): không tạo trùng nơi.
4. Xoá nơi cuối cùng / nơi còn ca tương lai: bị chặn với thông báo rõ.
5. Snapshot học phí đã ghi của tháng cũ không bị viết lại khi đổi nơi học của HS.

---

### Task 1: Schema + migration backfill

**Files:**
- Modify: `prisma/schema.prisma` (TeachingPlace, PlaceBillingChange, Student.placeId, TeachingSession.placeId, quan hệ User.places)
- Create: `prisma/migrations/<timestamp>_al_teaching_places/migration.sql`
- Create: `tests/integration/al-migration-backfill.test.ts`

**Produces:** model `TeachingPlace { id, userId, name, kind, color, sortOrder, isDeleted, deletedAt }`, `PlaceBillingChange { placeId, fromKey, billing }`, `Student.placeId`, `TeachingSession.placeId`.

- [ ] **Step 1: Viết schema** đúng spec §2.
- [ ] **Step 2: Tạo migration SQL** bằng `prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ... --script` (chạy với `.env.test`) hoặc viết tay. Cuối file thêm phần backfill:
  - `INSERT INTO teaching_places (user_id, name, kind, color, sort_order) SELECT id, 'Lớp tại nhà', 'home', '<màu đầu bảng Môn học>', 0 FROM users u WHERE NOT EXISTS (SELECT 1 FROM teaching_places p WHERE p.user_id = u.id);`
  - `INSERT INTO place_billing_changes (place_id, from_key, billing) SELECT id, 0, 'per_student' FROM teaching_places p WHERE NOT EXISTS (...);`
  - `UPDATE students s SET place_id = p.id FROM teaching_places p WHERE p.user_id = s.user_id AND s.place_id IS NULL;`, tương tự cho `teaching_sessions`.
  - Lấy màu đầu bảng từ hằng số màu Môn học trong code (`SubjectFormDialog` hoặc constants). Ghi đúng mã hex.
- [ ] **Step 3: Áp lên DB test:** `node <scratchpad>/migrate_test.cjs` hoặc `npx dotenv -e .env.test -- prisma migrate deploy` (chỉ khi URL là localhost:5433). `npx prisma generate`.
- [ ] **Step 4: Test (RED → GREEN)** `al-migration-backfill.test.ts`:
  - Dựng 2 user + HS + ca có `place_id NULL`.
  - Chạy lại đúng đoạn SQL backfill (đọc từ file migration, tách phần sau dấu mốc `-- BACKFILL` bằng `db.$executeRawUnsafe` từng câu).
  - Kỳ vọng:
    - mỗi user 1 nơi `per_student`
    - mọi HS/ca có `placeId`
    - chạy lần 2 không thêm dòng
    - `report.dashboard` + `report.monthlySummary` trước = sau
- [ ] **Step 5: Commit** `[AL] Bảng nơi dạy và backfill Lớp tại nhà`

---

### Task 2: `resolvePlaceBilling` + cắm vào tính học phí

**Files:**
- Modify: `src/server/services/billing.service.ts` (nơi có `loadBillingChanges` / `resolveBilling`; nếu ở file khác thì theo code thật, ghi Ruling)
- Modify: `tuition.service.ts`, `report.service.ts`, `attendance.service.ts`, `tuition-notice.service.ts`, `tuition-paylink.service.ts`, `backup.service.ts` (chỉ nơi cần)
- Test: `tests/unit/server/place-billing.test.ts` (mới) + integration `tests/integration/al-place-billing.test.ts` (mới)

**Produces:**
- `resolvePlaceBilling(changes: {fromKey:number; billing:string}[], key:number): "per_student" | "per_session"`
- `loadPlaceBilling(db, studentIds) → Map<studentId, {fromKey,billing}[]>`, theo `Student.placeId`. `null` thì dùng nơi `per_student` mặc định của user.
- Quy ước: **phí tháng của HS = 0 khi `resolvePlaceBilling(..., key) = per_session`**.
  - Cắm 1 lần trong hàm tính phí tháng chung (vd `monthFee` / `sumRevenue`), để mọi service gọi qua đó tự đúng.
  - Nếu không có điểm chung thì sửa từng nơi và liệt kê trong Ruling.

- [ ] **Step 1: Unit RED** `resolvePlaceBilling`: không dòng → per_student; [0:per_student, 24321:per_session] với key 24320 → per_student, key 24321 → per_session.
- [ ] **Step 2: Integration RED** (`al-place-billing.test.ts`), tạo nơi Trung tâm `per_session` + HS thuộc đó có `tuitionFee` 200k + ca có mặt tháng này:
  1. `tuition.list` tháng này không có HS đó; `report.dashboard` doanh thu/dự kiến = 0.
  2. HS ở nơi home có nợ tháng trước 200k → đổi `placeId` sang trung tâm → `tuition.list` tháng này **vẫn có** HS (ngoại lệ còn nợ), `totalUnpaidMonth` = 200k **[RF 1]**.
  3. Nơi home đổi sang `per_session` từ tháng này → tháng trước `report.monthlySummary` giữ số cũ.
  4. Snapshot `MonthlyTuition` tháng trước đã có → sau đổi nơi học, dòng snapshot không đổi **[RF 5]**.
- [ ] **Step 3: Code** cho GREEN. **Step 4:** chạy toàn bộ `tests/integration/*tuition* *report* *payment* *attendance* group-b-financial` → PASS.
- [ ] **Step 5: Commit** `[AL] Học phí bằng 0 cho học sinh ở nơi tính theo ca giờ`

---

### Task 3: Router `place` + trang Nơi dạy

**Files:**
- Create: `src/server/services/place.service.ts`, `src/server/trpc/routers/place.ts` (đăng ký vào app router như `subject`)
- Create: `src/app/(app)/places/page.tsx`, `src/components/places/PlaceList.tsx`, `PlaceFormDialog.tsx`
- Modify: `src/components/layout/nav-items.ts` (MANAGE_ITEMS + MORE_ITEMS thêm `/places`, icon `MapPin`), vi/en
- Test: `tests/integration/place-router.test.ts`, `tests/unit/components/PlaceFormDialog.test.tsx`

**Produces (router `place`):**
- `list() → PlaceDTO[]` với `{ id, name, kind, color, billing (tháng hiện tại), sortOrder, activeStudents, futureSessions }`
- `summary() → { count, hasPerStudent, hasPerSession }`
- `create({ name, kind, color, billing })`
- `update({ id, name?, kind?, color?, billing? })`: billing đổi thì upsert `PlaceBillingChange{fromKey: tháng hiện tại}`. Nơi mới tạo (chưa có HS/ca) thì ghi `fromKey 0`.
- `delete({ id })`
- `setupInitial({ home: boolean, tutor: boolean, centers: string[] })` (Task 6 dùng)

**Lỗi:**
- trùng tên → CONFLICT
- xoá nơi cuối → BAD_REQUEST `place_last`
- còn HS đang học / ca từ hôm nay → BAD_REQUEST `place_in_use`
- nơi của user khác → NOT_FOUND

- [ ] **Step 1: Integration RED:**
  - CRUD
  - trùng tên
  - đổi billing ghi fromKey đúng
  - xoá bị chặn 2 trường hợp **[RF 4]**
  - summary 3 trường hợp
  - user B không sửa được nơi của A
- [ ] **Step 2:** service + router → GREEN.
- [ ] **Step 3: UI** theo mẫu 07a + `SubjectList`/`SubjectFormDialog`. Unit test form:
  - đổi Loại sang Trung tâm thì cách tính tự chuyển "Theo ca/giờ"
  - sửa nơi có dữ liệu thì hiện cảnh báo "Áp dụng từ tháng …"
- [ ] **Step 4:** ảnh 375/1280 trang Nơi dạy + form, tự xem.
- [ ] **Step 5: Commit** `[AL] Trang Nơi dạy`

---

### Task 4: HS + ca gắn nơi

**Files:**
- Modify: `src/server/trpc/routers/student.ts`, `student.service.ts` (input `placeId?`, kiểm nơi thuộc user, mặc định nơi `per_student` đầu)
- Modify: `session.ts` router + `session.service.ts`, `session-copy.service.ts` (giữ `placeId` khi lặp/chép)
- Modify: `StudentFormDialog.tsx`, `StudentList.tsx` (Bộ lọc Nơi học, "—" học phí), `SessionFormDialog` (tìm tên thật), lịch (`CalendarToolbar` / FilterBar Lịch: Bộ lọc Nơi dạy), thẻ ca (chấm màu + tên nơi khi ≥ 2 nơi), chi tiết ca
- Create hook: `src/hooks/usePlaceSummary.ts` (gọi `place.summary` + `place.list`, cache React Query)
- Test: integration student/session có `placeId`; unit form HS 2 trạng thái; unit form ca

- [ ] **Step 1: RED:**
  - (a) Tạo HS không truyền `placeId` → gán nơi mặc định.
  - (b) Truyền `placeId` của user khác → NOT_FOUND.
  - (c) Form HS: user 1 nơi không thấy ô Nơi học. 2 nơi thấy. Chọn nơi `per_session` thì khối học phí ẩn và gửi phí 0.
  - (d) Tạo ca không truyền `placeId` → lấy nơi học của HS đầu.
  - (e) Chép lịch tháng giữ `placeId`.
  - (f) Lịch lọc theo nơi.
- [ ] **Step 2:** code → GREEN. Chạy test student/session/calendar/copy hiện có → PASS.
- [ ] **Step 3:** ảnh form HS (2 trạng thái), form ca, lịch có chấm nơi, tự xem.
- [ ] **Step 4: Commit** `[AL] Học sinh và ca dạy gắn nơi dạy`

---

### Task 5: Ẩn/hiện theo nơi + Học phí lọc nơi + trang phụ huynh

**Files:**
- Modify: `nav-items.ts` (thêm `requires?: "perStudent" | "perSession"` cho Học phí, Báo cáo), `AppSidebar.tsx`, `BottomTabBar.tsx`, `MoreSheet.tsx` (lọc theo `usePlaceSummary`)
- Modify: `dashboard/page.tsx` (ẩn 5 ô tiền khi `!hasPerStudent`), `DashboardAlerts.tsx` (ẩn nhóm nợ), `PayosBell` chỗ render header (ẩn), `StartCard.tsx` (bỏ bước payment/bank khi `!hasPerStudent`)
- Modify: `tuition/page.tsx`, `reports/page.tsx` (trang trống + nút khi `!hasPerStudent`; Học phí thêm Bộ lọc Nơi học + nhãn nơi)
- Modify: `parent-link.service.ts` `getParentView` + `ParentView.tsx` (ẩn khối học phí khi HS `per_session` tháng đó; tên nơi mỗi buổi khi ≥ 2 nơi; chữ chia sẻ mới)
- Test: unit nav (3 trường hợp), dashboard, StartCard; integration parent view; e2e

- [ ] **Step 1: RED:**
  - User chỉ center: không có tab Học phí/Báo cáo (sidebar + tab bar + Thêm), Tổng quan không có ô "Còn nợ", `/tuition` có nút "Mở Nơi dạy" **[RF 2]**.
  - User cũ 1 nơi home: giống hệt hiện nay (snapshot test nav).
  - Parent view HS `per_session`: không có `notice`/`payBlock` trong DTO.
- [ ] **Step 2:** code → GREEN.
- [ ] **Step 3:** ảnh Tổng quan hỗn hợp (04) + chỉ trung tâm (04b), Học phí lọc nơi (14), trang PH (11), tự xem.
- [ ] **Step 4: Commit** `[AL] Ẩn phần học phí khi không có nơi tính theo học sinh`

---

### Task 6: Popup đăng ký chọn nơi dạy + gói; gói chung mới

**Files:**
- Create: `src/components/onboarding/PlaceSetupDialog.tsx` (2 bước), mount ở layout `(app)` trước WhatsNew/TourRunner. Tìm chỗ mount WhatsNew để đặt cùng chỗ, ưu tiên cao hơn.
- Modify: `place.service.ts` `setupInitial` (transaction, có nơi rồi thì trả về danh sách hiện có, không tạo) **[RF 3]**
- Modify: `src/lib/plans.ts` (`STUDENT_LIMITS` 20/50, `DEFAULT_MONTH_PRICES` 39000/69000, `PLAN_FEATURES` thêm `places`), `src/components/plan/feature-labels.ts`, `PlanCompare.tsx` (nhãn "MỚI" 30 ngày từ hằng số `NEW_BADGE_UNTIL`; popup đăng ký truyền `hideNewBadges`)
- Modify: WhatsNew / TourRunner: không mở khi PlaceSetupDialog đang mở (dùng điều kiện "chưa có nơi").
- Test: unit dialog; integration `setupInitial`; unit plans; e2e đăng ký

- [ ] **Step 1: RED:**
  - (a) Dialog bước 1: tick Trung tâm hiện ô tên, thêm được 2 tên; Tiếp tục gọi `setupInitial` đúng payload; không tick → `{home:true}`.
  - (b) Bước 2: nút "Bắt đầu miễn phí" đóng; không có nhãn "MỚI".
  - (c) `setupInitial` gọi 2 lần song song → số nơi không đổi lần 2 **[RF 3]**.
  - (d) `STUDENT_LIMITS.standard === 20`; tạo HS thứ 21 ở Standard bị chặn.
  - (e) User đã có nơi (TK cũ) → dialog không mount.
  - (f) Admin không thấy dialog.
- [ ] **Step 2:** code → GREEN.
- [ ] **Step 3: e2e** `tests/e2e/al-dang-ky-noi-day.spec.ts`: đăng ký TK mới → popup → tick Trung tâm, nhập "TT Ánh Dương" → Tiếp tục → "Bắt đầu miễn phí" → không có tab Học phí → vào Nơi dạy thêm "Lớp tại nhà" → tab Học phí hiện.
- [ ] **Step 4:** ảnh 01, 02, 06a (có nhãn MỚI), tự xem.
- [ ] **Step 5: Commit** `[AL] Popup chọn nơi dạy và gói khi đăng ký, giới hạn 20 và 50`

---

### Task 7: Phát hành 0.20.0

- [ ] **Step 1:** version 0.20.0. Mục "Có gì mới" theo cách các bản trước:
  - Nơi dạy (lớp tại nhà, gia sư, trung tâm)
  - HS ở trung tâm không tính học phí
  - Standard 20 HS, Plus 50 HS
- [ ] **Step 2:** sao lưu Excel thêm cột "Nơi học" (`backup.service.ts`) + test backup cập nhật.
- [ ] **Step 3:** full vitest PASS; full e2e 2 nửa PASS; guide-shots các màn đổi + `pnpm guide:docx` (ghi Ruling nếu bỏ).
- [ ] **Step 4: Commit** `[AL] Phát hành 0.20.0`
- [ ] **Step 5:** báo cáo `.superpowers/claude-otd/bao-cao-AL.md` (test, ảnh, Ruling, câu hỏi). Ghi `DONE AL` lên kênh. **Không merge, không push.**
