# Thiết kế: A1 — UI mobile-first, thống nhất các màn, làm rõ nhãn số liệu

- **Ngày:** 2026-09-25
- **Nhánh code (dự kiến):** `feat/a1-ui-mobile-first`
- **Trạng thái:** Chờ duyệt spec → viết plan → code

## 0. Lộ trình tổng (đã chốt với người dùng)

Người dùng: **1 giáo viên dạy kèm**, phụ huynh chỉ nhận ảnh/tin nhắn qua Zalo.

| # | Phần | Phụ thuộc | Ghi chú |
|---|---|---|---|
| **A1** | UI mobile-first + thống nhất các màn + nhãn số liệu | — | **Spec này** |
| A2 | Màn Quản lý môn học (UI cho router `subject.*` đã có) | A1 | Đặt trong menu avatar |
| A3 | Làm mới phong cách (màu, thẻ, bo góc) | A1, A2 | Duyệt mockup qua Claude Design / Artifact **trước** khi code |
| B | Lịch sử thu tiền (bảng `Payment`) | — | |
| C | Phiếu báo học phí + QR VietQR | B | |
| D | Cảnh báo trên Dashboard | B | |
| E | Nhập học sinh từ Excel | — | |
| F | Sao lưu / xuất toàn bộ dữ liệu | B | |
| G | Link chỉ-đọc cho phụ huynh | B, C | |

Mỗi phần có spec → plan → code riêng.

## 1. Bối cảnh & vấn đề

Audit bản production (2026-09-25) ở 1568px và 390px:

1. **Dialog điểm danh vỡ ở 390px** (thao tác dùng hằng ngày): bảng tràn ngang, nút đóng đè nút ⋮, ô ghi chú ~20px, nút "Lưu điểm danh" bị cắt, khoảng trắng lớn phía trên.
2. **Học sinh (mobile) vẫn là bảng**: mất cột học phí/SĐT, badge cấp học xuống dòng; 5 hàng bộ lọc + nút trước khi thấy dữ liệu. Học phí đã dùng thẻ → lệch nhau.
3. **Dashboard mobile 2 cột** làm số tiền gãy dòng ("10.110.000 / đ").
4. Tiêu đề trang, header bảng (HOA/thường), vị trí bộ lọc khác nhau giữa các màn.
5. Mặc định **5 dòng/trang** ở Học sinh, Học phí.
6. **Bug**: thẻ ca trên lưới lịch chỉ hiện "· 3 HS", mất tên môn — `SessionCard.tsx:16` dùng `session.title ?? session.subject.name`, `title = ""` không rơi về tên môn.
7. Màu viền thẻ ca (theo cấp học) không có chú thích.
8. **Nhãn tiền gây hiểu nhầm** (logic đúng, nhãn sai):
   - "Doanh thu tháng này … học phí thu được" thực chất là tổng `fee` buổi có mặt/muộn, **không phải tiền đã nhận** (Báo cáo cùng lúc ghi "Đã thu: 0 đ").
   - "Doanh thu kỳ vọng" gồm cả buổi chưa diễn ra → "Hụt" giữa tháng không phải tiền mất.
   - "Nợ phí tháng này" là nợ **cộng dồn** các tháng (chủ đích, xem `getMonthlyOutstanding`), nên lớn hơn doanh thu tháng.
9. Báo cáo trống phía dưới khi chưa chọn học sinh.
10. "Lối tắt nhanh" trên Dashboard trùng sidebar.

Màn Lịch mobile (lưới chấm + danh sách ca ngày chọn) đang tốt → giữ.

## 2. Quyết định thiết kế (đã chốt)

| # | Quyết định | Lựa chọn |
|---|---|---|
| Q1 | Mức thay đổi | **Giữ nhận diện** (màu, font Geist, shadcn, lucide, IA). Làm mới phong cách để A3 |
| Q2 | Điều hướng mobile | **Thanh tab dưới đáy 5 mục**; desktop giữ sidebar |
| Q3 | Cách triển khai | **Tách khối dùng chung** rồi chuyển từng màn (không vá class từng màn, không đổi design system) |
| Q4 | Nhãn tiền | Chỉ đổi chữ + dòng giải thích; **không đổi logic tính** |
| Q5 | Dark mode | Không làm trong A1 |

