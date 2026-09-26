# H — Thêm cấp 3 (THPT, lớp 10–12)

> Phần H, làm sau A3. Không phụ thuộc phần nào khác; chỉ đụng chỗ đang giới hạn lớp 1–9 và chỗ chỉ có 2 cấp học.

## 1. Bối cảnh

App hiện chỉ nhận lớp 1–9 và chia 2 cấp: Tiểu học (≤5), THCS (6–9). Giáo viên bắt đầu dạy cả học sinh cấp 3, nhưng:

1. Không tạo / sửa / nhập Excel được HS lớp 10–12 (zod `max(9)` ở mọi schema có `grade`).
2. Lên lớp hằng năm (`upgradeAllClasses`) cho HS lớp 9 nghỉ luôn (`isActive = false`), không lên lớp 10.
3. Nếu chỉ nới zod mà không sửa hiển thị, HS lớp 10–12 sẽ bị gắn nhãn sai: `getLevel` trả `"thcs"` cho mọi lớp > 5; `StudentList` hiện nhãn "THCS" cho mọi HS không phải tiểu học.

DB không cần đổi: `students.grade` và `session_students.grade` đều là `SMALLINT NOT NULL`, không có `CHECK` (đã kiểm `prisma/migrations/20260428162718_init` và `20260523111901_add_class_upgrade_log_and_session_student_grade`, grep `CHECK` trong `prisma/migrations` không có kết quả nào).

## 2. Mục tiêu và tiêu chí hoàn thành

- Tạo, sửa, lọc, nhập Excel được HS lớp 1–12. Lớp 13 trở lên hoặc 0 bị từ chối như hiện nay.
- Lớp 10–12 hiện là cấp **THPT**: nhãn ở danh sách học sinh, màu viền thẻ ca ở lịch tháng (desktop), có chú thích màu.
- Lên lớp hằng năm: lớp 1–11 tăng 1 lớp (lớp 9 thành lớp 10); chỉ HS lớp ≥ 12 bị cho nghỉ.
- Ca có HS thuộc nhiều cấp vẫn hiện "Hỗn hợp".
- `pnpm lint`, `pnpm test`, `pnpm exec playwright test`, `pnpm exec next build` sạch; test `theme-legacy-colors` vẫn pass.

## 3. Quyết định đã chốt

| # | Câu hỏi | Chốt |
|---|---|---|
| Q1 | Phạm vi lớp | Lớp 1–12. Thêm cấp `"thpt"` cho lớp 10–12. |
| Q2 | Lên lớp hằng năm | Lớp 9 lên lớp 10 bình thường. Chỉ HS lớp 12 (và dữ liệu lỗi > 12) bị cho nghỉ. |
| Q3 | Migration | Không cần (DB không ràng buộc giá trị `grade`). |

## 4. Phạm vi

### Trong phạm vi
- Nới giới hạn lớp ở zod + hằng `GRADES`.
- Thêm cấp `thpt` vào `getLevel`, `SchoolLevel`, `deriveLevel`, `withLevel`.
- Sửa `upgradeAllClasses` và các chuỗi giải thích lên lớp.
- Nhãn + màu cấp THPT: `StudentList`, `SessionCard`, `globals.css`, chú thích `MonthCalendar`.
- i18n vi/en, sửa test đang assert 1–9, thêm test mới.
- Sửa 1 dòng `docs/CLAUDE.md` ("Học sinh lớp 1–9" thành "lớp 1–12").

### Ngoài phạm vi (YAGNI)
- Lọc theo cấp học (chỉ có lọc theo lớp, giữ nguyên).
- Tự bật lại HS đã bị cho nghỉ ở lớp 9 các năm trước (xem mục 7).
- Thêm hex `thpt` vào `COLORS` trong `src/lib/constants.ts`: `COLORS.tieuHoc` / `COLORS.thcs` hiện không được dùng ở đâu (chỉ `useExcelExport.ts` dùng `primary/present/absent/late/pending`), thêm nữa là thừa.
- Sửa các doc cũ (`docs/01-overview.md`, `02-database.md`, `04-frontend.md`, spec E/G) có nhắc 1–9: là tài liệu lịch sử, không sửa.
- `ParentView`: chỉ hiện `Lớp {grade}` dạng số, không có nhãn cấp → không đổi. `parent-link.service.ts` chỉ trả `fullName, grade` → không đổi.
- `prisma/seed.ts`: không tạo học sinh, không có `grade` → không đổi.
- `backup.service.ts`: chỉ xuất số lớp → không đổi.

## 5. Giao diện

