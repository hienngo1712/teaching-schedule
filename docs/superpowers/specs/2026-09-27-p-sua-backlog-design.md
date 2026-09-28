# P — Sửa backlog (11 mục: nợ HS đã nghỉ, hydration #418, màu Excel, màu ca huỷ, lên lớp và ca tương lai, giờ VN, đơn gói hết hạn, lỗi nhỏ J/L/M/N, màn Tài khoản admin, nút Xuất Excel chỉ icon, nút Thêm học sinh dạng split)

> Phần P. Làm trước K và O (thứ tự người dùng chốt: P → K → O). Người dùng đã chốt cách xử lý P1, P5, P7 và yêu cầu P9, P10, P11 ngày 2026-09-27 (mục 13). Chỉ sửa lỗi, không thêm tính năng mới ngoài P7 (trạng thái "Hết hạn"), P9 (menu Hành động + phân trang), P10–P11 (gọn nút ở màn Lịch và màn Học sinh). **Không** migration. Lỗi server trả tiếng Anh: **để sau** (không thuộc P). Version `0.4.0` → `0.4.1` (patch, không ép đăng nhập lại vì epoch chỉ so `major.minor`, xem `src/lib/session-policy.ts`).

## 1. Bối cảnh chung (đã đọc code, `main` = `86b37ff`, v0.4.0)

- Ngày ca: `TeachingSession.sessionDate` là `@db.Date` lưu `Date.UTC(y, m-1, d)`; giờ `startTime`/`endTime` là `@db.Time(0)` lưu **giờ tường VN trong thành phần UTC** (`parseTimeToDate` trong `src/lib/utils.ts`). "Hôm nay VN" có sẵn `vnDateParts()` (`src/lib/utils.ts`) = `now + 7h` rồi đọc `getUTC*`.
- Tailwind **3.4** (`@tailwind base/components/utilities` đầu `src/app/globals.css`), không phải 4 như `docs/CLAUDE.md` ghi.
- `docs/12-pagination.md` được nhắc trong yêu cầu **không tồn tại**. Quy ước phân trang thật nằm ở `docs/coding-rule.md` §4 và code: `DataTablePagination` (`src/components/ui/data-table-pagination.tsx`, ghim `fixed` đáy, mobile nằm trên tab bar 56px) + hook client `usePagination` (`src/hooks/usePagination.ts`); màn Học sinh/Học phí dùng phân trang server, cỡ trang mặc định `20`.
- Cơ chế cache client: `TRPCProvider` có `MutationCache.onSuccess → invalidateQueries()` (mọi mutation thành công làm mới toàn bộ query), `staleTime` 60s.
- Tài khoản seed DB test: `teacher`, `teacher2`, `teacher_std`, `admin_test` (mật khẩu `teacher123`).

## 2. Mục tiêu và tiêu chí hoàn thành

- P1: HS đã nghỉ còn nợ hiện trong nhóm "Còn nợ tháng trước" ở Tổng quan, có nhãn xám "Đã nghỉ"; bấm vào vẫn mở đúng HS ở màn Học phí.
- P2: Trang `/students` (và mọi trang có sidebar) trên bản build production không còn React error #418; chuỗi giờ build ở sidebar giống hệt nhau giữa HTML server và bundle client.
- P3: Không còn mã hex indigo/violet/purple của màu nhấn cũ trong hằng số giao diện/Excel; `tests/unit/theme-legacy-colors.test.ts` bắt được hex (trừ bảng màu môn học người dùng chọn).
- P4: Ca đã huỷ luôn nền đỏ nhạt + viền đỏ, bất kể cấp học.
- P5: Tự lên lớp (`upgradeAllClasses`, tay hoặc tự chạy khi đăng nhập từ tháng 7) cập nhật khối đã ghi trong các ca **chưa kết thúc** theo khối mới, gỡ HS lớp 12 bị cho nghỉ khỏi các ca đó; ca đã kết thúc giữ nguyên; tất cả trong 1 transaction.
- P6: Xoá HS và đổi khối HS so "đã kết thúc hay chưa" theo giờ VN (hết lệch 7 giờ).
- P7: Đơn mua gói chờ chuyển khoản quá 7 ngày chưa duyệt → trạng thái "Hết hạn"; không còn hiện QR; admin không duyệt được; hiện "Hết hạn" ở `/plan` và `/admin/history`.
- P8: Sửa hết lỗi nhỏ từ review J/L/M/N liệt kê ở mục 3.8.
- P9: Màn `/admin/accounts` gọn: cột "Hành động" 1 nút mở menu, cột không xuống dòng, có phân trang.
- P10: Màn Lịch: nút Xuất Excel chỉ còn icon (có tên truy cập + tooltip "Xuất Excel"), vuông ≥44px mobile, cao bằng nút cạnh bên ở desktop; hàng nút mobile cân đối.
- P11: Màn Học sinh: không còn nút rời "Nhập Excel"; "Thêm học sinh" là split button, mũi tên mở menu có đúng 1 mục chữ "Nhập Excel" (giữ khóa gói Pro).
- `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm exec playwright test`, `pnpm exec next build` (DB test) sạch.

## 3. Từng lỗi: nguyên nhân (tái hiện bằng đọc code), cách sửa, test đỏ trước

### 3.1 P1 — Nợ của HS đã nghỉ không hiện ở Tổng quan

**Nguyên nhân (2 lớp lọc, không phải 1):**
1. `getDashboardAlerts` (`src/server/services/report.service.ts`) lấy `activeStudents` rồi lọc `activeIds.has(it.studentId)` → HS `isActive = false` bị loại dù có mặt trong danh sách học phí (đúng spec D S5/R2 lúc viết).
2. Sâu hơn: danh sách học phí lấy từ `getMonthlyTuitionStatus(db, userId, { year, month, status: "all", … }, false)` (`src/server/services/tuition.service.ts`). Khi không lọc `studentId`/`grade`, truy vấn HS chỉ lấy `OR: [{ isActive: true }, { có ca trong tháng này }]`. HS đã nghỉ **từ tháng trước** không có ca tháng này → không nằm trong `tuition.items` → bỏ bộ lọc (1) thôi vẫn không hiện. Test hiện có "HS đã nghỉ (isActive=false) còn nợ và không có ca → không xuất hiện ở nhóm nào" (`tests/integration/dashboard-alerts.test.ts`) khóa đúng hành vi cũ, phải viết lại.

**Cách sửa (đổi spec D S5/R2 cho nhóm nợ; nhóm "Lâu không có ca" vẫn chỉ HS đang học):**
- `getMonthlyTuitionStatus` thêm tham số thứ 5 **tùy chọn** `onlyStudentIds?: number[]` (không đổi schema zod public `MonthlyTuitionFilterInput`, không đổi 4 tham số cũ): khi có, điều kiện HS = `{ userId, id: { in: onlyStudentIds } }` (bỏ nhánh `grade`/`OR`), phần tính carry-over giữ nguyên. Mảng rỗng → trả rỗng ngay.
- `getDashboardAlerts`:
  1. Gọi như cũ (lượt 1).
  2. `inactive = student.findMany({ where: { userId, isActive: false, id: { notIn: <id lượt 1> } }, select: { id } })`; có thì gọi lượt 2 `getMonthlyTuitionStatus(..., false, inactiveIds)` (persist=false, không ghi DB).
  3. Gộp 2 lượt; bỏ bộ lọc `activeIds`; công thức nợ giữ nguyên (`previousBalance > 0 && !isFullPaid`, `amount = min(previousBalance, totalAmountDue - paidAmount)`); mỗi dòng thêm `isActive: boolean`. Sắp theo số tiền giảm dần như cũ (HS nghỉ xen kẽ, không tách nhóm).
