# A3 — Làm mới phong cách (màu, thẻ, bo góc, điều hướng)

> Phần A3 trong lộ trình ở `2026-09-25-a1-ui-mobile-first-design.md` mục 0. Phụ thuộc A1, A2; viết trên code thật ở `main` HEAD `c79aed3` (B–G đã merge).
> Nguồn sự thật về giao diện: 5 mockup đã duyệt `Main`, `DashboardMobile`, `TuitionMobile`, `MoreSheetMobile`, `StyleGuide` (`*.dc.html`).

## 1. Bối cảnh

Giao diện hiện tại lấy màu shadcn mặc định (zinc) cộng nhiều màu gắn tay rời rạc:

- Nút chính (`Button` variant `default`) là đen zinc (`--primary: 240 5.9% 10%`); nút "Tạo ca dạy" ở `CalendarToolbar.tsx:142` gắn tay `bg-slate-900 shadow-md`.
- Trạng thái active, link, ô ngày được chọn dùng indigo/violet/purple gắn tay ở khoảng 20 file (`AppSidebar`, `BottomTabBar`, `AppHeader`, `MonthCalendar`, `SessionCard`, `ReportPeriodPicker`, `TuitionStatusBadge`, `ParentView`, `LoginHeader`, …).
- Icon thẻ số liệu Dashboard mỗi thẻ một màu (emerald, cyan, green, red, blue, indigo, orange, violet); giá trị thẻ Báo cáo mỗi thẻ một màu.
- Thẻ `Card` có `shadow-sm`, bo 8px (`--radius: 0.5rem`); vài thẻ có `shadow-sm`/`shadow-md` gắn tay.
- Font: `layout.tsx` nạp Geist qua biến `--font-geist-sans` nhưng `tailwind.config.ts` không khai báo `fontFamily` → **body đang chạy font hệ thống, không phải Geist**.
- Dark mode: `globals.css` có khối `.dark`, `tailwind.config.ts` có `darkMode: ["class"]`, `next-themes` có trong `package.json`, nhưng **không có `ThemeProvider` nào gắn class `dark`** → app chỉ chạy chế độ sáng. Riêng `Toaster` (`ui/sonner.tsx`) gọi `useTheme()` không có provider → theme `"system"`, máy để tối thì toast tối.
- Điều hướng: Môn học và Cài đặt chỉ vào được qua menu avatar (`AppHeader.tsx`), khó tìm trên điện thoại.

## 2. Mục tiêu và tiêu chí hoàn thành

- Toàn app (kể cả `/login`, `/register`, trang phụ huynh `/p/[token]`) dùng **1 màu nhấn duy nhất `#0F766E`**, không còn class `indigo-*`, `violet-*`, `purple-*` trong `src/` (kiểm bằng grep).
- Thẻ: nền trắng, viền 1px `#E7E9EE`, bo 14px, không đổ bóng. Nút bo 10px. Nền trang `#F6F7F9`.
- Đỏ `#B42318` chỉ xuất hiện ở tiền nợ và trạng thái nợ.
- Điều hướng mới: desktop sidebar 5 mục chính + nhóm "Quản lý" (Môn học, Cài đặt); mobile tab "Thêm" mở bottom sheet (Báo cáo, Môn học, Cài đặt); menu avatar chỉ còn Sao lưu dữ liệu, Đổi mật khẩu, Đăng xuất.
- Mọi cặp chữ/nền trong bảng màu đạt tương phản ≥ 4.5:1 (có unit test).
- Toàn bộ e2e hiện có xanh sau khi sửa các test phụ thuộc menu avatar/tab; có e2e 390px cho tab Thêm.
- Không đổi logic nghiệp vụ, route, dữ liệu.

## 3. Quyết định đã chốt