## 3. Phạm vi

### Trong phạm vi
- Khung app: bottom tab bar (mobile), header mobile gọn, `100dvh`.
- 4 khối dùng chung: `PageHeader`, `FilterBar`, `ResponsiveList`, `StatCard`.
- Chuyển 5 màn: Dashboard, Lịch, Học sinh, Học phí, Báo cáo.
- Dialog chi tiết ca + điểm danh dạng thẻ trên mobile.
- Sửa bug tên môn trên `SessionCard`, thêm chú thích màu.
- Đổi nhãn tiền (vi + en), thêm `totalPaid` vào `report.dashboard`.
- Mặc định 20 dòng/trang.
- Test unit / integration / e2e mobile.

### Ngoài phạm vi (YAGNI)
- Thiết kế lại form tạo/sửa ca, form học sinh, `TuitionDetailSheet`, `BulkCreateDialog` — chỉ kiểm tra không vỡ ở 390px, vỡ thì sửa tại chỗ.
- Đổi màu, font, icon library, bo góc tổng thể (A3).
- Dark mode, animation.
- Màn Môn học (A2).
- Đổi URL/route, đổi logic tính tiền.

## 4. Kiến trúc

### 4.1 Khung app (`src/components/layout/`)

- `AppLayout.tsx`
  - `h-screen` → `h-[100dvh]`.
  - Mobile (< `md`): bỏ drawer + state `mobileOpen`; render `<BottomTabBar />` cố định đáy; `main` thêm padding đáy = chiều cao tab bar + `env(safe-area-inset-bottom)`.
  - Desktop (≥ `md`): giữ `AppSidebar` như cũ.
- `BottomTabBar.tsx` (mới): 5 tab (icon + nhãn) dùng **cùng mảng nav với `AppSidebar`** (tách mảng ra hằng dùng chung để không lệch). Tab active tô màu nhấn hiện tại. Mỗi tab cao ≥ 56px, vùng chạm ≥ 44px.
- `AppHeader.tsx`: bỏ nút ☰ (`onToggleSidebar`); hiện lời chào (cả mobile) + nút ngôn ngữ + avatar; tên màn nằm ở `PageHeader`.
- `DataTablePagination` (đang `fixed bottom-0`): trên mobile đặt ngay trên tab bar.
- `AppSidebar.tsx`: bỏ prop `onNavigate` nếu không còn ai dùng.

### 4.2 Khối dùng chung (`src/components/common/`, mới)

| Khối | Props chính | Hành vi |
|---|---|---|
| `PageHeader` | `title`, `description?`, `actions?: ReactNode` | Tiêu đề trái, thao tác phải; mobile thao tác xuống dòng dưới tiêu đề |
| `FilterBar` | `search: {value, onChange, placeholder}`, `filters?: ReactNode`, `activeCount?: number`, `trailing?: ReactNode` | Desktop: ô tìm + các filter một hàng. Mobile: ô tìm + nút "Lọc (n)" mở `Sheet` đáy chứa `filters` |
| `ResponsiveList<T>` | `items: T[]`, `columns` (header + cell), `renderCard(item)`, `getKey`, `isLoading`, `isError`, `emptyText`, `onRetry?` | ≥ `md`: `Table`; < `md`: danh sách thẻ. Skeleton đúng hình khi loading, trạng thái rỗng, lỗi có nút thử lại |
| `StatCard` | `label`, `value`, `hint?`, `icon?`, `tone?` | Số tiền `whitespace-nowrap`, cỡ chữ co theo breakpoint; không gãy dòng ở 390px |

Mẫu thẻ/bảng hiện có ở `tuition/page.tsx:143` và `:206` là nguồn để tách `ResponsiveList`.