- Kiểu `DashboardAlerts.debts[number]` thêm `isActive: boolean`.
- `DashboardAlerts.tsx`: dòng nợ có `!d.isActive` → gắn `Badge` xám `border-slate-200 bg-slate-100 text-slate-600` chữ `t("dropped")` ("Đã nghỉ") cạnh tên, `data-testid="alert-debt-inactive"`. Link `/tuition?…&studentId=` giữ nguyên (màn Học phí lọc `studentId` bỏ qua `isActive` nên mở được HS đã nghỉ).
- Mô tả nhóm `alert_debt_desc` đổi thành "Học sinh còn nợ học phí cũ, kể cả đã nghỉ" / "Students with earlier unpaid tuition, including dropped ones".
- Số tháng nợ (`countDebtMonths`, "chỉ để tham khảo") đọc snapshot đã lưu: HS nghỉ lâu không có snapshot các tháng gần → hiện "1 tháng". Chấp nhận (ghi ở Rủi ro); số tiền vẫn đúng vì tính từ lịch sử (`historicalBalance`).

**Test đỏ trước:** integration `tests/integration/dashboard-alerts.test.ts`: viết lại ca cũ thành "HS đã nghỉ còn nợ, KHÔNG có ca tháng này → có trong `debts` với `isActive: false`, số tiền = `previousBalance` ở màn Học phí (`studentId`)"; thêm "HS đã nghỉ có ca tháng này → xuất hiện đúng 1 lần"; "HS đã nghỉ không nợ → không có"; "HS đã nghỉ vẫn không vào `idleStudents`"; "không ghi DB" (đếm `monthlyTuition` trước/sau); đa người dùng (HS nghỉ của giáo viên khác không lọt). Các `toEqual` cũ thêm `isActive: true`. Unit `tests/unit/components/DashboardAlerts.test.tsx`: dòng `isActive: false` có nhãn "Đã nghỉ", dòng đang học không có.

### 3.2 P2 — React error #418 trên `/students` ở production

**Đã loại trừ (đọc code):** `/students/page.tsx` là client component bọc `StudentList`; lúc SSR mọi `useQuery` tRPC đều chưa có dữ liệu (không prefetch) → danh sách, `CurrentPlanBadge`, `PlanBanner`, `UpgradeAllClassesButton` (`new Date().getFullYear()` chỉ dùng trong `title` khi đã có log) đều render trạng thái rỗng/Skeleton giống nhau ở server và client. `LanguageProvider` khởi tạo `"vi"` rồi mới đọc `localStorage` trong `useEffect` (không lệch). `useMediaQuery` khởi tạo `false` (không lệch). Không component nào trên trang gọi `toLocale*`/`dayjs()` lúc render đầu.

**Nguyên nhân thật:** chuỗi duy nhất phụ thuộc thời gian có trong HTML SSR là giờ build ở cuối sidebar: `AppSidebar.tsx` (và `AdminSidebar.tsx`) render `{process.env.NEXT_PUBLIC_BUILD_TIME}`. Giá trị này tính bằng `new Date(Date.now() + 7h)` **ngay khi nạp** `next.config.mjs`. `next build` (Next 15.5, webpack, không có hàm `webpack` tùy biến → `experimental.webpackBuildWorker` bật mặc định) biên dịch bundle server, edge và client trong **các tiến trình worker riêng**, mỗi worker tự nạp lại `next.config.mjs` → mỗi bundle nhận 1 `buildTime` riêng. Build trên Vercel kéo dài nhiều phút nên phút trong chuỗi server (vd `27/09/2026 14:15`) khác bundle client (`14:16`) → React hydrate thấy text lệch → #418 (text content mismatch) trên **mọi** trang có sidebar desktop (sidebar ẩn bằng CSS ở mobile nhưng vẫn render). Backlog ghi `/students` vì đó là trang được mở lúc thấy lỗi. Dev (`pnpm dev`) chỉ nạp config 1 lần nên không tái hiện ở local — khớp việc chỉ thấy trên prod.

**Cách sửa:** `next.config.mjs` chốt mốc thời gian **1 lần cho cả lượt build** qua biến môi trường mà worker con thừa hưởng: `process.env.APP_BUILD_TIMESTAMP ||= String(Date.now())` rồi tính `buildTime` từ số đó. Tiến trình chính nạp config trước khi sinh worker; worker con được fork với `process.env` của cha nên đọc lại đúng mốc. Không đổi định dạng hiển thị. Không dùng `suppressHydrationWarning` (che lỗi, không sửa).

**Test đỏ trước:** unit MỚI `tests/unit/next-config-build-time.test.ts`: giả `Date` (`vi.useFakeTimers({ toFake: ["Date"] })`), nạp `next.config.mjs` lần 1, tiến đồng hồ 2 phút, `vi.resetModules()`, nạp lần 2 → `env.NEXT_PUBLIC_BUILD_TIME` hai lần phải bằng nhau (code cũ khác nhau → đỏ); biến `APP_BUILD_TIMESTAMP` đặt sẵn → dùng đúng mốc đó. Kiểm chứng thật ở task cuối: sau `next build`, mọi chuỗi giờ build trong `.next/server` và `.next/static` chỉ có **1 giá trị**.

### 3.3 P3 — Màu nhấn cũ (indigo) còn trong hằng số Excel

**Hiện trạng:** `COLORS.primary = "#4F46E5"` (`src/lib/constants.ts`) → `EXCEL_COLORS.primary` trong `src/hooks/useExcelExport.ts` tô nền tiêu đề các file Excel xuất (lịch tháng, danh sách ca, báo cáo). Ngoài ra nền hàng tiêu đề `"FFE0E7FF"` (= indigo-100) nằm ở 3 chỗ: `useExcelExport.ts` (`headerBg`), `src/lib/student-import-excel.ts` (`HEADER_BG`, file mẫu nhập HS), `src/server/services/backup.service.ts` (`HEADER_BG`, file sao lưu). `theme-legacy-colors.test.ts` chỉ quét chuỗi class `indigo-\d` nên không bắt hex.

**Cách sửa:** `COLORS.primary` → `"#0F766E"`; 3 chỗ `"FFE0E7FF"` → `"FFCCFBF1"` (teal-100, nền nhạt cùng họ màu nhấn, chữ đen trên nền này vẫn đọc tốt).

**Không đổi:** `#4F46E5`/`#7C3AED` trong bảng màu **môn học** (`src/lib/subject-colors.ts`, mặc định `src/lib/schemas/subject.ts`, `src/server/services/subject-defaults.ts`): đó là màu người dùng chọn cho môn (dữ liệu), không phải màu nhấn giao diện; đổi sẽ lệch màu môn đã lưu và các test `subject`/`backup` đang khẳng định `#4F46E5`.

**Test đỏ trước:** mở rộng `tests/unit/theme-legacy-colors.test.ts`: ca MỚI "src/ không còn hex indigo/violet/purple (trừ bảng màu môn học)" quét `src/**/*.{ts,tsx,css}` với regex không phân biệt hoa thường các hex Tailwind indigo/violet/purple thường gặp (`4F46E5|4338CA|6366F1|818CF8|A5B4FC|C7D2FE|E0E7FF|EEF2FF|7C3AED|6D28D9|8B5CF6|A78BFA|DDD6FE|EDE9FE|9333EA|A855F7|C084FC|E9D5FF|F3E8FF`), bỏ qua 3 file màu môn. Code cũ đỏ ở `constants.ts`, `useExcelExport.ts`, `student-import-excel.ts`, `backup.service.ts`.

### 3.4 P4 — Ca đã huỷ bị màu cấp học đè

**Nguyên nhân:** `SessionCard.tsx` luôn gắn `session-card--tieu-hoc|thcs|thpt` theo cấp, rồi thêm `opacity-60 border-red-300 bg-red-50` khi huỷ. `.session-card--*` trong `globals.css` nằm **ngoài `@layer`**, sau `@tailwind utilities` → cùng độ ưu tiên (1 class) thì luật đứng sau thắng: `bg-blue-50`/`border-blue-500` (…emerald/amber) đè `bg-red-50`/`border-red-300`. `cn` (tailwind-merge) không biết class tự đặt nên không gỡ được. Nhánh `mixed` dùng utility thường nên tailwind-merge đã xử lý đúng.

**Cách sửa (chọn 1 cách, đơn giản, test được bằng jsdom):** chỉ gắn class cấp khi `!isCancelled` (`!isCancelled && level === "tieu_hoc" && "session-card--tieu-hoc"`, tương tự thcs/thpt/mixed). Không bọc `@layer components` (đổi thứ tự cả khối CSS, rủi ro ảnh hưởng hover/transition mà không test được bằng jsdom).