| # | Câu hỏi | Chốt |
|---|---|---|
| Q1 | Phong cách | Sáng, tối giản, 1 màu nhấn `#0F766E`. Giữ Geist, shadcn/ui, lucide-react, IA hiện có. |
| Q2 | Bảng màu | Nền trang `#F6F7F9`, thẻ `#FFFFFF`, viền `#E7E9EE`, chữ chính `#111827`, chữ phụ `#6B7280`, nợ `#B42318`. |
| Q3 | Nhãn trạng thái | Chưa đóng: nền `#FEF3F2` / chữ `#B42318`. Đóng một phần: nền màu nhấn 8% / chữ màu nhấn. Đã đóng đủ: `#ECFDF3` / `#067647`. |
| Q4 | Thẻ, nút | Thẻ trắng, viền 1px, bo 14px, không bóng. Nút bo 10px, cao 44px mobile. |
| Q5 | Desktop | Sidebar 5 mục chính + nhóm "Quản lý" sát đáy (Môn học, Cài đặt). |
| Q6 | Mobile | Tab: Tổng quan · Lịch · Học sinh · Học phí · Thêm. "Thêm" mở bottom sheet: Báo cáo, Môn học, Cài đặt, mỗi mục có mô tả, cao ≥ 56px. Tab Thêm active ở `/reports`, `/subjects`, `/settings`. |
| Q7 | Menu avatar | Chỉ còn: Sao lưu dữ liệu, Đổi mật khẩu, Đăng xuất. |
| Q8 | Phạm vi | Chỉ token/màu/thẻ/bo góc/điều hướng. Không đổi nghiệp vụ, route, không thêm tính năng. |

## 4. Phạm vi

### Trong phạm vi
- Token màu, bo góc, font trong `globals.css` + `tailwind.config.ts`.
- Primitive: `ui/card.tsx` (bỏ bóng), `ui/button.tsx` (không đổi, tự ăn token).
- Khung: `AppLayout`, `AppSidebar`, `AppHeader`, `BottomTabBar`, `nav-items.ts`, sheet "Thêm" (MỚI).
- Thay indigo/violet/purple và màu icon/giá trị rời rạc ở các file liệt kê mục 5.5.
- `TuitionStatusBadge`, thẻ học phí mobile, `StatCard` theo mockup.
- i18n key mới, unit test tương phản + điều hướng, sửa/thêm e2e.

### Ngoài phạm vi (YAGNI)
- Dark mode (xem mục 10, D1).
- Đổi bố cục màn (Dashboard, Học phí, …) ngoài những gì mockup đổi về màu/thẻ; header mobile giữ cấu trúc hiện tại (lời chào + ngôn ngữ + avatar).
- Màu môn học (`Subject.color`, `SUBJECT_COLORS`, `@default("#4F46E5")`): là dữ liệu người dùng, giữ nguyên hoàn toàn (D2).
- Màu cấp học trên lưới lịch (tiểu học xanh dương, THCS emerald) và màu điểm danh (có mặt/vắng/muộn): là mã hoá dữ liệu có chú thích, giữ nguyên; chỉ đổi "Hỗn hợp" đang là indigo (D5).
- `TuitionNoticeCard` (được chụp thành ảnh gửi Zalo): không đổi, để ảnh phiếu không lệch.
- Quét đổi toàn bộ `slate-*` (≈325 chỗ / 41 file) sang token: chỉ đổi ở khung, khối dùng chung và thẻ danh sách (mục 5.5). `slate-200` còn lại lệch `#E7E9EE` không nhận ra bằng mắt.
- Màu `destructive` (nút xoá, mục "Đăng xuất" màu đỏ): giữ nguyên, không phải "tiền nợ".
- Hằng `COLORS` trong `src/lib/constants.ts` (có `primary: "#4F46E5"`) không được dùng ở đâu; không đụng, chỉ ghi nhận là code chết.
- Backlog riêng, **không thuộc A3**: HS đã nghỉ còn nợ không hiện ở Dashboard; lỗi hydration #418.

## 5. Giao diện

### 5.1 Token (`src/app/globals.css`, khối `:root`)

Giữ định dạng HSL không `hsl()` như hiện tại (để `bg-primary/90`, `bg-primary/[0.08]` chạy được).

