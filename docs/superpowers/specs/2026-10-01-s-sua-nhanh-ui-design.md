# S — Sửa nhanh giao diện (bộ lọc, ngân hàng, lưu phiếu, xem ca liên tiếp, lớp trên thẻ ca)

> Ngày: 2026-10-01 · Người duyệt: chủ ứng dụng · Phiên bản khi lên: **0.8.1** (patch — không bắt đăng nhập lại).
> O3 (dọn dẹp mã hoá) đổi thành **0.8.2**. Phần T (học phí theo tháng) và V (đã gửi phiếu) có spec riêng, làm SAU S.

## 1. Mục tiêu

5 sửa đổi nhỏ, không đụng logic tiền, không migration:

| # | Việc | Người dùng được gì |
|---|---|---|
| S1 | Bộ lọc thành 1 hàng riêng ngay trên bảng, dồn trái | Ô tìm + các bộ lọc liền nhau, không bị đẩy sang phải |
| S2 | Ô chọn ngân hàng có ô tìm | Gõ "vcb", "vietcom", "quân đội" ra ngay |
| S3 | Lưu phiếu báo học phí vào thư viện Ảnh trên điện thoại | Không phải vào Tệp/Tải xuống tìm file .png |
| S4 | Trong chi tiết ca: ← → xem ca trước/sau trong tháng | Rà điểm danh cả tháng nhanh |
| S5 | Thẻ ca trên lịch tháng hiện lớp | `Tiếng Anh · Lớp 5 · 3 HS` |

## 2. S1 — Bộ lọc (FilterBar)

Hiện tại (`src/components/common/FilterBar.tsx:41`) nhóm bộ lọc có `md:ml-auto` (thêm ở K Task 6b) → bị đẩy sát mép phải, cách xa ô tìm.

**Chốt (người dùng chọn "Hàng riêng, dồn trái"):**
- Hàng tiêu đề (`PageHeader`: tiêu đề + nút hành động) giữ nguyên ở trên.
- Hàng bộ lọc là hàng riêng, ngay trên bảng: `[ô tìm] [lọc 1] [lọc 2] …` nằm liền nhau **từ trái sang**, cùng chiều cao (`h-10` desktop), khoảng cách `gap-2`.
- Ô tìm rộng cố định trên desktop (`md:w-72`, không `flex-1`) để bộ lọc đứng sát ngay sau nó.
- Nhiều bộ lọc quá bề ngang → xuống dòng (`flex-wrap`), vẫn dồn trái.
- Mobile (< md) giữ như cũ: ô tìm chiếm hết hàng + nút "Lọc (n)" mở sheet dưới.
- Áp dụng cho mọi trang dùng `FilterBar`: Học sinh, Học phí, Báo cáo. Không đổi nội dung bộ lọc.

## 3. S2 — Tìm ngân hàng

`BankAccountCard.tsx:96` dùng `Select` 27 ngân hàng, không tìm được.

**Chốt:** thay bằng combobox có ô tìm (Popover + Input + danh sách, dùng `@radix-ui/react-popover` đã có; **không thêm thư viện**).
- Nút mở giữ `id="bank-bin"`, `role="combobox"`, nhãn "Ngân hàng" (e2e đang chọn theo `getByRole('combobox', { name: 'Ngân hàng' })`), hiện `shortName - name` của ngân hàng đã chọn hoặc placeholder.
- Mở ra: ô tìm tự focus, gõ lọc theo `shortName`, `name` **không dấu, không phân biệt hoa thường** (dùng `removeVietnameseTones` có sẵn trong `@/lib/utils`) và theo `bin`.
- Thêm bí danh hay gõ: `vcb`→Vietcombank, `ctg`/`vietin`→VietinBank, `tcb`→Techcombank, `mb`/`quan doi`→MB, `vpb`→VPBank, `acb`, `bidv`, `agri`→Agribank, `stb`/`sacom`→Sacombank, `tpb`→TPBank, `hdb`→HDBank, `vib`, `shb`, `ocb`, `msb`, `seab`→SeABank, `lpb`→LPBank. Bí danh là trường `aliases?: string[]` mới trong `VN_BANKS` (chỉ ngân hàng có trong danh sách).
- Danh sách mỗi dòng là `role="option"` hiển thị `shortName - name`; bấm chọn → đóng, focus về nút. Phím ↑↓ Enter Esc hoạt động.
- Không có kết quả → dòng "Không tìm thấy ngân hàng".
- Mobile: danh sách cao tối đa 50vh, cuộn trong; mỗi dòng ≥ 44px.

## 4. S3 — Lưu phiếu vào thư viện Ảnh

`TuitionNoticeDialog.tsx` hiện có "Chia sẻ" (khi `navigator.canShare` files) + "Tải ảnh" (`saveAs` .png → vào Tệp/Tải xuống).

**Chốt (người dùng chọn làm cả iPhone lẫn Android):**
- **Desktop (≥ md):** giữ nguyên "Tải ảnh" (tải file) + "Chia sẻ" nếu có.
- **Mobile (< md):** nút chính đổi thành **"Lưu ảnh"** (icon `ImageDown`):
  - Mở màn xem ảnh toàn màn hình (Dialog phủ kín, nền đen) hiện **chính ảnh phiếu đã chụp** bằng `<img src={objectURL(blob)}>` — ảnh thật nên nhấn giữ được, trình duyệt hiện menu "Lưu vào Ảnh" (iOS) / "Tải hình ảnh xuống" (Android, ảnh vào thư viện).
  - Dòng hướng dẫn cố định dưới ảnh: **"Nhấn giữ ảnh → chọn Lưu vào Ảnh / Tải hình ảnh xuống"**.
  - Nếu `canShareFiles()`: thêm nút **"Mở bảng chia sẻ"** ngay dưới (bảng chia sẻ iOS có "Lưu hình ảnh"; gửi thẳng Zalo cũng được).
  - Nút "Đóng" (≥ 44px). Đóng thì `URL.revokeObjectURL`.