**Test đỏ trước:** `tests/unit/components/SessionCard.test.tsx` thêm `it.each` 4 cấp × `status: "cancelled"` → `className` không chứa `session-card--` nào (với `mixed`: không chứa `bg-slate-100`), có `bg-red-50` và `border-red-300`.

### 3.5 P5 — Tự lên lớp không đụng ca tương lai

**Nguyên nhân:** `upgradeAllClasses` (`src/server/services/student.service.ts`) chỉ `student.updateMany` tăng `grade` và tắt `isActive` HS lớp ≥12; **không** động tới `SessionStudent`. Khác `updateStudent` (đồng bộ `grade` các ca chưa kết thúc) và `softDeleteStudent` (gỡ HS khỏi ca chưa kết thúc). Hệ quả: báo cáo/lọc khối các tháng sau lên lớp đọc `SessionStudent.grade` cũ; HS lớp 12 đã "nghỉ" vẫn nằm trong ca tương lai (bị đếm buổi, điểm danh).

**Cách sửa (người dùng chốt: cập nhật khối ca tương lai theo khối mới; gỡ HS lớp 12 đã nghỉ; ca đã qua không đổi; "tương lai" theo giờ VN; trong transaction):** trong **cùng** `db.$transaction` hiện có (thêm `{ timeout: 15000 }` vì có thể nhiều ca):
1. Trước khi tăng lớp: lấy `graduatingIds` (như cũ) và `upgradingIds` = HS `isActive`, `grade` 1–11.
2. Tăng lớp + tắt HS ra trường (như cũ).
3. `links = findUnfinishedLinks(tx, userId, [...upgradingIds, ...graduatingIds], now)` (mục 3.6): các `SessionStudent` của những HS này thuộc ca của chính user, `sessionDate ≥ hôm nay VN` và **chưa kết thúc theo giờ VN**.
4. Link của HS lên lớp: nhóm theo khối mới (đọc lại `student.grade` sau khi tăng, tối đa 11 nhóm) → mỗi nhóm 1 `sessionStudent.updateMany({ where: { id: { in } }, data: { grade } })`.
5. Link của HS ra trường: `sessionStudent.deleteMany({ where: { id: { in } } })`.
6. Ca đã kết thúc (kể cả ca sáng nay đã dạy xong) và HS `isActive = false` từ trước: không đụng.

**Ca không còn HS nào sau khi gỡ HS lớp 12 — đề xuất: GIỮ ca (0 HS), không xoá, không huỷ.** Lý do: (a) nhất quán với `softDeleteStudent`/`session.removeStudent` hiện có (gỡ HS, không xoá ca); (b) `upgradeAllClasses` tự chạy ngầm trong `auth.me` khi đăng nhập — xoá dữ liệu âm thầm, không hoàn tác được là rủi ro cao hơn để lại ca trống; (c) ca trống vẫn hiện trên lịch "0 HS", giáo viên thấy và tự xoá cả chuỗi bằng "Xóa các ca tương lai cùng chuỗi" (`session.deleteFuture`) hoặc thêm HS mới vào khung giờ đó; (d) không đụng ca bù/ca gốc (`makeupOfId`). Ca trống không ảnh hưởng học phí (không có `SessionStudent`).

**Test đỏ trước:** integration `tests/integration/student-upgrade.test.ts` khối MỚI "lên lớp ↔ ca tương lai (giờ VN)" với `vi.useFakeTimers({ toFake: ["Date"] })`, `now = 2099-07-15T11:00:00Z` (18:00 VN): HS lớp 5 + HS lớp 12 cùng ở ca 14/07 (đã qua), ca 15/07 16:00–17:00 (đã dạy xong), ca 15/07 19:00–20:00 (chưa dạy), ca 20/07; thêm ca 21/07 chỉ có HS lớp 12; HS lớp 8 đã nghỉ từ trước ở ca 20/07. Sau `upgradeAllClasses`: HS lớp 5 → `grade` 6 ở ca 15/07 19:00 và 20/07, vẫn 5 ở 14/07 và 15/07 16:00; HS lớp 12 bị gỡ khỏi 15/07 19:00, 20/07, 21/07, còn ở 14/07 và 15/07 16:00; ca 21/07 vẫn tồn tại, 0 HS; HS lớp 8 nghỉ giữ nguyên `grade` 8 ở ca 20/07; ca của `teacher2` không đổi. Cùng kịch bản chạy qua `auth.me` (trigger `auto`) cho cùng kết quả. Ca cũ "preserves historical grade after upgradeAllClasses" (ca 2099-02-15, chạy theo giờ thật) phải đổi kỳ vọng: ca **tương lai** giờ thành khối mới → sửa thành ca **quá khứ** giữ khối cũ (ghi rõ trong plan).

### 3.6 P6 — Xoá HS / đổi khối so giờ theo UTC (lệch 7 giờ)

**Nguyên nhân:** `softDeleteStudent` và nhánh đổi `grade` của `updateStudent` tính `todayUTC = Date.UTC(now.getUTCFullYear(), getUTCMonth(), getUTCDate())` và so `endMs = Date.UTC(ngày ca, giờ kết thúc)` với `now.getTime()`. Nhưng giờ kết thúc là **giờ tường VN** đặt vào thành phần UTC, còn `now.getTime()` là UTC thật → mốc kết thúc bị đẩy muộn 7 giờ. Ví dụ:
- 18:00 VN ngày D (= 11:00Z): ca D 16:00–17:00 đã dạy xong nhưng `endMs` = 17:00Z > 11:00Z → bị coi là chưa dạy → xoá HS gỡ mất điểm danh ca vừa dạy / đổi khối ghi đè khối lịch sử.
- 01:00 VN ngày D+1 (= 18:00Z ngày D): `todayUTC` = D nên ca tối qua (D 20:00–21:00, `endMs` 21:00Z > 18:00Z) cũng bị coi là chưa dạy.

**Cách sửa:** file MỚI `src/lib/session-time.ts` dùng lại `vnDateParts` có sẵn:
- `vnToday(now = new Date()): Date` = `Date.UTC` của ngày VN (cùng dạng `sessionDate`).
- `hasSessionEnded(session: { sessionDate: Date; endTime: Date }, now = new Date()): boolean` = `Date.UTC(ngày ca, giờ:phút:giây kết thúc) <= now.getTime() + 7h` (so giờ tường với giờ tường).
- `student.service.ts`: hàm nội bộ `findUnfinishedLinks(tx, userId, studentIds, now)` (lọc `sessionDate >= vnToday(now)` rồi `!hasSessionEnded`) dùng chung cho `updateStudent`, `softDeleteStudent`, `upgradeAllClasses` (bỏ 2 khối code lặp).

**Test đỏ trước:** unit MỚI `tests/unit/lib/session-time.test.ts` (ranh giới 17:00 VN, 00:30 VN hôm sau, đúng phút kết thúc = đã kết thúc). Integration `tests/integration/student-delete-schedule-sync.test.ts` + `student-upgrade.test.ts`: giả `Date` = 18:00 VN và 01:00 VN hôm sau như ví dụ trên → ca đã dạy xong giữ HS/giữ khối, ca chưa dạy bị gỡ/đổi khối (code cũ đỏ). 2 test cũ dựa "hôm nay UTC" + giờ 00:01/23:59 (`student-delete-schedule-sync` "giữ buổi hôm nay đã kết thúc…", `student-upgrade` "KHÔNG ghi đè grade buổi hôm nay ĐÃ kết thúc") sẽ chập chờn 00:00–07:00 VN sau khi sửa → chuyển sang giả `Date` cố định.

### 3.7 P7 — Đơn mua gói chờ chuyển khoản không bao giờ hết hạn

**Hiện trạng:** `PlanOrder.status` là `String @db.VarChar(10)` (`prisma/schema.prisma`), giá trị đang dùng `pending | approved | rejected | cancelled`. Đơn `pending` chỉ đổi trạng thái khi người dùng tạo đơn mới (`createOrder` huỷ đơn cũ), tự huỷ (`cancelOrder`), hoặc admin duyệt/từ chối. Không có cron (Vercel Hobby, không có job nền trong repo).

