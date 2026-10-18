# AR — Dọn lỗi nhỏ + bộ lọc màn Tài khoản (design)

Ngày: 2026-10-12. Người dùng chốt danh sách 11 lỗi nhỏ ("ok") và thêm: màn `/admin/accounts` phải có ô tìm theo tên đăng nhập hoặc họ tên, lọc khoảng ngày tạo, sắp mới nhất → cũ nhất hoặc ngược lại (hiện chỉ cũ → mới, muốn xem user mới phải sang trang cuối).

Version `0.26.0` (minor, vì có tính năng mới). **Không migration, không cài thư viện, không đổi API server.**

## 1. Bộ lọc màn Tài khoản (tab Đang dùng)

Dữ liệu: `admin.overview.users` đã trả **toàn bộ** tài khoản chưa xoá (43 dòng trên prod) và đang phân trang phía client (`usePagination`). Lọc + sắp cũng làm phía client, không đổi server.

- **Thanh lọc** dùng `FilterBar` dạng gọn (giống màn Học sinh), đặt giữa hàng tab và bảng, chỉ ở tab Đang dùng.
  - `search`: placeholder "Tìm tên đăng nhập hoặc họ tên". Khớp khi `username` hoặc `fullName` chứa chuỗi gõ, dùng `normalizeForSearch` (không phân biệt hoa thường, vẫn phân biệt dấu, giống tìm HS). Bỏ khoảng trắng hai đầu chuỗi gõ. Ô tìm debounce như StudentList (`useDebouncedSearch`) hoặc lọc ngay (43 dòng, lọc ngay là được; chọn cách đơn giản hơn).
  - `primaryFilter`: ô chọn **Sắp xếp** với 2 lựa chọn "Mới nhất" (mặc định) / "Cũ nhất", theo `createdAt`, hoà thì theo `id` cùng chiều.
  - `filters` (popover desktop / sheet mobile): **Tạo từ ngày** và **Đến ngày**, 2 ô `<Input type="date">` như `SetPlanDialog`. Cả hai tuỳ chọn, bao gồm cả 2 đầu, so theo **ngày VN** của `createdAt` (`vnDayKey`). Từ ngày > Đến ngày → không lỗi, hiện danh sách rỗng (đúng logic), không cần chặn.
  - `activeChips`: chip "Từ dd/MM/yyyy", chip "Đến dd/MM/yyyy" (mỗi chip bấm để bỏ). Sắp xếp không tạo chip. `onClearAll` xoá cả ngày lẫn ô tìm.
- Đổi tìm / ngày / sắp → về trang 1.
- Dòng "Hiển thị 1-20 trong N bản ghi" đếm theo danh sách **sau lọc**.
- Lọc ra rỗng: thay "-" bằng chữ "Không có tài khoản phù hợp".
- Trạng thái lọc không lưu (tải lại trang về mặc định: Mới nhất, không lọc).
- Tab Đã xoá: không đổi (ít dòng).
- Mobile 375: hàng 1 = ô tìm + ô Sắp xếp; nút Lọc cùng hàng hoặc xuống hàng như FilterBar đang làm; không cuộn ngang.
- Kèm HD sử dụng (luật "Hướng dẫn đi cùng tính năng"): màn admin không có mục trong `/guide` (guide dành cho giáo viên), nên **không** cần mục/ảnh/tour. Ghi rõ trong release note.

## 2. Lỗi nhỏ (người dùng chốt mục 1–11)

**A. Hiển thị điện thoại**
- A1. `TuitionNoticeCard` variant `default` bỏ `style={{ width: 360 }}`, dùng `w-full max-w-[360px]` như `PlaceNoticeCard` (AN). Trang phụ huynh `/p/<token>` ở 360px: không cuộn ngang, thẻ cách mép ≥ 16px. Ảnh phiếu tải về (`TuitionNoticeDialog`, chụp thẻ thành ảnh) vẫn đúng 360px rộng như cũ: kiểm lại và giữ nguyên kích thước ảnh xuất.
- A2. `SubjectList`: tên môn dài ở 375 hiện đủ (xuống dòng, `break-words`), không còn "…", giống cách AL đã sửa lưới Nơi dạy (tra commit FIX AL của PlaceList để làm cùng kiểu).
- A3. Nút X mặc định của `DialogContent` (`src/components/ui/dialog.tsx`) và `SheetContent` (`sheet.tsx`): vùng bấm ≥ 44px trên mobile (`size-11`, icon giữ 16px, căn lại vị trí để không lệch tiêu đề), desktop có thể giữ nhỏ (`md:size-9`). Không đổi các hộp đã tự nới (PlanPurchaseDialog).