### 4.3 Quy ước chung
- Header bảng chữ thường ở mọi màn (bỏ `uppercase`).
- Mặc định 20 dòng/trang (Học sinh, Học phí).
- Vùng chạm ≥ 44px trên mobile.
- Bo góc: dùng `rounded-lg` của shadcn; bỏ `rounded-2xl` lẻ ở Học phí.
- Chuỗi UI mới không dùng dấu gạch dài (—/–); dùng `-` hoặc tách câu.

## 5. Chi tiết từng màn

### 5.1 Chi tiết ca + điểm danh (`SessionDetailDialog`, `AttendancePanel`)
- Header: nút ⋮ và nút đóng tách riêng, không chồng lấn.
- Mobile: mỗi học sinh là **một thẻ**
  - Dòng 1: tên + lớp; phải là 2 nút lớn **Có mặt** / **Vắng** (≥ 44px).
  - Dòng 2: học phí (`currency-input`) + ghi chú (full width).
  - Xóa học sinh khỏi ca: giữ nút thùng rác cuối hàng (đã có hộp xác nhận).
- Thanh hành động **sticky đáy**: "Tất cả có mặt", "Không học", "Lưu điểm danh".
- Desktop: giữ bảng, chỉ sửa header.
- Hành vi lưu/điểm danh không đổi.

### 5.2 Học sinh (`StudentList`, `students/page.tsx`)
- `PageHeader`: nút "Thêm học sinh"; "Nâng lớp hàng loạt" trên mobile chỉ hiện icon (có `aria-label`), desktop hiện chữ.
- `FilterBar`: tìm tên; filter lớp + trạng thái nằm trong sheet (mobile).
- `ResponsiveList`: thẻ gồm tên, lớp + cấp, học phí/buổi, SĐT phụ huynh (link `tel:`), menu ⋯ (sửa, ngừng học…).

### 5.3 Học phí (`tuition/page.tsx`)
- Dùng `PageHeader` (bộ chọn tháng ở `actions`), `FilterBar`, `ResponsiveList` thay code thẻ/bảng tự viết.
- Cột thao tác desktop: nút có chữ "Ghi nhận" thay icon trơn.

### 5.4 Dashboard (`dashboard/page.tsx`)
- `StatCard`. Mobile ưu tiên 4 số: **Ca hôm nay, Học phí đã dạy, Đã thu, Còn nợ**; các số còn lại (tổng HS, ca tháng, tỉ lệ điểm danh, học phí dự kiến) trong mục "Xem thêm" (thu gọn). Desktop hiện đủ.
- Bỏ "Lối tắt nhanh"; thay bằng **"Ca dạy hôm nay"**: danh sách ca (giờ, môn, số HS), chạm mở `SessionDetailDialog`. Dữ liệu từ `session.getMonth` của tháng hiện tại, lọc theo ngày hôm nay (múi giờ VN, dùng helper ngày sẵn có). Rỗng: "Hôm nay không có ca dạy".
- Backend: `report.dashboard` trả thêm `totalPaidMonth` — cùng cách tính `totalPaid` của `monthlySummary` (không lọc khối).

### 5.5 Báo cáo (`reports/page.tsx`)
- `PageHeader` (Xuất Excel ở `actions`), `FilterBar` (tháng, lớp, học sinh), `StatCard`.
- Chưa chọn học sinh: khối hướng dẫn "Chọn một học sinh để xem chi tiết" thay khoảng trống.

### 5.6 Lịch (`calendar/page.tsx`, `MonthCalendar`, `SessionCard`, `FilterBar` cũ)
- Sửa bug: `session.title ?? session.subject.name` → `session.title || session.subject.name` (cả chỗ `title` tooltip nếu cần).
- Chú thích màu phía trên lưới (desktop) / dưới thanh công cụ (mobile): Tiểu học, THCS, Hỗn hợp, Đã hủy.
- Thanh công cụ mobile: nút lịch lặp có chữ "Lịch lặp"; nút tạo ca hiện đủ chữ "Tạo ca dạy" trên mobile.
- Giữ nguyên bố cục lịch mobile.