**Cách làm (không cron, không migration):** "hết hạn lười" — ghi trạng thái khi có người đọc:
- `src/lib/plans.ts`: `ORDER_TTL_DAYS = 7`; `orderExpiresAt(createdAt: Date): Date` = `createdAt + 7 × 24h` (mốc tuyệt đối, không làm tròn ngày VN: "quá 7 ngày" tính đúng giờ tạo).
- `src/server/services/plan.service.ts`: `expireStaleOrders(db: Db, now: Date, userId?: number): Promise<number>` = 1 câu `UPDATE plan_orders SET status = 'expired', decided_at = created_at + interval '7 days' WHERE status = 'pending' AND created_at <= now - 7 ngày [AND user_id = …]` (`$executeRaw`; `decided_at` = đúng lúc hết hạn để lịch sử hiện mốc thật, `decided_by` để `NULL`). `'expired'` 7 ký tự vừa `VarChar(10)` → **không migration**; index `status` sẵn có.
- Gọi `expireStaleOrders` ở đầu: `getMyPlan` (theo `userId`), `createOrder` (trong transaction, sau khóa advisory, trước khi huỷ đơn chờ cũ), `cancelOrder` (theo `userId`), `getAdminOverview`, `getOrderHistory`, `getPendingCount` (mới, mục P8-J5) — toàn cục.
- `approveOrder`: điều kiện chốt đơn thêm `createdAt > now − 7 ngày`. Chốt hụt → đọc đơn: vẫn `pending` mà quá hạn → `BAD_REQUEST` "Đơn đã quá 7 ngày chưa xác nhận nên đã hết hạn. Nếu khách đã chuyển khoản, hãy dùng Đặt gói"; còn lại giữ `CONFLICT` cũ. Admin đặt gói tay qua `admin.setPlan` như hiện nay.
- `rejectOrder`: không đổi (đơn quá hạn thường đã bị `expire` ở lần đọc danh sách trước đó; từ chối 1 đơn quá hạn chưa kịp expire không gây hại).
- `plan.me.pendingOrder` chỉ còn đơn chưa quá hạn (nhờ gọi expire trước) → hết QR. Thêm field `expiresAt` vào `pendingOrder` để thẻ hiện "Hết hạn lúc HH:mm dd/mm/yyyy nếu chưa được xác nhận".
- Hiển thị "Hết hạn": `STATUS_KEY` ở `src/app/(app)/plan/page.tsx` và `src/components/admin/AdminOrderHistory.tsx` thêm `expired: "plan_status_expired"`. Thẻ đơn chờ admin (`AdminPendingOrders.tsx`) thêm dòng hạn (`admin_order_expires`).

**Test đỏ trước:** unit `tests/unit/lib/plans.test.ts` (`orderExpiresAt`). Integration `tests/integration/plan-orders.test.ts` + `tests/integration/admin.test.ts`: đơn `createdAt` lùi 7 ngày + 1 phút → `plan.me` không còn `pendingOrder`, lịch sử có `status: "expired"`, `decidedAt` = `createdAt + 7d`; lùi 6 ngày 23 giờ → vẫn `pending`; `admin.approveOrder` đơn quá hạn chưa expire → `BAD_REQUEST`, user không đổi gói; `admin.overview.pendingOrders` không có đơn quá hạn; `admin.orderHistory` có đơn `expired`; `cancelOrder` đơn quá hạn → `NOT_FOUND`; tạo đơn mới khi đơn cũ đã quá hạn → đơn cũ thành `expired` (không phải `cancelled`); đơn của user khác không bị `getMyPlan` của user này expire.

### 3.8 P8 — Lỗi nhỏ từ review (trừ lỗi server tiếng Anh, để sau)

**J (popup mua gói, admin):**
- **J1 Skeleton mãi:** `PlanPurchaseDialog` sau khi tạo đơn chỉ hiện thẻ khi `me.pendingOrder?.id === createdId`, ngược lại `Skeleton`. `me` là prop; nếu lượt refetch `plan.me` (do `MutationCache` invalidate) lỗi hoặc trả đơn khác → Skeleton mãi. Sửa: dialog đọc `trpc.plan.me.useQuery()` (cùng key, dùng chung cache, `staleTime` nên không thêm request) để biết `isFetching`; giữ `created = { id, code }` từ kết quả mutation. `createdOrder` null và **không** đang fetch → khối `data-testid="purchase-load-error"`: chữ `plan_order_load_error` "Đã tạo đơn nhưng chưa tải được thông tin chuyển khoản.", dòng `{notice_transfer_content}: SM {code}` (mã đơn đã có, vẫn chuyển khoản được), nút `retry` "Thử lại" (`h-11`) gọi `refetch()`. Đang fetch → Skeleton như cũ.
- **J2 `CurrentPlanBadge`:** `aria-label` đặt trên `<span>` không có role → trình đọc màn hình bỏ qua. Sửa: khi dùng thử thêm `role="img"` cho `<span>` (giữ `aria-label`/`title` "Pro dùng thử") → trình đọc màn hình đọc đúng tên; khi không dùng thử không có role, không `aria-label` (như cũ). Không dùng thêm `sr-only`: `textContent` của nhãn sẽ đổi và làm vỡ các e2e đang so chữ "Pro".
- **J3 Phím mũi tên trong radiogroup:** 2 nhóm `role="radiogroup"` trong `PlanPurchaseDialog` là các `<button role="radio">` đều nằm trong thứ tự Tab, không đi bằng mũi tên. Sửa: file MỚI `src/lib/radio-group-keys.ts` — `handleRadioGroupKeyDown(e)` gắn vào `onKeyDown` của `div[role=radiogroup]`: ArrowRight/ArrowDown → radio kế tiếp **không disabled** (vòng), ArrowLeft/ArrowUp → trước đó, Home/End → đầu/cuối; chuyển focus và `click()` radio đó (chọn theo focus, đúng mẫu WAI-ARIA radio). Mỗi radio `tabIndex={selected ? 0 : -1}` (roving tabindex).
- **J4 Tab bar admin mobile không có số đơn chờ** và **J5 `AdminSidebar` gọi `admin.overview` ở mọi trang admin** (kể cả `/admin/history`, `/admin/prices`; `overview` tải toàn bộ user + tính `computeApproval` từng đơn chờ). Quyết định: **tối ưu** — procedure MỚI `admin.pendingCount` (`adminProcedure.query`, service `getPendingCount(db)` = `expireStaleOrders` rồi `planOrder.count({ where: { status: "pending" } })`, trả `{ count }`). `AdminSidebar` và `AdminTabBar` cùng dùng query này (chung cache, 1 request nhẹ); tab "Đơn chờ" trên mobile hiện chấm số `data-testid="admin-tab-pending-count"` góc icon (nền amber như sidebar). `MutationCache` invalidate toàn bộ nên duyệt/từ chối xong số tự cập nhật.

**L (bảng giá, dùng thử):**
- **L1** `setUserTrialDays` (`src/server/services/trial.service.ts`) không chặn tài khoản admin (UI ẩn nút nhưng gọi thẳng tRPC vẫn được). Sửa: đọc thêm `username`, `isAdminUsername(username)` → `FORBIDDEN` "Tài khoản admin không dùng gói" (cùng luật `adminResetPassword` chặn admin).
- **L2** Đặt dùng thử riêng không khóa: 2 lần đặt cùng lúc cho 1 user ghi `previousDays` sai. Sửa: đầu transaction `pg_advisory_xact_lock(${BigInt(input.userId)})` — cùng khóa theo user mà `createOrder`/`approveOrder` đang dùng cho thay đổi gói (không cần `SELECT … FOR UPDATE` thô).
- **L3** Chọn giá/số ngày dùng thử hiện hành (`latestMonthPrice` trong `plan-price.service.ts`, `getDefaultTrialDays` trong `trial.service.ts`) sắp `createdAt desc, id desc`. `createdAt` mặc định `now()` của Postgres = **giờ bắt đầu transaction**; lần lưu chờ khóa advisory có `createdAt` sớm hơn lần lưu đã commit trước nó → "hiện hành" chọn sai dòng. `id` (sequence, cấp lúc INSERT sau khi có khóa) tăng đúng thứ tự commit. Sửa: 2 truy vấn "hiện hành" sắp `orderBy: { id: "desc" }`. Danh sách lịch sử giữ sắp theo `createdAt` (khớp cột thời gian hiển thị).
- **L4** TrialDaysDialog thêm bước xác nhận riêng (spec L §15)? **Quyết định: không.** Dialog đã có xem trước hạn mới + số ngày còn lại trước khi bấm Lưu, thao tác đảo ngược được (đặt lại số ngày) và có log 5 lần gần nhất; thêm 1 hộp xác nhận là thêm 1 chạm không thêm thông tin.