### 5.1 Ô chọn / lọc lớp
Tất cả lấy từ `GRADES` trong `src/lib/constants.ts`. Đổi thành `[1, 2, ..., 12]` là đủ, không sửa từng component:

| Nơi | File |
|---|---|
| Form thêm/sửa HS | `src/components/students/StudentFormDialog.tsx` (Select `#grade`) |
| Lọc lớp danh sách HS | `src/components/students/StudentList.tsx` |
| Lọc lớp lịch | `src/components/calendar/CalendarToolbar.tsx` |
| Lọc lớp khi chọn HS cho ca | `src/components/sessions/StudentPicker.tsx` |
| Lọc lớp học phí | `src/app/(app)/tuition/page.tsx` |
| Lọc lớp báo cáo | `src/app/(app)/reports/page.tsx` |

Ô lọc giữ `?grade=` trên URL qua `useFilters` (`parseInt`, không giới hạn) → không đổi.

### 5.2 Màu cấp THPT: amber

| Cấp | Viền thẻ ca | Nền thẻ ca | Nhãn (badge) |
|---|---|---|---|
| Tiểu học (có sẵn) | `border-blue-500` | `bg-blue-50` | `border-blue-200 bg-blue-50 text-blue-700` |
| THCS (có sẵn) | `border-emerald-500` | `bg-emerald-50` | `border-emerald-200 bg-emerald-50 text-emerald-700` |
| **THPT (MỚI)** | `border-amber-600` | `bg-amber-50` | `border-amber-200 bg-amber-50 text-amber-800` |

Lý do chọn amber:
- Khác hẳn tông màu nhấn teal `#0F766E` và emerald (THCS), cũng khác blue (Tiểu học) và đỏ (ca đã hủy `border-red-300 bg-red-50`). Sky bị loại vì quá gần blue của Tiểu học.
- Không phải indigo/violet/purple → `tests/unit/theme-legacy-colors.test.ts` vẫn pass.
- Tương phản (WCAG, tính theo độ sáng tương đối): chữ `amber-800 #92400E` trên `amber-50 #FFFBEB` ≈ 6.8:1 (đạt AA cho chữ nhỏ). Viền `amber-600 #D97706` trên nền trắng ≈ 3.2:1 (đạt 3:1 cho thành phần đồ họa); `amber-500` chỉ ≈ 2.2:1 nên không dùng. Chữ trong thẻ ca vẫn `text-slate-900/700` trên `amber-50`, không đổi.
- Amber trùng tông với trạng thái "Muộn" (`COLORS.late #F59E0B`) nhưng hai thứ không xuất hiện cùng chỗ (Muộn nằm ở bảng điểm danh / Excel, không ở thẻ ca lịch).

### 5.3 Chỗ sửa hiển thị

- `src/app/globals.css`: thêm `.session-card--thpt { @apply border-amber-600 bg-amber-50; }` cạnh `.session-card--thcs`.
- `src/components/calendar/SessionCard.tsx`: thêm `level === "thpt" && "session-card--thpt"`. Nếu thiếu, thẻ ca THPT sẽ không có màu viền (không báo lỗi gì).
- `src/components/calendar/MonthCalendar.tsx` (chú thích desktop): thêm `<LegendItem className="border-amber-600 bg-amber-50" label={t("high_school")} />` sau THCS, trước "Hỗn hợp"; sửa ghi chú dòng 117 thành `session-card--tieu-hoc/thcs/thpt`.
- `src/components/students/StudentList.tsx` `levelBadge`: đổi từ 2 nhánh (`tieu_hoc ? ... : THCS`) sang 3 nhánh theo `s.level`. Đây là bẫy chính: giữ nhánh `else` thì HS lớp 10–12 hiện nhãn "THCS".
- Danh sách ca mobile (`SessionListItem`) dùng sọc màu môn, không có màu cấp → không đổi.

### 5.4 Dialog lên lớp (`UpgradeAllClassesButton`)
Không đổi component, chỉ đổi chuỗi `upgrade_all_confirm_body` và `upgrade_all_success` (mục 8).

## 6. Backend

### 6.1 Zod: `max(9)` thành `max(12)`
| File | Chỗ |
|---|---|
| `src/lib/schemas/student.ts` | `studentCreateSchema.grade` (kéo theo `studentUpdateSchema`, `studentImportSchema`, và bước kiểm từng dòng Excel trong `src/lib/student-import.ts` `parseImportRows`), `studentFilterSchema.grade` |
| `src/lib/schemas/session.ts` | bộ lọc tháng `grade` (dòng 47) |
| `src/lib/schemas/tuition.ts` | `grade` (dòng 7) |
| `src/server/trpc/routers/report.ts` | input `grade` (dòng 27) |

