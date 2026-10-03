# Y — Luồng thu học phí mới

> Ngày: 2026-10-03 · Người yêu cầu: chủ ứng dụng · Phiên bản: **0.10.0** (minor, **có migration**: 1 cột `payments.batch_id`). Làm **trước W** → W đổi thành **0.11.0**.
> Mockup đã duyệt: https://claude.ai/artifact/LUPXUqy91yJ78GjduEdgEy (bản 2, 6 luồng thao tác). Người dùng chốt ngày 2026-10-03.

## 1. Vấn đề

1. **Thu tiền quá nhiều bước** (7 bước cho 1 lần đóng đủ): Ghi nhận → sheet chi tiết → Thu tiền (hộp thứ 2) → số tiền → tiền mặt/chuyển khoản → Lưu hộp → tick "Đã đóng đủ" → Lưu ngoài. Hai nút Lưu làm 2 việc khác nhau; nút Lưu ngoài tưởng là lưu tiền nhưng chỉ lưu dấu tick + ghi chú.
2. **Ghi nhầm tháng:** tháng 9 học xong mới gửi phiếu; phụ huynh đóng 5–15/10. Màn Học phí mặc định tháng hiện tại (10) nên giáo viên ghi tiền tháng 9 vào sổ tháng 10. Sổ/báo cáo tháng 9 báo chưa đóng.
3. **Số tiền trộn tháng:** "còn thiếu" ở tháng 10 = nợ tháng 9 + vài buổi tháng 10 vừa học → giáo viên đối chiếu phiếu báo thấy sai.
4. **Không biết phiếu đã gửi bao lâu** mà chưa đóng.

## 2. Đã chốt với người dùng

| # | Quyết định |
|---|---|
| D1 | Màn Học phí **mặc định tháng trước**, có dòng nhắc + link sang tháng hiện tại. |
| D2 | Nút **"Đã đóng đủ <số tiền>"** trên dòng danh sách và trong chi tiết: ghi luôn 1 khoản thu đúng bằng số còn thiếu, ngày hôm nay, **không hỏi lại**, toast **Hoàn tác**. |
| D3 | **"Đóng một phần"** mở ô nhập ngay trong chi tiết (không mở hộp mới), báo trước sẽ trừ vào tháng nào. |
| D4 | **Tiền trả tháng cũ nhất trước** (FIFO), kể cả khi giáo viên ghi ở tháng sau. Đóng dư → ghi trước cho tháng đang xem. |
| D5 | **Bỏ ô tick "Đã đóng đủ" và nút Lưu chung.** Đủ hay chưa do số tiền. Ghi chú tháng tự lưu khi rời ô. |
| D6 | **"Miễn phần còn thiếu"** (tất toán cũ) chuyển vào menu ⋮ của chi tiết, có hộp xác nhận. |
| D7 | **Bỏ chọn tiền mặt / chuyển khoản** ở mọi giao diện. Dữ liệu cũ giữ trong DB. |
| D8 | **Mọi chỗ hiện tiền tách theo tháng**, không gộp. |
| D9 | **Tháng đang học là tạm tính**: học sinh theo buổi không cộng tiền tháng đang học vào "cần đóng". Học sinh **trọn tháng** tính cả tháng ngay từ đầu tháng. |
| D10 | Nhãn phiếu báo **"Đã gửi dd/MM · n ngày"**, tô **cam từ ngày thứ 7** khi chưa đóng đủ. Hiện ở danh sách Học phí, chi tiết, và cảnh báo "Còn nợ tháng trước" trên Tổng quan. Không làm danh sách nhắc riêng. |

## 3. Mô hình tiền (giữ nguyên dữ liệu, đổi cách ghi + cách hiển thị)

### 3.1 Hiện tại (giữ)
- Mỗi tháng 1 dòng `MonthlyTuition`; nợ cuối tháng chuyển sang tháng sau (`computeClosingBalances`): `dư cuối = dư đầu + tiền học tháng − đã thu tháng`; tháng tất toán (`isFullPaid`) xoá nợ dương; trả dư (âm) chuyển sang.
- `Payment` thuộc 1 dòng tháng. `syncPaidAmount` là hàm duy nhất ghi `paidAmount`.
- Báo cáo "đã thu tháng M" = tổng `paidAmount` của dòng tháng M (theo **tháng học phí**, không theo ngày nhận tiền). Giữ nguyên ý này: sau Y, tiền tháng 9 nhận ngày 10/10 tính vào "đã thu tháng 9".