**M (chép lịch tháng):**
- **M1** `previewCopyMonth` (`src/server/services/session-copy.service.ts`) cắt `plan.conflicts.slice(0, 50)` **chung** mọi mẫu → mẫu sắp sau có thể có `conflict > 0` (đếm đúng) nhưng danh sách chi tiết rỗng. Sửa: hàm thuần MỚI `capConflictsPerPattern(conflicts, max)` trong `src/lib/copy-month.ts`, service cắt **20 mỗi mẫu** (`MAX_PREVIEW_CONFLICTS_PER_PATTERN = 20`, khớp `slice(0, 20)` của `PatternRow` trong `CopyMonthDialog.tsx`); bỏ hằng 50.
- **M2** `copy_skip_past` đếm theo **ca** (mỗi ca ứng viên rơi vào ngày đã qua +1, `count.past++` trong `planMonthCopy`) nhưng chữ ghi "ngày". Sửa: vi "{count} ca rơi vào ngày đã qua, bỏ qua", en "{count} sessions on past days, skipped".

**N (đăng nhập, reset mật khẩu):**
- **N1** Vòng redirect khi ai đó sửa tay `users.must_change_password = false` mà không tăng `session_version`: cookie JWT vẫn mang `mustChangePassword: true` → middleware Edge (`authorized` trong `src/server/auth.config.ts`, không tra DB) đẩy mọi trang về `/change-password`; trang này gọi `auth()` Node (tra DB, thấy `false`) → `redirect("/dashboard")` → middleware lại đẩy về → vòng vô hạn. Sửa: `src/app/change-password/page.tsx` khi cờ DB `false` **không redirect** mà render thẻ `data-testid="password-already-changed"`: tiêu đề `password_already_changed_title` "Mật khẩu đã được cập nhật", mô tả `password_already_changed_desc` "Đăng nhập lại để tiếp tục dùng ứng dụng.", 1 nút "Đăng nhập lại" (component client MỚI `src/app/change-password/PasswordAlreadyChanged.tsx` chứa chữ + nút gọi `signOut({ callbackUrl: "/login" })`; trang là server component nên chữ i18n phải nằm ở component client). Không có nút "Về trang chủ": với cookie cũ, middleware sẽ lại đẩy về đây (không vòng nhưng vô ích); đăng nhập lại là cách duy nhất làm mới cookie.
- **N2** `ResetPasswordDialog` đóng được bằng Esc khi mutation đang chạy (Radix AlertDialog không đóng khi bấm ngoài, nhưng Esc gọi `onOpenChange(false)`) → mất mật khẩu tạm vừa sinh (không có đường xem lại). Sửa: `onOpenChange={(open) => !open && !mut.isPending && onClose()}`.

### 3.9 P9 — Màn `/admin/accounts`: cột Hành động, cân đối cột, phân trang

**Hiện trạng:** `AdminAccounts.tsx` có cột cuối là `div.flex.flex-wrap` chứa 3 nút rời (Đặt gói / Đặt dùng thử / Reset mật khẩu) → ở 1280px bảng 8 cột bị ép, nút xuống 2 dòng, tiêu đề "Tên đăng nhập", "Đăng nhập cuối", "HS đang học" gãy dòng, ô "Standard · Miễn phí" và ngày gãy dòng. Mobile: 3 nút nằm cuối thẻ. `admin.overview.users` trả **toàn bộ** tài khoản, chưa phân trang.

**Cách sửa:**
- **Menu Hành động** (theo mẫu menu hành động đã có ở `StudentList.tsx` và menu avatar `AppHeader.tsx`): cột cuối tiêu đề `admin_col_actions` "Hành động" (`w-14 text-right whitespace-nowrap`); ô chứa 1 nút `variant="ghost" size="icon"` `className="size-11 md:size-9"`, icon `MoreHorizontal`, `aria-label={`${t("actions")} ${u.username}`}` ("Menu hành động teacher_std"), `data-testid="admin-user-actions"`. Mở `DropdownMenu` (`align="end"`), item có icon lucide bên trái + chữ (`mr-2 size-4`), mỗi item `min-h-11 md:min-h-0` (vùng chạm ≥44px ở mobile): "Đặt gói" (`BadgeCheck`), "Đặt dùng thử" (`Clock`), "Reset mật khẩu" (`KeyRound`, cùng icon "Đổi mật khẩu" ở menu avatar). Tài khoản admin chỉ có "Đặt gói" (giữ luật spec L mục 15, spec N R3).
- **Mở dialog từ menu:** dùng đúng cách `StudentList.tsx` đang chạy ổn định (có e2e): `DropdownMenuItem onSelect={() => setSetPlanFor(u)}` chỉ đặt state; 3 dialog (`SetPlanDialog`, `TrialDaysDialog`, `ResetPasswordDialog`) render **ngoài** menu như hiện tại (điều kiện `setPlanFor && …`). Radix đóng menu khi chọn item rồi dialog mở ở render kế; không dùng mẫu `onSelect={(e) => e.preventDefault()}` + dialog lồng trong menu của `ChangePasswordDialog` (mẫu đó cần dialog nằm trong `DropdownMenuContent`, không hợp với 1 menu cho mỗi dòng). Kiểm bằng e2e: sau khi Hủy dialog, `document.body.style.pointerEvents` không phải `"none"` và bấm được nút Hành động dòng khác.
- **Cân đối cột:** `Column.className` áp cho cả `th` lẫn `td` (`ResponsiveList`), nên: Tên đăng nhập/Đăng nhập cuối/HS đang học/Ngày tạo/Gói/Hạn thêm `whitespace-nowrap`; HS đang học `text-right`; Họ tên giữ co giãn (có thể xuống dòng, `min-w-[8rem]`); ô Gói "Standard · Miễn phí" `whitespace-nowrap`. Bảng không tràn ngang ở 1280px (khung `overflow-hidden` của `ResponsiveList` sẵn có; kiểm `scrollWidth` của bảng ≤ `clientWidth` khung).
- **Mobile (thẻ):** hàng đầu thẻ = tên đăng nhập + họ tên bên trái, nút Hành động (`size-11`) góc phải; nhãn gói chuyển xuống dòng thông tin dưới. Bỏ hàng nút cuối thẻ.
- **Phân trang: client-side** bằng `usePagination(users, 20)` + `DataTablePagination`. Lý do: `admin.overview` vừa phục vụ màn Đơn chờ vừa màn Tài khoản, số tài khoản vài chục (spec I-11 "vài chục tài khoản"), dữ liệu đã tải hết trong 1 request; phân trang server phải đổi hình dạng `overview` và thêm truy vấn đếm mà không nhanh hơn thấy được. Cỡ trang mặc định 20 như màn Học sinh/Học phí. Gốc màn thêm `pb-14` để thanh phân trang `fixed` không che dòng cuối (AdminLayout chỉ chừa tab bar).

**Test đỏ trước:** unit MỚI `tests/unit/components/AdminAccounts.test.tsx` (mock `trpc.admin.overview.useQuery` + 3 dialog): tiêu đề cột "Hành động"; không còn nút rời "Đặt dùng thử"/"Reset mật khẩu" ngoài menu; mở menu dòng giáo viên → 3 `menuitem` đúng thứ tự; dòng admin → chỉ "Đặt gói"; chọn "Đặt dùng thử" → `TrialDaysDialog` (mock) nhận đúng user; 25 tài khoản → trang 1 có 20 dòng, "Trang sau" → 5 dòng. E2E MỚI `tests/e2e/admin-accounts.spec.ts` 1280px + 390px (mở menu → mở dialog → Hủy; không tràn; nút ≥44px). Sửa các e2e đang bấm thẳng nút: `admin-trial.spec.ts`, `admin-reset-password.spec.ts` (mở menu trước); `admin.spec.ts` chỉ đọc thẻ, kiểm lại vẫn xanh.

