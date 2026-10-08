# AE — Dọn lỗi nhỏ đợt 0.15.1 (design)

Ngày: 2026-10-08. Người dùng: "gom hết luôn sửa 1 thể, giao cho claude-otd làm".
Version `0.15.1` (patch). **Không migration, không cài thư viện.**

## 1. Phạm vi

Gom toàn bộ lỗi nhỏ còn tồn từ backlog, các lần review W/Z/AA/AB và 8 minor của AD (tour).

### 1.1 Bỏ khỏi đợt vì đã sửa từ trước (Claude kiểm code 2026-10-08)

| Mục cũ | Bằng chứng |
|---|---|
| Màu tiêu đề Excel sao lưu còn tím | `COLORS.primary` đã là `#0F766E` (`src/lib/constants.ts`) |
| Xoá HS / đổi khối so giờ UTC | `findUnfinishedLinks` dùng `vnToday` + `hasSessionEnded` (`student.service.ts`) |
| Ca huỷ bị màu cấp học đè | `SessionCard.tsx` chỉ gắn `session-card--*` khi `!isCancelled` |
| Popup mua gói Skeleton mãi | `PlanPurchaseDialog` có nhánh lỗi + nút Thử lại `meQuery.refetch()` |
| CurrentPlanBadge aria-label trên span | đã có `role="img"` khi có nhãn |
| Radio popup mua gói không đi bằng mũi tên | `handleRadioGroupKeyDown` đã gắn |
| Tab bar admin mobile không có số đơn chờ | `admin-tab-pending-count` đã có |
| Hộp góp ý 0 sao bấm mũi tên | kiểm lại: mũi tên chọn sao 1 và chuyển focus, đúng mẫu radio |

### 1.2 Sửa trong đợt này

**A. Số liệu / hiển thị**
- A1. Lịch: ô "hôm nay" lấy theo **ngày VN** (`vnDateParts`), không theo giờ máy.
- A2. Lỗi React #418 (hydration lệch) ở `/students`: tìm nguyên nhân thật rồi sửa. Tiêu chí: e2e mở `/students` không có lỗi hydration trên console.
- A3. Góp ý giới hạn 5 lần/24h: 2 request gửi cùng lúc không được vượt giới hạn (khoá theo user trong transaction).
- A4. `markSeen` Có gì mới: 2 tab ghi cùng lúc không được lùi version (ghi có điều kiện).

**B. Học phí**
- B1. Miễn (có lý do) thành công rồi đóng sheet ngay: không gửi lại ghi chú lần 2.
- B2. Miễn có lý do: ghi chú cũ giữ nguyên khoảng trắng của người dùng; chỉ bỏ qua ghi chú cũ khi nó toàn khoảng trắng.

**C. Điều hướng, trợ năng**
- C1. Admin có lối vào Hướng dẫn: mục "HD sử dụng" trong menu avatar admin, mở tab mới.
- C2. `/guide` khi đã đăng nhập: link cuối trang là "Về trang chính" (giáo viên → `/dashboard`, admin → `/admin/overview`) thay cho "Về trang đăng nhập".
- C3. Nút Có gì mới trên mobile: `onClick` gắn thẳng vào `Button`, có `aria-haspopup="dialog"`, bỏ `span` bọc ngoài.
- C4. `PopoverContent` Có gì mới có `aria-label`.
- C5. Thẻ Bắt đầu: thanh tiến độ có `role="progressbar"` + `aria-valuenow/min/max` + `aria-label`; tiêu đề là `h2`.
- C6. Link mở tab mới (HD sử dụng ở sidebar, sheet Thêm, link Hướng dẫn trong hộp Nhập Excel) có chữ ẩn "(mở tab mới)".