- Nút "Chia sẻ" cũ trên mobile giữ nguyên bên cạnh.
- Ảnh dùng lại đúng `blob` đã tạo sẵn (không chụp lại); đang tạo → nút loading như hiện tại; chụp lỗi → nút mờ như hiện tại.
- Tên file (khi tải) giữ `phieu-bao-hoc-phi-T{m}-{y}-{ten}.png`.

## 5. S4 — Xem ca trước/sau trong tháng

`SessionDetailDialog` mở từ `MonthCalendar` (và từ Dashboard — **Dashboard không có điều hướng**).

**Chốt:**
- Danh sách để đi = **các ca đang hiển thị trên lịch tháng đang xem** (đúng kết quả `session.getMonth` với bộ lọc đang bật — lọc theo HS thì chỉ đi qua ca của HS đó), sắp theo ngày rồi giờ bắt đầu, **gồm cả ca đã huỷ** (lịch cũng hiện), không có ca đã xoá (getMonth không trả).
- Đầu hộp thoại có thanh: `[‹]  Ca 12/60  [›]`. Nút ≥ 44px trên mobile, `aria-label` "Ca trước"/"Ca sau".
- Ca đầu tháng: `‹` disabled; ca cuối: `›` disabled. **Không** nhảy sang tháng khác.
- Desktop: phím **← →** (và ↑ ↓) đổi ca khi hộp thoại mở và focus **không** nằm trong ô nhập/textarea/select/combobox (để gõ ghi chú điểm danh không bị nhảy ca).
- Mobile: vuốt ngang trên phần đầu hộp thoại (≥ 60px, ngang nhiều hơn dọc) = đổi ca; nút vẫn là cách chính.
- Đổi ca = đổi `session` đang xem (query chi tiết theo id mới); hộp con (thêm HS, học bù, xoá…) đang mở thì **không** đổi ca.
- Điểm danh có thay đổi chưa lưu: giữ đúng hành vi hiện có của `AttendancePanel` khi đóng hộp thoại (không thêm cảnh báo mới).
- Props mới của `SessionDetailDialog`: `siblings?: SessionListDTO[]` và `onNavigate?: (s: SessionListDTO) => void`. Không truyền → không hiện thanh điều hướng (Dashboard giữ nguyên).

## 6. S5 — Lớp trên thẻ ca

**Chốt:**
- Server: `toDTO` trong `session.service.ts` thêm `grades: number[]` = các lớp khác nhau của HS trong ca (từ `sessionStudents[].grade`, bỏ `grade <= 0`), tăng dần. `SessionListDTO` thêm `grades: number[]`.
- Hàm `formatGrades(grades, t, compact)` ở `src/lib/format-grades.ts`:
  - `[]` → `""` (ca chưa có HS không hiện lớp)
  - `[5]` → `Lớp 5`
  - `[4, 5]` → `Lớp 4, 5`
  - dãy liên tiếp ≥ 3 lớp gộp gạch: `[3,4,5]` → `Lớp 3–5`; `[3,4,5,8]` → `Lớp 3–5, 8`
  - `compact = true` (thẻ lịch mobile): `L5`, `L4, 5`, `L3–5`
  - Tiếng Anh: `Grade 5`, `G5`.
- `SessionCard` (lịch tháng): dòng 2 = `{label} · {lớp} · {n} HS` (bỏ phần trống nếu không có lớp/HS). Màn < md dùng compact.
- `SessionListItem` (danh sách ca ngày trên mobile): thêm lớp trước số HS: `Lớp 5 | 3 học sinh`.
- Màu theo cấp giữ nguyên.

## 7. Không làm trong S
- Học phí theo tháng (T), đánh dấu đã gửi phiếu (V), tra tên chủ tài khoản, tự xác nhận chuyển khoản.
- Không đổi bộ lọc của Lịch (CalendarToolbar), chỉ FilterBar.

## 8. Kiểm thử
- Unit: `formatGrades` (mọi dạng ở mục 6, vi + en, compact); lọc ngân hàng (`searchBanks`: không dấu, bí danh, bin, rỗng → đủ 27).
- Component (Vitest + Testing Library): FilterBar desktop không còn `ml-auto`, ô tìm không `flex-1` ở md; BankSelect gõ "vcb" chỉ còn Vietcombank, Enter chọn; SessionDetailDialog với `siblings` 3 ca: hiện "Ca 2/3", ← → đổi, ca đầu disabled ‹, phím mũi tên trong textarea không đổi ca, không truyền siblings thì không có thanh.
- Integration: `session.getMonth` trả `grades` đúng (HS lớp 4 và 5 → `[4,5]`; HS đã xoá không tính).
- E2E (390px + 1280px): lịch tháng thấy "Lớp 5" trên thẻ; mở chi tiết ca → bấm › 2 lần → "Ca 3/n"; Cài đặt → tìm "vcb" chọn Vietcombank lưu được; phiếu báo mobile → "Lưu ảnh" hiện ảnh `<img>` + dòng hướng dẫn; trang Học sinh 1280px: ô tìm và bộ lọc cùng hàng, bộ lọc bắt đầu ngay sau ô tìm (x của bộ lọc đầu < x ô tìm + 300px). Không tràn ngang ở 390px.
- Hồi quy: full `pnpm test` + full e2e.