### 3.10 P10 — Nút Xuất Excel ở màn Lịch chỉ còn icon

**Hiện trạng:** `CalendarToolbar.tsx` render `ExportExcelButton` (`src/components/reports/ExportExcelButton.tsx`, nút `variant="outline" size="sm"` icon `FileSpreadsheet` + chữ `t("export_excel")`, mở `DropdownMenu` các kiểu xuất). Toolbar dưới `md` là `grid grid-cols-2` (từ phần M): hàng 1 Lịch lặp | Chép lịch tháng, hàng 2 Xuất Excel | Tạo ca dạy (dùng `order-*`); từ `md` là 1 hàng `flex`. `ExportExcelButton` còn dùng ở `src/app/(app)/reports/page.tsx` (header màn Báo cáo).

**Cách sửa:**
- `ExportExcelButton` thêm prop `iconOnly?: boolean` (mặc định `false`). Khi `iconOnly`: `size="icon"`, không render chữ, icon không `mr-2`, thêm `aria-label={t("export_excel")}` và `title={t("export_excel")}` (tooltip trình duyệt). Không đổi menu xuất.
- `CalendarToolbar`: truyền `iconOnly`, `className="order-3 size-11 shrink-0 md:order-1 md:size-10"` (cao 40px bằng các nút `md:h-10` cạnh bên; trước là `md:h-9`, lệch 4px).
- Hàng nút mobile đổi từ `grid grid-cols-2` sang `flex flex-wrap gap-2`: Lịch lặp và Chép lịch tháng mỗi nút `basis-[calc(50%-0.25rem)] grow` (hàng 1 chia đôi như cũ); hàng 2 = nút Xuất Excel vuông 44px + Tạo ca dạy `flex-1` (chiếm phần còn lại). Từ `md` giữ nguyên hàng `flex` cũ (`md:basis-auto md:grow-0`, `md:flex-none`, thứ tự `md:order-*` như cũ). Cập nhật ghi chú bố cục trên khối.
- **Màn Báo cáo giữ nút có chữ** (người dùng chỉ nói màn Lịch; header Báo cáo đủ chỗ, không có lưới 2 cột phải cân). Quyết định Q22.

**Test đỏ trước:** unit MỚI `tests/unit/components/ExportExcelButton.test.tsx`: `iconOnly` → `getByRole("button", { name: "Xuất Excel" })` có `title="Xuất Excel"`, `textContent` rỗng, class `size-11`; mặc định → có chữ "Xuất Excel". Mock `useExcelExport`, `useCalendar`, `useFilters`, `next-auth/react`, `trpc.tuition.getMonthlyStatus.useQuery`. E2E `tests/e2e/copy-month.spec.ts` ca mobile: thêm nút Xuất Excel vào kiểm ≥44px (cả rộng) + không chồng nút khác; ca desktop MỚI trong `tests/e2e/layout-desktop.spec.ts`: nút Xuất Excel cao bằng nút "Lịch lặp" (±1px), không có chữ hiển thị.

### 3.11 P11 — Màn Học sinh: bỏ nút rời "Nhập Excel", "Thêm học sinh" thành split button

**Hiện trạng:** `StudentList.tsx` → `PageHeader.actions` có 3 phần: `UpgradeAllClassesButton`, nút nhập Excel (chưa đủ gói: nút outline có `LockBadge`, bấm mở `UpgradeDialog`; đủ gói: `ImportStudentsButton` từ `ImportStudentsDialog.tsx`, tự giữ state mở dialog), nút chính "Thêm học sinh" (`UserPlus`, hết hạn mức HS thì gắn `LockBadge` + mở popup giới hạn). `importGate = useFeatureGate("studentImport")` (Pro, phần I). Chưa biết gói (`!allowed && !locked`) thì nút nhập tạm vô hiệu.

**Cách sửa:**
- Component MỚI `src/components/students/AddStudentSplitButton.tsx` (tách ra để test độc lập, `StudentList` đã dài): props `{ onAdd: () => void; onImport: () => void; addLockPlan: PaidPlan | null }`; tự gọi `useFeatureGate("studentImport")`.
  - Khung `div.flex`. Phần chính: `Button` (màu `primary` mặc định) `className="h-11 rounded-r-none md:h-10"`, icon `UserPlus` + chữ `t("add_student")` + `LockBadge` khi `addLockPlan` (giữ hành vi giới hạn HS cũ, `StudentList` truyền `onAdd` là lambda cũ).
  - Phần mũi tên: `DropdownMenuTrigger asChild` bọc `Button` cùng màu `primary`, `className="h-11 w-11 rounded-l-none border-l border-primary-foreground/30 px-0 md:h-10 md:w-9"`, icon `ChevronDown`, `aria-label={t("more_options")}` ("Mở thêm lựa chọn"), `data-testid="add-student-more"`. Vạch tách = viền trái trắng mờ.
  - Menu (`align="end"`, kiểu menu avatar `AppHeader`): đúng 1 `DropdownMenuItem` chữ `t("import_excel")` **không icon**, `min-h-11 md:min-h-0`. `importGate.locked` → gắn `LockBadge` (`ml-auto pl-2`), chọn → `importGate.openUpgrade()` (popup gói Pro); `allowed` → `onImport()`; chưa biết gói → item `disabled` (giữ luật "chưa biết gói không mở gì" của code cũ).
- `ImportStudentsDialog.tsx`: `export` hàm `ImportStudentsDialog` (đang là hàm nội bộ); xoá `ImportStudentsButton` (không còn nơi dùng, orphan do P11). `StudentList` giữ `const [importOpen, setImportOpen] = useState(false)` và render `{importOpen && <ImportStudentsDialog onClose={() => setImportOpen(false)} />}`.
- `StudentList`: bỏ nút nhập Excel và `importGate` (orphan), thay nút "Thêm học sinh" bằng `<AddStudentSplitButton onAdd={…lambda cũ…} onImport={() => setImportOpen(true)} addLockPlan={atLimit && me ? minPlanForStudents(me.activeStudents + 1) : null} />`. `UpgradeAllClassesButton` giữ nguyên.
- Tên truy cập: nút chính vẫn "Thêm học sinh" (các e2e đang tìm theo tên này giữ nguyên); nút mũi tên "Mở thêm lựa chọn" (không chứa "Thêm học sinh").

**Test đỏ trước:** unit MỚI `tests/unit/components/AddStudentSplitButton.test.tsx` (mock `@/hooks/useFeatureGate`): bấm phần chính → `onAdd`; mũi tên có tên "Mở thêm lựa chọn", `h-11`; mở menu → đúng 1 `menuitem` "Nhập Excel", không có icon ngoài ổ khóa; gói Pro chọn → `onImport`, không `openUpgrade`; Standard (locked) → item có `lock-badge`, chọn → `openUpgrade`, không `onImport`; chưa biết gói → item `aria-disabled`. Unit `ImportStudentsDialog.test.tsx`: render thẳng `<ImportStudentsDialog onClose={…} />` (bỏ bước bấm nút đã xoá). E2E sửa: `students-import.spec.ts` (2 chỗ bấm "Nhập Excel" → bấm `add-student-more` rồi `menuitem` "Nhập Excel"), `plan-locks.spec.ts` (nút nhập khóa → mục menu có `lock-badge`, chọn mở popup Pro); thêm ca 390px vào `students.spec.ts`: split button 2 phần ≥44px, không chồng nhau, không tràn ngang, bấm mũi tên thấy 1 mục.

## 4. Quyết định tôi tự chọn (cần duyệt)