**D. Tour "Chỉ cho tôi"**
- D1. Bước 👆 trên một dòng (vd `tuition-row`): bấm nút / link nằm **bên trong** dòng không tính là bấm dòng; tour vẫn chờ.
- D2. Có gì mới tự mở sau khi tour tắt: chờ tới khi không còn hộp (`[role="dialog"][data-state="open"]`) nào mở.
- D3. Bước có phần tử nằm trong hộp cuộn được (vd `session-nav` trong chi tiết ca trên mobile): hộp vẫn cuộn được.
- D4. Tải trạng thái Bắt đầu lỗi → toast `tour_load_error`, tour không chạy, không kẹt cờ `tourActive`.
- D5. Chuyển trang hoặc bấm nút tour khác khi lần chạy trước còn đang chờ tải → lần chạy cũ bỏ, không hiện driver thứ 2 (gồm cả StrictMode dev).
- D6. Bước đầu chờ phần tử tối đa `TOUR_FIRST_WAIT_MS = 8000` ms (trang tải nguội); các bước sau giữ 3000 ms.
- D7. Bàn phím: khi tour đang hiện, mũi tên phải = Tiếp, mũi tên trái = Quay lại (chỉ khi nút đó đang hiện), **trừ khi** focus đang ở ô nhập / vùng tự xử lý mũi tên.
- D8. `driver.js/dist/driver.css` tải động cùng `driver.js`, không nằm trong bundle mọi trang.

**E. Ảnh hướng dẫn**
- E1. Chụp lại toàn bộ ảnh `/guide` không còn chân trang dev (version · sha · giờ build), rồi dựng lại file Word.

**F. Test**
- F1. `onboarding.test`: tách test "xoá mềm" thành từng điều kiện riêng (HS xoá, ca xoá) để chứng minh từng bộ lọc.

## 2. Thiết kế từng mục (chỉ chỗ cần quyết)

- **A3**: trong `$transaction` tương tác, `pg_advisory_xact_lock(7403, userId)` rồi mới đếm + tạo. Hằng `FEEDBACK_LOCK_NS = 7403` (7401, 7402 đã dùng).
- **A4**: đọc version hiện tại, so như cũ, ghi bằng `updateMany({ where: { id, lastSeenRelease: <giá trị vừa đọc> } })`; `count === 0` → đọc lại và trả giá trị mới nhất (không ghi đè).
- **B1**: ghi nhớ "giá trị đã lưu gần nhất" trong ref; Miễn thành công / blur lưu thành công cập nhật ref; lưu khi đóng sheet so với ref (fallback `row.notes`).
- **D1**: bỏ `{ once: true }`; trong handler, nếu `event.target.closest('button, a, input, select, textarea, [role="button"], [role="menuitem"], [role="checkbox"]')` khác `null` và khác chính target thì bỏ qua; ngược lại gỡ listener rồi sang bước.
- **D3**: CSS `.driver-active [role="dialog"].driver-active-element-parent-no-scroll { overflow-y: auto !important; }`. driver.js chỉ khoá cuộn **cha trực tiếp** của phần tử; với hộp Radix ta mở lại.
- **D5**: `runId` ref tăng mỗi lần chạy và khi `pathname` đổi; sau mỗi `await` lệch `runId` → bỏ, không gọi `end()` (lần chạy mới đang giữ cờ). Riêng khi đổi trang mà không có lần chạy mới → `setTourActive(false)`.
- **D7**: listener `keydown` trên `document` (capture) do `runTour` gắn/gỡ; bỏ qua khi target là `input, textarea, select, [contenteditable="true"], [role="radio"], [role="slider"], [role="combobox"], [role="option"], [role="menuitem"], [role="tab"]`.
- **C2**: `GuidePage` truyền thêm `home: "/dashboard" | "/admin/overview" | null` (null = chưa đăng nhập).
- **E1**: gắn `data-testid="build-info"` cho khối chân trang ở `AppSidebar` + `AdminSidebar`; `clean()` của script chụp ẩn nó. Người dùng đã đồng ý chạy lại `playwright.guide-shots.config.ts` (tự bật dev server như AA).

## 3. Kiểm thử

Mỗi mục có test đỏ trước (unit / integration / component), trừ:
- A2: e2e bắt console lỗi hydration (đỏ trước khi sửa nếu tái hiện được; không tái hiện được → STOP báo Claude, không đoán).
- D3, D8, D7: e2e trong `tests/e2e/ad-tour.spec.ts`.
- E1: chạy script chụp + `pnpm test tests/unit/lib/guide-docx-file.test.ts` (canh docx khớp ảnh).

Cuối: full `pnpm test` + full e2e 2 nửa, 1 lần.

## 4. Phát hành

`RELEASES` thêm `0.15.1`, `notify: false`, tiêu đề "Sửa lỗi nhỏ". `package.json` `0.15.1`.