| Token | Hex | HSL | Ghi chú |
|---|---|---|---|
| `--background` | `#FFFFFF` | `0 0% 100%` | **Giữ trắng**: `Dialog`, `Sheet`, `Input`, nút `outline` đang dùng `bg-background` (D3) |
| `--page` (MỚI) | `#F6F7F9` | `220 20% 97%` | Nền trang, dùng qua class `bg-page` |
| `--foreground`, `--card-foreground`, `--popover-foreground` | `#111827` | `221 39% 11%` | |
| `--card`, `--popover` | `#FFFFFF` | `0 0% 100%` | |
| `--primary`, `--ring` | `#0F766E` | `175 77% 26%` | = Tailwind `teal-700` |
| `--primary-foreground` | `#FFFFFF` | `0 0% 100%` | |
| `--muted-foreground` | `#6B7280` | `220 9% 46%` | Chữ phụ |
| `--secondary`, `--muted`, `--accent` | `#F3F4F6` | `220 14% 96%` | Nền hover ghost/secondary |
| `--secondary-foreground`, `--accent-foreground` | `#111827` | `221 39% 11%` | |
| `--border`, `--input` | `#E7E9EE` | `223 17% 92%` | |
| `--debt` (MỚI) | `#B42318` | `4 76% 40%` | Chỉ tiền nợ / trạng thái nợ |
| `--debt-soft` (MỚI) | `#FEF3F2` | `5 86% 97%` | |
| `--success` (MỚI) | `#067647` | `155 90% 24%` | Nhãn "đã đóng đủ" |
| `--success-soft` (MỚI) | `#ECFDF3` | `145 81% 96%` | |
| `--radius` | 14px | `0.875rem` | |

`--destructive` giữ nguyên. Hover nút chính dùng sẵn `hover:bg-primary/90` của `button.tsx` (không thêm token `#115E59`).

Xoá khối `.dark` (D1).

### 5.2 `tailwind.config.ts`
- `colors`: thêm `page: "hsl(var(--page))"`, `debt: { DEFAULT, soft }`, `success: { DEFAULT, soft }` theo token trên.
- `borderRadius`: `xl: "var(--radius)"` (14px), `lg: "var(--radius)"` (14px), `md: "calc(var(--radius) - 4px)"` (10px), `sm: "calc(var(--radius) - 6px)"` (8px). Nhờ vậy các thẻ `rounded-lg`/`rounded-xl` sẵn có thành 14px, nút/ô nhập `rounded-md` thành 10px mà không phải sửa từng chỗ (D4).
- `fontFamily`: `sans: ["var(--font-geist-sans)", ...defaultTheme.fontFamily.sans]`, `mono: ["var(--font-geist-mono)", ...defaultTheme.fontFamily.mono]` (import `defaultTheme` từ `tailwindcss/defaultTheme`). Đây là thay đổi nhìn thấy được: app chuyển từ font hệ thống sang Geist đúng như mockup.

### 5.3 Primitive
- `ui/card.tsx`: bỏ `shadow-sm` (giữ `rounded-lg border bg-card`).
- `ui/button.tsx`: không sửa. Chiều cao giữ quy ước hiện có: primitive `h-10`, các màn đặt `h-11 md:h-10` (44px mobile, 40px desktop). Không đổi primitive sang 44px để tránh đổi chiều cao hàng loạt nút trong bảng/dialog desktop.
- `ui/badge.tsx`: không sửa.
- `layout.tsx`: `<Toaster richColors position="top-right" theme="light" />` để toast không đổi tối theo hệ điều hành.

### 5.4 Điều hướng

**`nav-items.ts`**
- Giữ `NAV_ITEMS` (5 mục, sidebar desktop dùng nguyên) và `isNavActive`.
- MỚI `MANAGE_ITEMS`: `/subjects` (`labelKey: "subject"`, icon `BookOpen`), `/settings` (`labelKey: "settings"`, icon `Settings`).
- MỚI `MORE_ITEMS`: `/reports`, `/subjects`, `/settings`, mỗi mục thêm `descKey` (mục 7).
- MỚI `isMoreActive(pathname)`: `MORE_ITEMS.some((i) => isNavActive(pathname, i.href))`.