### 3.2 Ghi tiền theo FIFO (D4)
- API mới `payment.record({ studentId, year, month, amount, paidAt?, note? })` (`year/month` = tháng đang xem).
- Server, trong 1 transaction có khoá theo học sinh:
  1. Lấy mọi tháng của học sinh từ tháng cũ nhất có dữ liệu tới tháng đang xem (đảm bảo dòng tháng tồn tại bằng `ensureMonthlyTuition`).
  2. Đi từ cũ → mới, tính dư cuối từng tháng như `computeClosingBalances`. Tháng nào dư cuối **> 0** thì trừ vào tháng đó `min(còn lại của khoản thu, dư cuối)`.
  3. Còn dư sau tháng đang xem → ghi vào **tháng đang xem** (thành trả trước, chuyển sang tháng sau như hiện tại).
  4. Tạo 1 `Payment` cho mỗi tháng được trừ, cùng `batchId` (UUID), cùng `paidAt`, `note`; `method` = `"cash"` (cột giữ, không còn ý nghĩa với giao diện). `syncPaidAmount` cho từng dòng tháng.
- Hàm thuần `allocatePayment(months, amount): { key: number; amount: number }[]` trong `src/lib/` (test được không cần DB); server và phần "báo trước sẽ trừ vào tháng nào" ở client dùng chung.
- Tháng đang học, học sinh theo buổi: tiền buổi đã học của tháng đang học **vẫn nằm trong chuỗi dư** (như hiện tại); FIFO trả các tháng đã kết thúc trước, rồi mới tới tháng đang học. Kết quả cuối giống ghi vào tháng đang học, chỉ khác sổ từng tháng đúng.

### 3.3 Sửa / xoá / hoàn tác theo đợt
- Cột mới `payments.batch_id VARCHAR(36) NULL`. Khoản thu cũ `null` = 1 đợt riêng.
- Lịch sử thu ở chi tiết tháng M: liệt kê **đợt** có ít nhất 1 dòng thuộc tháng M; mỗi đợt hiện tổng tiền, ngày, ghi chú, và phần chia "T8 200.000 · T9 300.000".
- **Xoá đợt**: xoá mềm mọi dòng của đợt, `syncPaidAmount` từng tháng.
- **Sửa đợt** (số tiền, ngày, ghi chú): xoá mềm các dòng cũ của đợt rồi chia lại FIFO với số mới (tính như đợt đó chưa từng có), giữ `batchId`. Khoản thu cũ (`batchId null`) sửa như hiện tại (không chia lại).
- **Hoàn tác** (toast sau "Đã đóng đủ" / "Ghi nhận"): gọi xoá đợt vừa tạo.

### 3.4 Số hiển thị (D8, D9)
Cho học sinh S ở tháng đang xem M:
- `nợ trước` = dư cuối tháng M−1 (`previousBalance`, dương = nợ, âm = trả trước). Nhãn: "Tháng 8 còn thiếu" nếu nợ chỉ từ 1 tháng (dùng `countDebtMonths`), "Nợ n tháng trước" nếu nhiều tháng.
- `học phí M` = `currentMonthFee`, kèm buổi đã học / tổng buổi.
- `đã đóng (ghi vào M)` = `paidAmount` của M.
- **M đã kết thúc, hoặc học sinh trọn tháng** → `còn thiếu = max(0, nợ trước + học phí M − đã đóng M)` (như hiện tại).
- **M là tháng đang học và học sinh theo buổi** → `cần đóng ngay = max(0, nợ trước − đã đóng M)`; dòng riêng **"Tháng M tạm tính · đã học p buổi: <học phí M>"**, không cộng vào cần đóng.
- "Tháng đang học" = tháng hiện tại theo giờ VN (`vnDateParts`). Tháng tương lai coi như đang học.
- Tháng tất toán (`isFullPaid`): còn thiếu 0, nhãn "Đã miễn phần còn thiếu" thay "Đã tất toán".