> `src/components/filters/FilterBar.tsx` hiện là thanh công cụ riêng của Lịch (tìm, lớp, tháng, Xuất Excel, Lịch lặp, Tạo ca), chỉ `MonthCalendar.tsx` import. Đổi tên thành `src/components/calendar/CalendarToolbar.tsx` để không trùng với khối chung `common/FilterBar.tsx`. Lịch **không** chuyển sang `FilterBar` chung.

## 6. Nhãn số liệu (vi.json / en.json)

Chỉ đổi giá trị; key cũ giữ nếu còn dùng, key thừa thì xóa. Giữ parity vi/en.

| Hiện tại | Mới | Dòng giải thích |
|---|---|---|
| Doanh thu kỳ vọng | **Học phí dự kiến** | Tính theo tất cả ca đã xếp trong tháng |
| Doanh thu tháng này / Doanh thu thực tế | **Học phí đã dạy** | Buổi có mặt và muộn, chưa phải tiền đã nhận |
| Đã thu | **Đã thu** | Tiền đã ghi nhận trong tháng |
| Nợ phí tháng này / Số tiền học sinh chưa đóng | **Còn nợ** | Cộng dồn cả các tháng trước |
| Hụt: | **Chưa tính:** | Gồm buổi vắng và buổi chưa diễn ra hoặc chưa điểm danh |

Bản tiếng Anh: Expected fees / Taught fees / Collected / Outstanding / Not yet counted.

## 7. Lỗi & trạng thái

- Mọi danh sách qua `ResponsiveList` có loading (skeleton), rỗng, lỗi (nút thử lại gọi `refetch`).
- `StatCard` khi chưa có dữ liệu: skeleton thay vì "0 đ".
- Không thêm xử lý lỗi mới ngoài các trạng thái trên.

## 8. Kiểm thử

- **Unit (Vitest)**: `SessionCard` hiện tên môn khi `title = ""` (viết test fail trước, rồi sửa).
- **Unit** (`// @vitest-environment jsdom`, theo quy ước trong `vitest.config.ts`): `ResponsiveList` render đúng trạng thái loading/rỗng/lỗi. Việc chọn bảng hay thẻ theo breakpoint là CSS nên phủ bằng e2e.
- **Integration**: `report.dashboard.totalPaidMonth` bằng `report.monthlySummary.totalPaid` của cùng tháng.
- **E2E (Playwright)** `tests/e2e/mobile.spec.ts`, viewport 390×844:
  - Bottom tab bar chuyển đủ 5 màn.
  - Mở một ca → điểm danh → `document.documentElement.scrollWidth <= 390`, nút "Lưu điểm danh" visible.
  - Học sinh hiện thẻ, không hiện `table`.
  - Mỗi màn: `scrollWidth <= 390`.
- Rà `auth/calendar/students/upgrade-class.spec.ts`: sửa selector phụ thuộc nút ☰, "Lối tắt nhanh", nút "Nâng lớp hàng loạt" (mobile chỉ còn icon).
- **Kiểm tra bằng mắt**: chụp 5 màn ở 390px và 1440px trên bản preview Vercel; người dùng duyệt trước khi merge.

## 9. Tiêu chí hoàn thành

1. Không màn nào tràn ngang ở 390px.
2. Điểm danh một ca trên mobile không cuộn ngang, nút Lưu luôn thấy.
3. 5 màn dùng `PageHeader`; `FilterBar` / `ResponsiveList` / `StatCard` ở nơi áp dụng.
4. Nhãn tiền thống nhất giữa Dashboard và Báo cáo, có dòng giải thích.
5. `pnpm lint`, `pnpm test`, e2e pass.

## 10. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| E2E cũ gãy do đổi layout | Rà và sửa selector trong cùng nhánh; ưu tiên `getByRole` |
| `ResponsiveList` generic phình to | Chỉ hỗ trợ đúng nhu cầu 2 màn (Học sinh, Học phí); không sort/select |
| Người dùng quen nút "Nâng lớp hàng loạt" ở ngoài | Vẫn ở chỗ cũ; mobile chỉ còn icon, có `aria-label` |
| Nội dung dài bị che bởi tab bar | Padding đáy `main` + safe-area; kiểm tra trong e2e |