| # | Câu hỏi | Chọn | Lý do |
|---|---|---|---|
| Q1 | P1: lấy HS nghỉ thế nào | Tham số tùy chọn `onlyStudentIds` cho `getMonthlyTuitionStatus`, gọi lượt 2 chỉ cho HS nghỉ chưa có ở lượt 1 | Giữ 1 nơi tính carry-over (khớp màn Học phí 100%); không đổi schema public |
| Q2 | P1: nhãn | `Badge` xám dùng key có sẵn `dropped` ("Đã nghỉ") | Tái dùng key (coding-rule §7), cùng chữ màn Học sinh |
| Q3 | P1: số tháng nợ của HS nghỉ lâu | Giữ `countDebtMonths` (có thể hiện "1 tháng") | Số tháng vốn là "chỉ để tham khảo" (spec D R1); số tiền mới là chính |
| Q4 | P2: cách chốt giờ build | `process.env.APP_BUILD_TIMESTAMP ||= String(Date.now())` trong `next.config.mjs` | Worker con thừa hưởng env của tiến trình chính; không cần script build riêng, không đổi `package.json#scripts.build` |
| Q5 | P3: màu nền tiêu đề Excel | `FFCCFBF1` (teal-100) | Cùng họ `#0F766E`, đủ tương phản chữ đen |
| Q6 | P3: màu môn `#4F46E5`/`#7C3AED` | Không đổi, test loại trừ 3 file màu môn | Dữ liệu người dùng, không phải màu nhấn |
| Q7 | P4: cách sửa | Chỉ gắn class cấp khi chưa huỷ | Nhỏ nhất, test được bằng jsdom |
| Q8 | P5: ca 0 HS sau khi gỡ HS lớp 12 | **Giữ ca** | Mục 3.5 |
| Q9 | P5/P6: "tương lai" | Ca chưa kết thúc theo giờ VN (`hasSessionEnded`), đúng như `softDeleteStudent` đang định nghĩa (chỉ sửa lệch giờ) | Người dùng chốt "theo giờ VN"; ca sáng nay đã dạy là lịch sử |
| Q10 | P5: năm ghi `class_upgrade_logs` | Giữ `getUTCFullYear()` | Có test khóa (`student-upgrade.test.ts` "khớp năm UTC…"); không thuộc backlog |
| Q11 | P7: không cron | Hết hạn lười (`expireStaleOrders`) ở mọi đường đọc/ghi đơn | Không hạ tầng mới; kết quả luôn đúng khi có người xem |
| Q12 | P7: mốc 7 ngày | Tuyệt đối `createdAt + 7×24h`, `<=` là hết hạn | "Quá 7 ngày" dễ hiểu, không phụ thuộc múi giờ |
| Q13 | P7: `decidedAt` của đơn hết hạn | `created_at + 7 ngày`, `decidedBy = NULL` | Lịch sử hiện đúng lúc hết hạn, không phải lúc có người mở trang |
| Q14 | P7: migration | **Không** (`status` là `VarChar(10)`, "expired" 7 ký tự) | |
| Q15 | J5: `AdminSidebar` gọi `overview` | Tối ưu: `admin.pendingCount` dùng chung cho sidebar + tab bar | Tab bar cần số đơn chờ (J4) nên đằng nào cũng thêm; tránh tải toàn bộ user + `computeApproval` ở mọi trang admin |
| Q16 | L2: cách khóa | `pg_advisory_xact_lock(BigInt(userId))` | Cùng khóa thay đổi gói theo user có sẵn |
| Q17 | L4: bước xác nhận TrialDaysDialog | Không thêm | Mục 3.8 L4 |
| Q18 | N1: nút ở trang "đã đổi mật khẩu" | Chỉ "Đăng nhập lại" | Mục 3.8 N1 |
| Q19 | P9: phân trang | Client-side, 20/trang | Mục 3.9 |
| Q20 | P9: mở dialog từ menu | State ngoài menu (mẫu `StudentList`) | Đang chạy ổn định có e2e; 1 menu mỗi dòng |
| Q21 | Version | `0.4.1` | Sửa lỗi = patch; epoch `0.4` giữ nguyên → không ai bị đăng xuất |
| Q22 | P10: màn Báo cáo | Giữ nút Xuất Excel có chữ; chỉ màn Lịch dùng `iconOnly` | Người dùng chỉ nói màn Lịch; header Báo cáo đủ chỗ |
| Q23 | P10: bố cục mobile | `flex flex-wrap`: hàng 1 chia đôi, hàng 2 icon 44px + Tạo ca dạy giãn hết | Lưới 2 cột đều sẽ để nút icon chiếm nửa hàng |
| Q24 | P11: nơi đặt split button | Component riêng `AddStudentSplitButton` | Test độc lập không phải mock cả `StudentList` |
| Q25 | P11: chưa biết gói | Mục "Nhập Excel" tạm `disabled` | Giữ luật code cũ: không mở dialog cũng không popup nâng cấp nhầm |

## 5. Phạm vi

### Trong phạm vi
- Server: `report.service.ts`, `tuition.service.ts` (tham số thêm), `student.service.ts`, `plan.service.ts`, `plan-admin.service.ts`, `trial.service.ts`, `plan-price.service.ts`, `session-copy.service.ts`, `routers/admin.ts` (`pendingCount`).
- Thuần: `src/lib/session-time.ts` (MỚI), `src/lib/radio-group-keys.ts` (MỚI), `src/lib/plans.ts` (`ORDER_TTL_DAYS`, `orderExpiresAt`), `src/lib/copy-month.ts` (`capConflictsPerPattern`), `src/lib/constants.ts`, `src/lib/student-import-excel.ts`, `backup.service.ts`, `useExcelExport.ts`, `next.config.mjs`.
- UI P10–P11: `ExportExcelButton.tsx` (prop `iconOnly`), `CalendarToolbar.tsx`, `StudentList.tsx`, `AddStudentSplitButton.tsx` (MỚI), `ImportStudentsDialog.tsx` (export dialog, xoá `ImportStudentsButton`).
- UI: `DashboardAlerts.tsx`, `SessionCard.tsx`, `PlanPurchaseDialog.tsx`, `PendingOrderCard.tsx`, `CurrentPlanBadge.tsx`, `plan/page.tsx`, `AdminOrderHistory.tsx`, `AdminPendingOrders.tsx`, `AdminSidebar.tsx`, `AdminTabBar.tsx`, `AdminAccounts.tsx`, `ResetPasswordDialog.tsx`, `change-password/page.tsx` + `PasswordAlreadyChanged.tsx` (MỚI).
- i18n vi/en; test unit/integration/e2e như mục 3; `package.json` 0.4.1.

### Ngoài phạm vi (YAGNI)
- Lỗi server trả tiếng Anh (người dùng chốt để sau).
- Đổi màn Học phí để hiện HS nghỉ không có ca tháng này (P1 chỉ Tổng quan; bấm vào vẫn mở được qua `studentId`).
- Đổi năm log lên lớp sang giờ VN; đổi luật "từ tháng 7" của `auth.me`.
- Xoá/huỷ tự động ca trống sau lên lớp.
- Phân trang server cho `admin.overview`; ô tìm kiếm tài khoản.
- Đổi bảng màu môn học.
- Sửa `bulkCreate` coi ca huỷ là trùng (spec M mục 14, chưa được yêu cầu).

## 6. Dữ liệu, migration

- **Không migration**, không đổi `prisma/schema.prisma` → không cần backup Neon riêng cho P (vẫn nhắc người điều phối theo thói quen trước merge).
- P5 ghi `session_students` (update khối, xoá link HS ra trường) trong transaction của lần lên lớp; chạy trên prod khi giáo viên đăng nhập từ tháng 7 năm sau (năm nay đa số đã có log năm 2026 → không chạy lại). Dữ liệu năm 2026 đã lên lớp trước khi có P **không** được sửa lùi (ghi ở Rủi ro).
- P7 ghi `plan_orders.status = 'expired'` lười; đơn chờ đang quá 7 ngày trên prod sẽ chuyển "Hết hạn" ngay lần đầu có người mở `/plan` hoặc trang admin sau khi P lên.

## 7. i18n

Thêm/đổi trong `src/language/vi.json` và `en.json` (cùng bộ key, không gạch dài):