**`AppSidebar.tsx`** (desktop, theo `Main.dc.html`)
- `w-60` → `w-[232px]`; nền trắng, viền phải token; padding `px-3.5 py-5`, các khối cách nhau 28px.
- Logo: ô 32px `rounded-[9px] bg-primary`, icon `GraduationCap` trắng size 18, chữ `t("calendar")` 16px semibold. Bỏ `border-b` và `h-14` của khối logo.
- Mục chính: `min-h-10 rounded-md px-2.5 gap-2.5 text-sm font-medium text-[#4B5563]`; active `bg-primary/[0.08] text-primary font-semibold`. Giữ icon lucide (D6). Thêm `aria-current="page"` khi active (MỚI, để test).
- Nhóm "Quản lý" đẩy sát đáy (`mt-auto`), viền trên `#F0F1F4`, tiêu đề 11px semibold uppercase tracking `0.05em` `text-muted-foreground`, 2 link từ `MANAGE_ITEMS` cùng kiểu mục chính.
- Dòng phiên bản dưới cùng: `font-mono text-[11px] text-muted-foreground` (giữ nội dung version, SHA, build time).

**`AppHeader.tsx`**
- Desktop `md:h-16 md:px-8`, mobile giữ `h-14 px-4`; nền trắng, viền dưới token.
- Nút ngôn ngữ: giữ icon `Languages`, đổi thành viền 1px token, `rounded-md`, `size-11 md:size-10`.
- Avatar: `size-11 md:size-10 rounded-full bg-[#EEF0F4] text-[#374151] text-[13px] font-semibold` (bỏ indigo).
- Menu avatar bỏ 2 mục `Link` `/subjects`, `/settings`; còn: Sao lưu dữ liệu (`backup.download`), Đổi mật khẩu (`ChangePasswordDialog`), separator, Đăng xuất. Bỏ import `BookOpen`, `Settings`, `Link` nếu không còn dùng.

**`BottomTabBar.tsx`** (theo `DashboardMobile` / `MoreSheetMobile`)
- 5 ô: 4 link đầu của `NAV_ITEMS` (Tổng quan, Lịch, Học sinh, Học phí) + nút **Thêm** (icon `Ellipsis`).
- Tab Lịch dùng nhãn ngắn key MỚI `calendar_short` ("Lịch").
- Kiểu: giữ `h-14` + icon `size-5` (D7). Active: `text-primary font-semibold` + vạch 20×3px `rounded-full bg-primary` ở mép trên ô; không active `text-muted-foreground font-medium`. Viền trên token.
- Nút Thêm là `<button type="button">`, `aria-current="page"` khi `isMoreActive(pathname)`, `aria-haspopup="dialog"`, mở `MoreSheet`.

**`MoreSheet.tsx` (MỚI, `src/components/layout/`)**
- Dùng `Sheet` / `SheetContent side="bottom"` sẵn có; `className` ghi đè: `rounded-t-[20px] px-4 pt-2.5 pb-[calc(1rem+env(safe-area-inset-bottom))]`. `SheetTitle` = `t("more")` đặt `sr-only` (Radix yêu cầu tiêu đề); dialog có accessible name "Thêm".
- Tay nắm 40×4px `rounded-full bg-[#D5D8DE]` giữa trên.
- Mỗi mục là `Link` `min-h-14 rounded-xl px-3 gap-3.5`: ô icon 40px `rounded-md bg-primary/[0.08] text-primary` (icon lucide: `BarChart3`, `BookOpen`, `Settings`), nhãn 15px medium, mô tả 12px `text-muted-foreground`, mũi tên `ChevronRight` `text-[#9CA3AF]`.
- Bấm mục → đóng sheet (`onOpenChange(false)` trong `onClick`) rồi điều hướng.
- Sheet phủ cả thanh tab (lớp phủ Radix mặc định), khác mockup là sheet nằm trên thanh tab (D8).

**`AppLayout.tsx`**: `bg-slate-50` → `bg-page`. Padding đáy mobile giữ nguyên (tab bar vẫn 56px).

### 5.5 Thay màu theo màn

