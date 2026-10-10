# AK — Gọn thanh lọc + thẻ "Còn nợ" tách tháng

**Ngày:** 2026-10-11 · **Bên code:** Claude-OTD · **Version:** 0.19.0 (đổi UI nhiều màn) · **Không migration, không đổi API lọc**

Nguồn:
- rà soát `.superpowers/claude-otd/bao-cao-AK.md`
- mẫu `.superpowers/mockups/ak-bo-loc/` (`00-pattern`, `01-lich`, `02-bao-cao`, `03-hoc-phi`)
- người dùng chốt ngày 2026-10-11.

## 1. Thẻ "Còn nợ" ở Tổng quan tách tháng này / các tháng trước

**Vấn đề:** thẻ chỉ ghi "Cộng dồn cả các tháng trước", không biết bao nhiêu là nợ tháng này, bao nhiêu là nợ cũ.

**Hành vi mới:** số tổng giữ nguyên. Dòng phụ thay bằng 2 dòng:
- `Tháng này <số> đ`
- `Các tháng trước <số> đ` (gộp mọi tháng cũ)

Luôn hiện cả 2 dòng, kể cả khi bằng 0 đ.

**Cách tính (mỗi HS, cộng lại):**
- `owed = isFullPaid ? 0 : max(0, totalAmountDue − paidAmount)`. Không đổi, đúng số tổng hiện nay.
- `prev = min(owed, max(0, previousBalance − paidAmount))`: tiền thu trừ nợ cũ trước, theo FIFO như spec Y.
- `tháng này = owed − prev`.

**Server:**
- `getMonthlyOutstanding` (`tuition.service.ts`) trả thêm `previousOutstanding`.
- `getDashboardStats` (`report.service.ts`) trả thêm `unpaidPrevMonths`.
- Trang Báo cáo không đổi.

**UI:** `src/app/(app)/dashboard/page.tsx`, thẻ "Còn nợ". Số tiền bọc `whitespace-nowrap`, để ở thẻ 2 cột 375px chỉ xuống dòng giữa nhãn và số. Thêm 2 khoá i18n vi/en: `unpaid_this_month_part` ("Tháng này" / "This month"), `unpaid_prev_months_part` ("Các tháng trước" / "Earlier months").

**Test:**
- Integration: chưa thu → tổng 400k, nợ cũ 200k.
- Integration: thu 300k trong tháng này → tổng 100k, nợ cũ 0.
- Unit trang Tổng quan: thấy 2 dòng đúng số.

## 2. Gọn thanh lọc mọi màn

**Pattern chung (một thanh):** `[ô tìm] · [1 ô hay dùng nhất, nếu có] · [Bộ lọc (n)] · [tháng/kỳ] · [⋯]`

Thanh nằm trên 1 hàng ở 1280px, tối đa 2 hàng ở 375px. Không có chữ hoặc nút nào gãy dòng.

**Quy tắc đặt ô lọc:**
1. **Ô tìm** giữ ngoài nếu danh sách có thể dài.
2. **Tháng/kỳ** (bước tháng, ReportPeriodPicker) giữ ngoài.
3. **Mỗi trang giữ tối đa 1 Select hay dùng nhất ở ngoài.** Học phí giữ "Trạng thái".
4. **Các Select còn lại vào nút "Bộ lọc"** (lớp, phiếu báo, học sinh, sau này nơi dạy/nơi học).
   - Laptop: mở popover `w-80`. Điện thoại: mở sheet đáy (dùng lại sheet hiện có của FilterBar).
   - **Chọn là áp dụng ngay.** Nút ghi số ô đang lọc, ví dụ "Bộ lọc (2)".
   - Popover và sheet có "Xoá lọc". Sheet có nút đóng "Xong".