| Key | vi | en |
|---|---|---|
| `alert_debt_desc` (đổi) | Học sinh còn nợ học phí cũ, kể cả đã nghỉ | Students with earlier unpaid tuition, including dropped ones |
| `copy_skip_past` (đổi) | {count} ca rơi vào ngày đã qua, bỏ qua | {count} sessions on past days, skipped |
| `plan_status_expired` | Hết hạn | Expired |
| `plan_order_expires` | Tự hết hạn lúc {date} nếu chưa được xác nhận | Expires at {date} if not confirmed |
| `admin_order_expires` | Hết hạn lúc {date} | Expires at {date} |
| `plan_order_load_error` | Đã tạo đơn nhưng chưa tải được thông tin chuyển khoản. | Order created, but the transfer details could not be loaded. |
| `password_already_changed_title` | Mật khẩu đã được cập nhật | Your password has been updated |
| `password_already_changed_desc` | Đăng nhập lại để tiếp tục dùng ứng dụng. | Sign in again to continue. |
| `relogin` | Đăng nhập lại | Sign in again |
| `admin_col_actions` | Hành động | Actions |
| `more_options` | Mở thêm lựa chọn | More options |

Dùng lại: `dropped`, `retry`, `notice_transfer_content`, `actions`, `admin_set_plan`, `admin_set_trial`, `admin_reset_password`.

## 8. Kiểm thử

Chỉ chạy trên `.env.test` (Postgres local Docker `localhost:5433`), theo `docs/coding-rule.md` §6.1. Không chạy trên prod; thử prod chỉ bằng `qa_test` (id=4), người dùng tự đăng nhập.

- **Unit MỚI:** `tests/unit/lib/session-time.test.ts`, `tests/unit/next-config-build-time.test.ts`, `tests/unit/lib/radio-group-keys.test.tsx` (jsdom), `tests/unit/components/AdminAccounts.test.tsx`, `tests/unit/components/PasswordAlreadyChanged.test.tsx`, `tests/unit/components/ExportExcelButton.test.tsx`, `tests/unit/components/AddStudentSplitButton.test.tsx`; `tests/unit/components/AdminNav.test.tsx` thêm ca số đơn chờ ở tab bar.
- **Unit sửa:** `theme-legacy-colors`, `SessionCard`, `DashboardAlerts`, `PlanPurchaseDialog`, `CurrentPlanBadge`, `ResetPasswordDialog`, `lib/plans`, `lib/copy-month`, `layout/admin-redirect` (trang `/change-password` cờ false → render, không redirect).
- **Integration sửa:** `dashboard-alerts`, `student-upgrade`, `student-delete-schedule-sync`, `plan-orders`, `admin`, `trial-days`, `plan-prices`, `session-copy-month`.
- **E2E MỚI:** `tests/e2e/admin-accounts.spec.ts`. **E2E sửa:** `admin-trial.spec.ts`, `admin-reset-password.spec.ts`, `students-import.spec.ts`, `plan-locks.spec.ts`, `copy-month.spec.ts` (nút Xuất Excel), `layout-desktop.spec.ts` (chiều cao nút), `students.spec.ts` (split button 390px); thêm 1 ca vào `dashboard-alerts.spec.ts` (HS nghỉ còn nợ có nhãn "Đã nghỉ") và `plan.spec.ts` (đơn quá hạn hiện "Hết hạn", không có QR).
- **Chung:** `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm exec playwright test`, `pnpm exec next build` (DB test) + kiểm 1 giá trị giờ build trong `.next`.

## 9. Review Focus

- **P1 không ghi DB và khớp màn Học phí:** lượt 2 `persist=false`; số tiền HS nghỉ = cột dư nợ tháng trước ở màn Học phí lọc `studentId`; không trùng dòng.
- **P2 thật sự là giờ build:** sau `next build`, 1 giá trị giờ build duy nhất trong `.next/server` + `.next/static`; test unit mô phỏng nạp config 2 lần.
- **P5/P6 giờ VN:** mọi so sánh "đã kết thúc" đi qua `hasSessionEnded` (giờ tường + 7h); không còn `Date.UTC(now.getUTC…)` làm "hôm nay" trong `student.service.ts`; ca đã dạy không bị đổi; transaction bao cả tăng lớp lẫn sửa ca.
- **P7 không duyệt được đơn quá hạn** kể cả khi chưa có ai đọc để expire (điều kiện `createdAt` ngay trong câu chốt đơn).
- **P9 Radix menu → dialog:** không kẹt `pointer-events: none` sau khi đóng dialog; nút Hành động có tên truy cập kèm tên đăng nhập; admin chỉ có "Đặt gói".
- **Không đổi hành vi khác:** idle chỉ HS đang học; `getMonthlyTuitionStatus` 4 tham số cũ cho kết quả y hệt; lịch sử giá/dùng thử vẫn sắp theo thời gian.

## 10. Rủi ro và điều bất ngờ trong code

| Rủi ro | Xử lý |
|---|---|
| **Bất ngờ 1:** P1 có 2 lớp lọc (danh sách học phí không lấy HS nghỉ không có ca tháng này), bỏ bộ lọc `isActive` thôi không đủ | Lượt 2 `onlyStudentIds` (mục 3.1) |
| **Bất ngờ 2:** #418 không riêng `/students`: giờ build lệch giữa worker build nên mọi trang có sidebar (cả admin) đều dính | Sửa ở `next.config.mjs`; kiểm `.next` sau build |
| **Bất ngờ 3:** `docs/12-pagination.md` không tồn tại; màn thật dùng cỡ trang 20 (coding-rule ghi 5) | Theo code màn thật (20) |
| **Bất ngờ 4:** Tailwind 3.4, không phải 4 | Không ảnh hưởng cách sửa P4 |
| HS nghỉ lâu hiện "Nợ 1 tháng" dù nợ lâu hơn | Q3; số tiền đúng |
| Dữ liệu lên lớp năm 2026 (đã chạy trước P) vẫn còn khối cũ/HS lớp 12 trong ca tương lai | Không sửa lùi tự động. Kiểm tra tay: giáo viên xem lịch các tháng tới, gỡ HS đã tốt nghiệp nếu còn (ghi trong danh sách kiểm tra tay) |
| Giả `Date` trong integration với Prisma | Chỉ giả `Date` (`toFake: ["Date"]`, tiền lệ `parent-link.test.ts`), luôn `useRealTimers` ở `afterEach` |
| `approveOrder` đơn quá hạn: lỗi ném trong transaction nên chưa ghi `expired` | Lần đọc danh sách kế tiếp sẽ expire; admin thấy thông báo rõ |
| Test e2e admin phụ thuộc tài khoản mục tiêu nằm ở trang 1 (20/trang, sắp `id`) | DB test chỉ có seed + vài user e2e; e2e mới kiểm có ≤ 20 dòng trước khi chạy, nếu không thì chuyển trang |

## 11. Câu hỏi cho người dùng

Không có câu hỏi chặn. Các quyết định ở mục 4 (đặc biệt Q8 giữ ca trống, Q15 thêm `admin.pendingCount`, Q19 phân trang client 20/trang) có thể đổi khi duyệt spec.

## 12. Thứ tự thực hiện

Xem plan `docs/superpowers/plans/2026-09-27-p-sua-backlog.md` (9 task tuần tự, mỗi task 1 agent mới).

## 13. Người dùng đã chốt (2026-09-27)

| # | Nội dung | Chốt |
|---|---|---|
| U1 | P1 hiển thị HS nghỉ còn nợ | Chung nhóm nợ, nhãn xám "Đã nghỉ" (đổi spec D S5/R2 cho nhóm nợ) |
| U2 | P5 lên lớp và ca tương lai | Cập nhật khối ca tương lai theo khối mới; gỡ HS lớp 12 đã nghỉ; ca còn HS khác giữ; ca đã qua không đổi; giờ VN; trong transaction |
| U3 | P7 đơn chờ | Quá 7 ngày chưa duyệt → "Hết hạn"; admin không duyệt được, phải đặt gói tay |
| U4 | Lỗi server tiếng Anh | Để sau |
| U5 | P9 màn Tài khoản admin | Cột Hành động 1 nút mở menu (icon + chữ như menu avatar), cân đối cột, phân trang |
| U6 | P10 nút Xuất Excel màn Lịch | Chỉ icon, giữ tên truy cập + tooltip, ≥44px, cân lưới mobile |
| U7 | P11 màn Học sinh | Bỏ nút rời "Nhập Excel"; "Thêm học sinh" split button, mũi tên mở menu 1 mục chữ "Nhập Excel" (không icon), giữ khóa gói Pro |