| File | Đổi |
|---|---|
| `globals.css` `.calendar-day-cell--today` | `bg-indigo-50 ring-indigo-400` → `bg-primary/[0.08] ring-primary/40` |
| `MonthCalendar.tsx` | ô chọn `bg-indigo-50 ring-indigo-500 text-indigo-700` → `bg-primary/[0.08] ring-primary text-primary`; chấm `bg-indigo-500` → `bg-primary`; link `text-indigo-600` → `text-primary`; legend "Hỗn hợp" → `border-slate-500 bg-slate-100`; bỏ `shadow-sm` |
| `SessionCard.tsx` | `level === "mixed"` → `border-slate-500 bg-slate-100`; chữ `text-indigo-600` → `text-primary` |
| `SessionListItem.tsx` | nhãn `bg-indigo-50 text-indigo-600` → `bg-primary/[0.08] text-primary`; bỏ `shadow-sm` |
| `CalendarToolbar.tsx` | nút tạo ca bỏ `bg-slate-900 hover:bg-slate-800 shadow-md shadow-slate-200` (về variant `default` = primary); nút "Xoá bộ lọc" (`clear_filters`) `text-indigo-600 hover:bg-indigo-50` → `text-primary hover:bg-primary/[0.08]`; khung bỏ `shadow-sm` |
| `ReportPeriodPicker.tsx` | `text-indigo-500/600` → `text-primary`; bỏ `shadow-sm` ở nút kích hoạt |
| `dashboard/page.tsx` | mọi icon `StatCard` → `text-muted-foreground`; `valueClassName`: Đã thu `text-primary`, Nợ `text-debt`, còn lại mặc định |
| `reports/page.tsx` | `valueClassName`: kỳ vọng, thực tế → bỏ (mặc định); đã thu → `text-primary`; chưa thu → `text-debt`; dòng "Hụt" `text-orange-600` giữ (không phải tiền nợ) |
| `StatCard.tsx` | `border-slate-200` → bỏ (token); giá trị `font-bold` → `font-semibold tracking-tight`, nhãn `text-muted-foreground`; giữ `whitespace-nowrap`, `data-testid` |
| `DashboardAlerts.tsx` | số đếm `Badge` → `bg-primary/[0.08] text-primary`; tiền nợ `text-red-600` → `text-debt`; icon 3 thẻ → `text-muted-foreground` |
| `TuitionStatusBadge.tsx` | xem 5.6 |
| `tuition/page.tsx` (thẻ mobile) | tiền "Còn phải trả": `unpaid` → `text-debt`; đã đủ (`fully_paid`/`overpaid`/`settled_waived`) → `text-muted-foreground`; còn lại `text-foreground`; cỡ 17px semibold `tabular-nums`. `payButton` dùng variant `default` khi chưa đủ, `outline` khi đã đủ (dùng `getTuitionBadgeStatus`) |
| `TuitionDetailSheet.tsx` | nợ cũ / còn nợ `text-red-600` → `text-debt` (dòng 166, 204) |
| `StudentScheduleView.tsx` | indigo → `primary`; `shadow-md`/`shadow-sm` trên `Card` → bỏ; màu `text-red-600` ở dòng 280 (chưa đóng) → `text-debt` |
| `StudentList.tsx` | link SĐT `text-indigo-700` → `text-primary` |
| `SubjectList.tsx` | huy hiệu "Mặc định" → `border-transparent bg-primary/[0.08] text-primary` |
| `SessionDetailDialog.tsx` | spinner `text-indigo-500` → `text-primary` |
| `ParentView.tsx` | link, nhãn indigo → `text-primary`, `bg-primary/[0.08]` |
| `LoginHeader.tsx`, `RegisterHeader.tsx` | logo `bg-indigo-600` → `bg-primary` |
| `LoginForm.tsx`, `RegisterForm.tsx` | link `text-indigo-600` → `text-primary` |
| `login/page.tsx`, `register/page.tsx` | `bg-slate-50` → `bg-page` |
| `ResponsiveList.tsx`, `TodaySessions.tsx`, thẻ trong `StudentList`, `SubjectList`, `tuition/page.tsx` | `border-slate-200` → bỏ (dùng viền token mặc định) |
| `PageHeader.tsx` | tiêu đề `text-2xl` → `text-[22px] md:text-[28px] font-semibold tracking-tight text-foreground`; mô tả `text-muted-foreground` |

Kiểm tra cuối: `grep -rnE "(indigo|violet|purple)-[0-9]" src` rỗng.

### 5.6 `TuitionStatusBadge`

Giữ icon và chữ hiện có, chỉ đổi màu (`border-none`):