5. **Đang lọc:** hiện 1 hàng chip dưới thanh, mỗi ô lọc trong Bộ lọc một chip "Lớp 5 ✕". Cuối hàng có "Xoá lọc". Bỏ nút "Xóa bộ lọc" đang chen giữa thanh Lịch.
6. **Nút chính** (Tạo / Thêm) đặt ở PageHeader. Nút có biến thể thì dùng nút tách ▾, như `AddStudentSplitButton`.
7. **Hành động phụ** vào menu `⋯`. **Ngoại lệ: trang Báo cáo giữ nút "Xuất Excel" ở ngoài** (điện thoại thu thành icon có `aria-label`).
8. **Tab trạng thái luôn cần** (Thùng rác 4 tab, admin…) giữ là tab, không vào Bộ lọc.
9. **Không nhớ bộ lọc** giữa các lần vào trang. Giữ như hiện nay, gồm cả tháng.

**Component:** nâng `src/components/common/FilterBar.tsx` (thêm prop, giữ tương thích chỗ đang dùng):
- `search`
- `primaryFilter` (1 ô ngoài)
- `filters` (vào Bộ lọc)
- `activeChips: { label: string; onRemove: () => void }[]`
- `onClearAll`
- `period` (tháng/kỳ)
- `moreActions: { label: string; icon?; onSelect: () => void }[]` (⋯)
- `actions` (nút ngoài, chỉ cho ngoại lệ như Xuất Excel ở Báo cáo)

Số "(n)" lấy từ `activeChips.length`.

**Từng màn:**

| Màn | Ngoài thanh | Vào Bộ lọc | ⋯ / PageHeader |
|---|---|---|---|
| **Lịch** (`CalendarToolbar` chuyển sang FilterBar) | tìm · bước tháng | lớp | PageHeader: **Tạo ca dạy ▾** (Lịch lặp, Chép lịch tháng); ⋯: Xuất Excel |
| **Báo cáo** | kỳ báo cáo (nhãn khoảng rút gọn "T1–T3/2026", cắt chữ không tràn ở 360px) · Xuất Excel | lớp (hoặc khoá Pro như cũ), học sinh | ⋯: các xuất khác nếu có |
| **Học phí** | tìm · **Trạng thái** · bước tháng | phiếu báo, lớp | — |
| **Học sinh** | tìm | lớp, trạng thái | PageHeader: **Thêm học sinh ▾** (như cũ); ⋯: Nâng lớp hàng loạt |
| **Thùng rác** | 4 tab: điện thoại 1 hàng cuộn ngang `overflow-x-auto`, không bóp chữ | — | ⋯ cạnh tab: Dọn tab này, Dọn sạch thùng rác (giữ hộp xác nhận cũ) |

Các màn admin, Môn học, Tổng quan, Cài đặt không đổi.

**Giữ nguyên hành vi:**
- Lọc ra đúng kết quả như trước, chỉ đổi chỗ đặt.
- Giữ khoá gói (LockBadge) như cũ.
- Mọi nút cao ≥ 44px trên điện thoại.

**Test:**
- Unit `FilterBar`:
  - popover mở trên laptop, sheet mở trên điện thoại
  - số (n) đúng
  - chip ✕ gọi `onRemove`, "Xoá lọc" gọi `onClearAll`
  - mục ⋯ gọi `onSelect`
- Unit/e2e các trang đã đổi:
  - lọc vẫn ra đúng
  - Tạo ca dạy ▾ mở Lịch lặp và Chép lịch tháng
  - Nâng lớp hàng loạt nằm trong ⋯
- Sửa test cũ chỉ khi đúng hành vi mới.
- **Ảnh 375 + 1280 trước/sau** từng màn đã đổi, tự xem. Tiêu chí:
  - 1280 một hàng
  - 375 tối đa 2 hàng
  - không cuộn ngang, không chữ gãy

## Ngoài phạm vi (ghi backlog)

- Ô tìm ở admin Tài khoản & gói.
- Ghi nhớ bộ lọc.
- AccountTrend `w-full`.
- Màn mới của đợt Nơi dạy (Bảng công, Chuyên cần, Học phí có nơi học): khi code sẽ dùng luôn FilterBar mới.