### 3.5 Trạng thái dòng (badge + bộ lọc)
- Giữ `getTuitionBadgeStatus` cho tháng đã kết thúc. Tháng đang học + theo buổi: so `đã đóng M` với `nợ trước` thay vì `totalAmountDue` (hết nợ trước → "Đã đóng đủ" kèm "T10 tạm tính …"). Thêm tham số `inProgress: boolean` vào `TuitionStatusInput`, bộ lọc dùng cùng helper.
- `noticeStatus` (sent/changed/none) giữ nguyên, so với số "còn thiếu"/"cần đóng ngay" đang hiện.

## 4. Giao diện

### 4.1 Danh sách Học phí (`/tuition`)
- Không có `year/month` trên URL → mặc định **tháng trước** (giờ VN). Dòng nhắc dưới thanh tháng khi đang xem tháng trước: "Đang xem tháng trước để chốt học phí · Xem tháng <hiện tại>"; khi đang xem tháng hiện tại: "Tháng đang học · tiền buổi chỉ tạm tính". `useCalendar` thêm tuỳ chọn `defaultOffset` (−1 cho trang Học phí; lịch giữ 0).
- Mỗi dòng: tên, lớp, buổi; **số to = còn thiếu / cần đóng ngay**; dòng nhỏ tách tháng ("T8 còn 200.000 · T9 600.000", hoặc "T10 tạm tính 300.000"); nhãn phiếu (D10); nút **"Đã đóng đủ <số>"** khi số > 0; bấm dòng/nút "Chi tiết" mở sheet. Nút cũ "Ghi nhận" bỏ.
- Mobile: nút "Đã đóng đủ" full-width dưới dòng, cao ≥ 44px.

### 4.2 Sheet chi tiết
Thứ tự từ trên xuống, **không có footer Lưu**:
1. Tiêu đề: tên, "Học phí tháng M/YYYY", badge trạng thái, menu ⋮ (Miễn phần còn thiếu / Bỏ miễn).
2. Bảng tiền theo §3.4 (từng dòng tháng riêng).
3. **Thu tiền**: 2 nút "Đã đóng đủ <số>" | "Đóng một phần". "Đóng một phần" mở khung: ô số tiền (CurrencyInput), dòng báo trước chia tháng (dùng `allocatePayment` với dữ liệu tháng từ server), "Ngày thu: hôm nay · Đổi" (mở ô ngày), nút **Ghi nhận**. Ghi xong ở lại sheet, số cập nhật.
4. **Phiếu báo**: trạng thái + nhãn ngày (D10), nút Tạo phiếu báo / Đánh dấu đã gửi / Bỏ đánh dấu (giữ hành vi V).
5. **Lịch sử thu** theo đợt (§3.3), ⋮ mỗi đợt: Sửa (hộp nhỏ: số tiền, ngày, ghi chú, Lưu) / Xoá (xác nhận).
6. **Ghi chú tháng**: textarea, tự lưu khi rời ô (gọi `updateSettlement` chỉ với `notes`), chữ nhỏ "Đã lưu".
- Bỏ: ô tick đã đóng đủ, cảnh báo vàng "Hệ thống tự động chốt dư nợ…", nút Lưu, `PaymentFormDialog` cho tạo mới (giữ cho sửa đợt, bỏ chọn hình thức).

### 4.3 Miễn phần còn thiếu
Menu ⋮ → hộp xác nhận: "Miễn <số> tháng M. Phần này không chuyển sang tháng sau." + ô lý do (ghi vào ghi chú tháng) → nút "Miễn <số>" → `updateSettlement({ isFullPaid: true })`. Đã miễn → menu có "Bỏ miễn".

### 4.4 Chỗ khác tách tháng (D8)
- **Phiếu báo** (`TuitionNoticeCard`): giữ dòng nợ trước, đổi nhãn theo §3.4 ("Tháng 8 còn thiếu" / "Nợ n tháng trước"); tháng đang học + theo buổi: dòng "tạm tính", số QR = cần đóng ngay.
- **Cảnh báo "Còn nợ tháng trước"** (Tổng quan): mỗi dòng thêm nhãn phiếu của tháng trước (D10).
- **Trang phụ huynh** `/p/<token>`: phiếu báo trên trang dùng chung `TuitionNoticeCard` nên tự có nhãn tách tháng và bỏ chữ hình thức thanh toán.
- **Lịch học của 1 học sinh / xuất Excel**: bỏ cột/nhãn hình thức thanh toán; còn lại không đổi.