| Trạng thái (`getTuitionBadgeStatus`) | Màu |
|---|---|
| `unpaid` | `bg-debt-soft text-debt` |
| `partial`, `paid_this_month` | `bg-primary/[0.08] text-primary` |
| `fully_paid`, `overpaid`, `settled_waived` | `bg-success-soft text-success` |
| `no_sessions` | giữ `outline` xám |

`hover:` giữ cùng nền (badge không bấm được).

## 6. Backend

Không đổi. Không router, service, schema nào bị động tới.

## 7. i18n

Thêm vào cả `vi.json` và `en.json` (số key bằng nhau). Dùng lại `subject`, `settings`, `reports`, `backup_data`, `change_password`, `logout`, `main_navigation`, `account_menu`.

| Key | vi | en |
|---|---|---|
| `more` | Thêm | More |
| `calendar_short` | Lịch | Calendar |
| `manage_group` | Quản lý | Manage |
| `more_reports_desc` | Doanh thu, công nợ theo tháng và năm | Revenue and debts by month and year |
| `more_subjects_desc` | Thêm, đổi màu, ẩn môn | Add, recolor, hide subjects |
| `more_settings_desc` | Tài khoản ngân hàng nhận học phí | Bank account for tuition |

Trước khi thêm, grep để chắc chưa có key trùng tên.

## 8. Kiểm thử

### Unit (MỚI)
- `tests/unit/lib/theme-contrast.test.ts`: đọc `src/app/globals.css`, lấy HSL của các token, đổi sang RGB, tính tỉ lệ WCAG. Khẳng định ≥ 4.5:1 cho: `--primary-foreground`/`--primary` (≈5.5), `--foreground`/`--card`, `--muted-foreground`/`--card` (≈4.8), `--muted-foreground`/`--page` (≈4.5, sát ngưỡng), `--primary`/`--card`, `--primary`/`--page`, `--debt`/`--card`, `--debt`/`--debt-soft` (≈6.0), `--success`/`--success-soft` (≈5.4), `--primary` trên nền trắng pha 8% màu nhấn (≈4.9). Nếu cặp chữ phụ/nền trang < 4.5 thì hạ `--muted-foreground` một nấc (ví dụ `220 9% 43%`) và ghi lại.
- `tests/unit/layout/nav-items.test.ts`: `isMoreActive` đúng cho `/reports`, `/subjects`, `/settings`, `/settings/x`; sai cho `/dashboard`, `/students`, `/subjectsx`.

### E2E cần sửa (điều hướng mới)
| Test | Sửa |
|---|---|
| `mobile.spec.ts` `SCREENS` + test "thanh tab đáy chuyển đủ 5 màn" | 4 tab link (tab Lịch tên `Lịch`, dùng `exact: true`); Báo cáo đi qua nút Thêm → sheet → link "Báo cáo"; khẳng định nút Thêm có `aria-current="page"` ở `/reports` |
| `subjects.spec.ts:46-47` | thay menu avatar bằng: nút "Thêm" trong `navigation` "Điều hướng chính" → link "Môn học" trong dialog "Thêm" |
| `tuition-notice.spec.ts:117-118` | tương tự, link "Cài đặt" |
| `auth.spec.ts:32`, `backup.spec.ts:24` | menu avatar vẫn có Đăng xuất / Sao lưu dữ liệu → không sửa, chỉ chạy lại xác nhận |

Các test tìm theo nhãn form "Môn học" (`calendar.spec.ts`, `mobile.spec.ts:89`, …) không bị ảnh hưởng.

### E2E thêm (390×844, trong `mobile.spec.ts`)
- Bấm "Thêm" → dialog "Thêm" hiện 3 link Báo cáo, Môn học, Cài đặt, mỗi link cao ≥ 56px (`boundingBox`), có mô tả.
- Bấm "Cài đặt" → URL `/settings`, dialog đóng, nút Thêm `aria-current="page"`; lặp cho `/subjects`.
- Mở menu avatar: không còn `menuitem` "Môn học", "Cài đặt"; có "Sao lưu dữ liệu", "Đổi mật khẩu", "Đăng xuất".
- Không màn nào tràn ngang (dùng lại `expectNoHorizontalScroll`).