**B. Hành vi**
- B1. Dashboard 390px: sheet "Chi tiết học phí" mở từ dòng nợ đóng được bằng Escape. Test `tests/e2e/dashboard-alerts.spec.ts:59` đỏ từ AK; **tìm nguyên nhân thật** (systematic-debugging) rồi sửa code, không sửa test cho qua. Nếu gốc là test sai (vd chờ sai phần tử) thì sửa test và ghi Ruling kèm bằng chứng.
- B2. `TuitionDetailSheet` ghi chú: blur ô ghi chú rồi bấm X ngay → chỉ gửi **1** lần lưu ghi chú (hiện gửi 2).
- B3. Tour/Có gì mới: (a) `TourRunner` + `WhatsNew` coi `[role="alertdialog"][data-state="open"]` cũng là hộp đang mở (hiện chỉ `role="dialog"`); (b) tour nối tour (`nextTour`) không bị Có gì mới chen vào giữa: trong khoảng chuyển tour, cờ đang chạy tour vẫn bật.

**C. Định dạng tiền**
- C1. `CurrencyInput` hiện dấu chấm nghìn kiểu VN (`185.000`) thay cho `185,000`. Gõ tiếp vẫn đúng (bỏ mọi ký tự không phải số trước khi parse). Áp dụng toàn app (10 chỗ dùng). Cập nhật test cũ đang kỳ vọng dấu phẩy (đổi kỳ vọng vì đúng hành vi mới, ghi Ruling).

**D. Test và kỹ thuật**
- D1. `tests/e2e/filter-bar-align.spec.ts:14` lúc đỏ lúc xanh khi chạy trong lô (lần đầu login về `/login?expired=1`, sau đó `boundingBox()` null). Tìm gốc, sửa để chạy trong lô ổn định (chạy cả file 3 lần liền xanh, và xanh trong full e2e).
- D2. `tests/e2e/auth.spec.ts:107` (token lệch epoch) lúc đỏ lúc xanh. Tìm gốc, sửa như D1.
- D3. `submitFeedback` (`feedback.service.ts`): transaction dùng `timeout`/`maxWait` 10s như `TX_OPTIONS` của payment, không để mặc định 5s.
- D4. `src/types/css.d.ts`: chỉ khai báo `declare module "driver.js/dist/driver.css"`, bỏ `*.css` chung. `tsc` sạch.

## 3. Không làm

- Hướng dẫn cài payOS có ảnh: đợt riêng sau.
- Tách `.env` prod: người dùng để sau.
- Lọc/sắp ở tab Đã xoá, lưu bộ lọc vào URL.

## 4. Tiêu chí xong

- Unit test cho bộ lọc (tìm username, tìm họ tên, không phân biệt hoa thường, sắp mặc định mới nhất, đổi Cũ nhất, khoảng ngày bao 2 đầu theo ngày VN, rỗng hiện chữ, về trang 1).
- e2e `ar-loc-tai-khoan` ở 375 + 1280: gõ tên → chỉ còn dòng khớp; dòng đầu là tài khoản tạo mới nhất; ảnh 375 + 1280 tự xem, không cuộn ngang.
- Mỗi lỗi A–D có test đỏ trước (trừ D1/D2: chứng minh bằng 3 lần chạy liền xanh trong lô + full e2e).
- Full vitest + full e2e: không còn đỏ `dashboard-alerts:59`, `filter-bar-align`, `auth.spec:107`.
- `releases.ts` mục 0.26.0, `package.json` 0.26.0.