### 4.5 Trang phụ huynh 2 cột + modal link (người dùng thêm 2026-10-03)
Mockup đã duyệt: https://claude.ai/artifact/BevfN33Gv17gfLoBFEurSh
- **Máy tính (≥ 1024px, `lg:`)**: khung rộng tối đa ~1152px (`lg:max-w-6xl`).
  - Đầu trang 1 dòng: tên + "Lớp 5 · Giáo viên: …" bên trái, thanh chuyển tháng bên phải.
  - 2 cột: **trái** (co giãn) = điểm danh tháng (3 ô tóm tắt: Có mặt, Vắng, Tổng buổi; rồi danh sách buổi) + lịch sắp tới; **phải** (400px, `lg:sticky lg:top-4`) = phiếu báo bản rộng + gợi ý quét QR + chân trang.
  - Phiếu bản rộng: chiếm hết bề rộng cột, QR 160px đặt **cạnh** thông tin ngân hàng, **bỏ dòng "Ngày học"** (bên trái đã có danh sách buổi).
- **Điện thoại (< 1024px)**: giữ nguyên thứ tự và giao diện hiện tại (phiếu → điểm danh → lịch sắp tới → chân trang); phiếu dùng bản thường (rộng 360px, có dòng "Ngày học").
- Phiếu gửi Zalo dạng ảnh (`TuitionNoticeDialog`) không đổi bố cục.
- Ô tóm tắt thứ 3 dùng "Tổng buổi" thay "Học phí/buổi" của mockup: học sinh trọn tháng không có học phí/buổi.
- **Modal link phụ huynh** (`ParentLinkDialog`): rộng `sm:max-w-[640px]`; từ `sm` trở lên 4 nút 1 hàng không xuống dòng (`sm:flex sm:flex-nowrap`); điện thoại giữ lưới 2 cột.

## 5. API
- Mới: `payment.record` (§3.2) → `{ batchId, allocations: { year, month, amount }[] }`; `payment.deleteBatch({ batchId })`; `payment.updateBatch({ batchId, amount, paidAt, note })`; `tuition.allocationContext({ studentId, year, month })` → dữ liệu tháng cho `allocatePayment` ở client.
- `payment.list` trả theo đợt.
- `payment.create` / `update` / `delete` cũ: giữ cho tới khi client mới không còn gọi; plan quyết định bỏ hay giữ (không còn nơi nào gọi thì bỏ).
- `tuition.updateSettlement` giữ; client chỉ gửi `notes` (tự lưu) hoặc `isFullPaid` (miễn / bỏ miễn).
- Bỏ `method` khỏi input tạo/sửa (server mặc định `"cash"`).

## 6. Migration
- `ALTER TABLE payments ADD COLUMN batch_id VARCHAR(36);` + index `(batch_id)`. Không backfill (dòng cũ null).
- Neon backup branch trước khi merge.

## 7. Kiểm thử chính
- Unit `allocatePayment`: đủ / thiếu / dư / nhiều tháng / tháng tất toán / có trả trước âm / số tiền 0 bị chặn.
- Integration `payment.record`: ghi ở tháng 10 khi nợ T8 + T9 → dòng thuộc T8, T9 đúng số; sổ T9 "Đã đóng đủ"; dư sang T10; 2 lần ghi đồng thời không trừ trùng (khoá theo học sinh); không lẫn học sinh/giáo viên khác; học sinh đã xoá → NOT_FOUND.
- Integration sửa/xoá đợt: chia lại đúng; báo cáo "đã thu" từng tháng đúng sau mỗi thao tác.
- Unit hiển thị: tháng đang học theo buổi không cộng tạm tính; trọn tháng có cộng; nhãn phiếu cam đúng từ ngày thứ 7.
- Component: "Đã đóng đủ" gọi `record` 1 lần với đúng số + toast Hoàn tác gọi `deleteBatch`; không còn checkbox/nút Lưu; ghi chú tự lưu khi blur; mặc định tháng trước.
- e2e: luồng 1 (1 chạm), luồng 2 (đóng một phần), luồng 3 (ghi ở tháng 10 trả tháng 9 trước), hoàn tác.

## 8. Không làm
- Không tách mỗi tháng thành sổ độc lập (cách B).
- Không chuyển khoản thu cũ sang FIFO (chỉ áp cho khoản thu mới và đợt được sửa).
- Không đổi định nghĩa báo cáo "đã thu".
- Không làm danh sách nhắc nợ riêng.