`studentImportCheckSchema` chỉ có `z.number().int()` → không đổi. `parseGrade` trong `student-import.ts` đã nhận 1–2 chữ số (`"Lớp 12"`, `12`) → không đổi.

### 6.2 Cấp học
- `src/lib/types/models.ts`: `SchoolLevel = "tieu_hoc" | "thcs" | "thpt"`.
- `src/lib/utils.ts` `getLevel(grade): SchoolLevel`: `≤5` tieu_hoc, `≤9` thcs, còn lại thpt. Sửa ghi chú dòng 8. Import kiểu từ `models.ts` là `import type`, không tạo vòng phụ thuộc lúc chạy.
- `src/server/services/session.service.ts` `deriveLevel`: kiểu trả `SchoolLevel | "mixed"`; thêm `if (levels.every(l => l === "thpt")) return "thpt"`. Ca rỗng vẫn trả `"tieu_hoc"` như cũ.
- `src/server/services/student.service.ts` `withLevel`: kiểu trả `T & { level: SchoolLevel }`.
- `attendance.service.ts`, `report.service.ts` gọi `getLevel` → tự đúng, không sửa.

### 6.3 `upgradeAllClasses` (`student.service.ts` ~dòng 298–310)
- HS ra trường: `grade: { gte: 12 }` (thay `gte: 9`). Sửa ghi chú: "grade >= 12, gồm cả dữ liệu lỗi grade > 12; lấy TRƯỚC khi tăng lớp để không bắt nhầm HS lớp 11 vừa lên 12".
- Tăng lớp: `grade: { gte: 1, lte: 11 }` (thay `lte: 8`).
- Giữ nguyên: chạy trong transaction, log `ClassUpgradeLog`, chống chạy 2 lần/năm, tự chạy từ ngày 1/7 qua `auth.me`.

## 7. Dữ liệu cũ, migration

Không migration. Kiểm trước khi code: `grep -ri check prisma/migrations` không có ràng buộc nào trên `grade`.

Tác động lên dữ liệu có sẵn:
- **HS đã bị cho nghỉ ở lớp 9 các năm trước (kể cả đợt 1/7/2026) vẫn là "Đã nghỉ", `grade = 9`. Không tự bật lại.** Nếu giáo viên còn dạy em nào, vào sửa HS: chọn lớp 10 và bật "Đang học". Lần lên lớp sau các em sẽ được tăng lớp bình thường.
- HS bị bật lại mà quên đổi lớp (còn lớp 9) sẽ lên lớp 10 ở đợt 1/7 kế tiếp, không bị cho nghỉ nữa.
- `session_students.grade` (lớp lúc học) của các buổi cũ giữ nguyên; lọc báo cáo theo lớp 9 vẫn ra đúng buổi cũ.
- Dữ liệu lỗi `grade` 10–12 đang `isActive = true` (nếu có, chèn tay vào DB) từ nay hiện là THPT và được tăng lớp thay vì cho nghỉ. Kiểm trên prod trước khi deploy (chỉ đọc): `SELECT grade, is_active, count(*) FROM students WHERE grade > 9 GROUP BY 1, 2;` — kỳ vọng 0 dòng.

## 8. i18n

Sửa / thêm ở cả `vi.json` và `en.json` (số key 2 file bằng nhau). Chuỗi mới không dùng dấu gạch dài.

| Key | vi | en |
|---|---|---|
| `high_school` (MỚI) | THPT | High school |
| `secondary_school` (sửa en) | THCS (giữ) | Middle school (thay "Secondary", tránh nhầm với High school) |
| `upgrade_all_confirm_body` | Tất cả học sinh lớp 1 đến 11 sẽ tăng 1 lớp. Học sinh lớp 12 sẽ chuyển sang trạng thái Đã nghỉ. Hành động này chỉ chạy 1 lần / năm và không thể hoàn tác. | All students in grades 1 to 11 will move up by 1 grade. Grade 12 students will be marked Inactive. This action runs only once per year and cannot be undone. |
| `upgrade_all_success` | Đã nâng lớp {upgraded} học sinh, {deactivated} học sinh lớp 12 chuyển sang Đã nghỉ. | Upgraded {upgraded} students; {deactivated} grade-12 students set to Inactive. |
| `import_err_grade` | Lớp phải là số từ 1 đến 12 | Grade must be a number from 1 to 12 |

## 9. Kiểm thử