### E2E thêm (desktop, `layout-desktop.spec.ts`, 1280px)
- Sidebar có tiêu đề "Quản lý", link "Môn học" → `/subjects` và link có `aria-current="page"`; link "Cài đặt" → `/settings`.
- Nút chính "Tạo ca dạy" ở `/calendar` có `background-color` = `rgb(15, 118, 110)` (1 phép kiểm token thật sự áp dụng).

### Chung
`pnpm lint`, `pnpm test`, `pnpm exec playwright test`, `pnpm exec next build` sạch; test chỉ chạy trên `.env.test` như các phần trước. So ảnh bằng mắt 5 màn ở 390px và 1440px với mockup trước khi merge.

## 9. Rủi ro

| Rủi ro | Xử lý |
|---|---|
| Đổi `borderRadius` làm phần tử nhỏ dùng `rounded-lg` (ô logo login 48px, nhóm nút lọc `tuition/page.tsx:150`) bo 14px, trông quá tròn | Rà bằng mắt ở bước so mockup; chỗ nào lạ thì hạ về `rounded-md` tại chỗ |
| Chuyển sang Geist làm chữ rộng hơn, số tiền 9 chữ số tràn thẻ | `layout-desktop.spec.ts` đã kiểm `100.000.000 đ` ở 390/1024/1280/1366px; chạy lại |
| `--background` giữ trắng mà quên đổi nền trang ở chỗ khác | Chỉ 3 chỗ dùng `bg-slate-50` làm nền trang (`AppLayout`, `login/page`, `register/page`), đều đổi |
| Chữ phụ `#6B7280` trên nền trang chỉ ≈ 4.5:1 | Unit test bắt; phương án hạ độ sáng đã ghi ở mục 8 |
| Emerald THCS (lưới lịch) gần tông màu nhấn | Chấp nhận: có chú thích; nếu người dùng thấy lẫn thì đổi ở phần sau, không trong A3 |
| Sheet che tab bar nên lúc mở không thấy tab Thêm active | Chấp nhận (D8); active hiện đúng sau khi điều hướng |

## 10. Quyết định do người viết spec chọn

| # | Quyết định | Lý do |
|---|---|---|
| D1 | Không làm dark mode; xoá khối `.dark` trong `globals.css`; ép `Toaster` `theme="light"` | Code không có `ThemeProvider`, `.dark` chưa từng được bật; giữ khối cũ sẽ lệch token mới |
| D2 | Màu môn học giữ nguyên hoàn toàn (schema default, `SUBJECT_COLORS`, `subject-defaults.ts`, dữ liệu cũ) | Là dữ liệu người dùng/mã hoá phân loại, không phải màu giao diện; đổi mặc định cần migration + sửa nhiều test mà không đem lại gì |
| D3 | `--background` giữ trắng, thêm token `--page` cho nền trang | `Dialog`, `Sheet`, `Input`, nút `outline` đang dùng `bg-background`; đổi nó sang `#F6F7F9` sẽ làm xám các lớp đó |
| D4 | Bo góc qua token: `lg`/`xl` = 14px, `md` = 10px, `sm` = 8px | Thẻ đang `rounded-lg`, nút/ô nhập `rounded-md` → đạt mockup gần như không phải sửa từng file |
| D5 | Cấp học "Hỗn hợp" đổi indigo → slate trung tính | Bỏ indigo nhưng không dùng màu nhấn cho dữ liệu, tránh nhầm với trạng thái active |
| D6 | Sidebar giữ icon lucide ở 5 mục chính, không dùng chấm tròn như mockup | Giữ nhận diện/IA hiện có; mockup nhóm "Quản lý" cũng có icon |
| D7 | Tab bar mobile giữ `h-14` có icon + vạch active, không lên 68px | Không phải đổi padding đáy `main` và test "thẻ cuối không bị tab che" |
| D8 | Sheet "Thêm" phủ cả tab bar | Dùng `Sheet` sẵn có không sửa primitive |
| D9 | Chiều cao nút giữ `h-11 md:h-10` ở màn, primitive `h-10` | Theo quy ước A1; tránh đổi chiều cao nút trong bảng/dialog desktop |
| D10 | Header mobile giữ cấu trúc hiện tại (không thay lời chào bằng logo + tiêu đề trang như `DashboardMobile`) | Trang đã có `PageHeader`; đổi header là đổi IA, ngoài phạm vi màu/thẻ |