### Unit
- `tests/unit/utils/utils.test.ts`: thêm "lớp 10–12 → thpt" (`getLevel(10)`, `getLevel(12)`); giữ `getLevel(9) === "thcs"`.
- `tests/unit/schemas/student.schema.test.ts`: đổi "reject grade = 10" thành "nhận grade = 10 và 12" + "reject grade = 13".
- `tests/unit/lib/student-import.test.ts`:
  - "lớp 10, lớp 5.5, lớp rỗng → lỗi grade": đổi 10 thành 13 (tên test theo).
  - "nhiều lỗi 1 dòng": đổi `12` thành `13` (12 nay hợp lệ, test sẽ fail).
  - Thêm: `12` và `"Lớp 10"` → không lỗi, `grade` đúng.
  - `buildPreview` / `toImportPayload` dùng `parsed(4, "Lê Chi", 12, ["grade"])` truyền lỗi sẵn nên vẫn pass; đổi 12 thành 13 cho khỏi gây hiểu nhầm.
- `tests/unit/theme-legacy-colors.test.ts`: không sửa, phải pass.

### Integration
- `tests/integration/student.test.ts`: create grade=11 → `level = "thpt"`; create grade=13 → lỗi `BAD_REQUEST`.
- `tests/integration/student-upgrade.test.ts`:
  - "upgrades grade 1-8": thêm HS lớp 9 → 10 và lớp 11 → 12; đổi tên thành "1-11"; `upgradedCount` theo số HS.
  - "deactivates grade-9 ...": đổi thành lớp 12, giữ `grade = 12`, `isActive = false`.
  - Thêm: lớp 9 KHÔNG bị cho nghỉ, lên lớp 10, vẫn `isActive = true`.
  - "grade > 9": đổi thành ghost `grade = 13` chèn thẳng DB; sửa ghi chú "zod max 12".
  - "creates ClassUpgradeLog ... correct counts": `BB` đang lớp 9 nay sẽ được tăng lớp → đổi `BB` thành lớp 12 để giữ `upgradedCount = 1`, `deactivatedCount = 1`.
- `tests/integration/session.test.ts`: ca chỉ có HS lớp 10 → `level = "thpt"` trong `session.getMonth`; ca HS lớp 9 + lớp 10 → `"mixed"`.
- `tests/integration/student-import.test.ts`: `importMany` 1 dòng lớp 12 → tạo thành công.
- `tests/integration/report.test.ts` hoặc `tuition.test.ts`: lọc `grade: 12` không lỗi validation.
- `tests/integration/active-student-consistency.test.ts` dùng lớp 9 cho HS đã nghỉ: vẫn hợp lệ, không sửa.

### E2E (390×844)
- `tests/e2e/students-import.spec.ts`: dòng lỗi đổi `12` thành `13`; chờ chữ "Lớp phải là số từ 1 đến 12". Tóm tắt vẫn "2 hợp lệ · 0 trùng · 1 lỗi".
- `tests/e2e/students.spec.ts`: thêm ca "thêm HS lớp 12": chọn `getByRole('option', { name: 'Lớp 12', exact: true })`, thấy nhãn "THPT" ở thẻ/hàng HS, rồi xóa HS đó (không để rác).
- `tests/e2e/upgrade-class.spec.ts`: regex hiện tại vẫn khớp chuỗi mới, không sửa.

## 10. Rủi ro

| Rủi ro | Xử lý |
|---|---|
| Sót chỗ so sánh cấp 2 nhánh → HS cấp 3 hiện nhãn/màu THCS hoặc không màu | TypeScript bắt được chỗ dùng union `SchoolLevel` sai kiểu, nhưng không bắt được nhánh `else` (`StudentList`) hay thiếu `&&` (`SessionCard`); đã liệt kê cả 2 ở mục 5.3, có e2e kiểm nhãn THPT |
| E2E chọn ô lớp theo tên: `getByRole('option', { name: 'Lớp 1' })` khớp cả "Lớp 10/11/12" (so khớp chuỗi con) → lỗi strict mode | Test hiện có chỉ dùng "Lớp 5" nên không vỡ; test mới dùng `exact: true` |
| Giáo viên tưởng HS lớp 9 năm trước sẽ tự quay lại | Nêu trong báo cáo khi bàn giao; sửa tay từng em (mục 7) |
| Deploy sau 1/7 năm nay: đợt lên lớp 2026 đã chạy theo luật cũ | Đợt đó đã khóa bằng `ClassUpgradeLog`, không chạy lại; luật mới áp từ đợt 1/7/2027 |
| Danh sách 12 lớp dài trên mobile | Select của shadcn cuộn được; không đổi UI |
