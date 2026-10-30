# Handoff AU — Trang phụ huynh bố cục mới + tách nợ từng tháng

Nhánh: `feat/au-trang-ph-tach-no` (repo chính `D:\APINODEJS\student-managerment`)
Vai: **LEADER** (giao việc, duyệt) · **DEV** (code) · **QA** (kiểm thử)

Quy ước: mỗi vai chỉ ghi thêm vào mục của mình. Câu hỏi giữa các vai ghi ở mục **Trao đổi**, dạng `[DEV → LEADER] ...`.

---

## 1. LEADER — Yêu cầu

### Yêu cầu A — Trang link phụ huynh `/p/[token]` theo bố cục mới (user đã chốt demo)
Demo user đã duyệt: `docs/superpowers/handoff/2026-10-30-au-demo-trang-phu-huynh.html`. Mở bằng trình duyệt; thanh trên cùng đổi Web/Điện thoại và nhận xét Dài/Ngắn/Không có.

Vấn đề hiện tại: phiếu nằm nguyên khối ở cột phải. Nhận xét dài đẩy QR và số tiền xuống tận cuối trang.

Bố cục cần làm (`src/components/parent/ParentView.tsx`; tách thành component nhỏ nếu cần):
1. **Web (≥ md/lg, chọn breakpoint hợp với layout hiện có):** 2 cột.
   - Cột trái: **Nhận xét tháng** (thẻ riêng, hiện đầy đủ, có tên giáo viên + tháng), **Điểm danh**, **Lịch sắp tới**.
   - Cột phải: khối **Thanh toán**, `sticky` khi cuộn. Khối gồm: tiêu đề + nhãn trạng thái; số "Còn phải trả" to; chi tiết tiền (học phí tháng, nợ cũ, đã trả); QR; ngân hàng/chủ TK; số TK, số tiền, nội dung chuyển khoản, mỗi dòng có nút **Sao chép**; giáo viên, ngày lập.
   - Khối thanh toán phải nằm gọn trong 1 màn laptop (cao ~720px) để luôn thấy QR và số TK.
2. **Điện thoại:** 1 cột, theo thứ tự:
   1. Đầu trang + chọn tháng, không xuống dòng.
   2. Thẻ màu chính "Còn phải trả tháng N" + nút **Mã QR ↓**, cuộn tới khối thanh toán.
   3. Nhận xét, thu gọn ~7 dòng + nút **Đọc tiếp** nếu dài.
   4. Khối thanh toán.
   5. Điểm danh.
   6. Lịch sắp tới.

   Thanh dính đáy "Còn phải trả … · **Thanh toán**" chỉ hiện khi đã cuộn qua cả thẻ tiền đầu trang lẫn khối thanh toán (IntersectionObserver), để không hiện số tiền 2 lần.
3. **Điểm danh:** 3 ô số (Có mặt / Vắng / Tổng buổi) + các ô ngày dạng chip (có mặt màu xanh, vắng màu đỏ gạch ngang, theo các trạng thái attendance thật của app). Danh sách giờ từng buổi thu vào "Xem giờ học từng buổi".
   **Lịch sắp tới:** hiện 3 buổi, phần còn lại thu vào "Xem thêm N buổi".
4. **Giữ nguyên dữ liệu/nghiệp vụ hiện có** của trang `/p`: chọn tháng, payOS, trạng thái đã đóng/đóng qua payOS, nơi dạy, tháng không có học phí, trường hợp không có QR/không có tài khoản ngân hàng, trang hết hạn/tắt link. Không có nhận xét → không có thẻ Nhận xét. Không có QR → khối thanh toán vẫn có số tiền, không có ô QR.
5. Màu và font dùng theo design token/Tailwind hiện có của app, không chép nguyên màu của demo. Nút chạm ≥ 44px trên điện thoại. Không tràn ngang ở 360px.
6. **Ảnh phiếu tải về (`TuitionNoticeCard` khi xuất ảnh) KHÔNG đổi bố cục ở gói này**, chỉ thêm phần tách nợ ở Yêu cầu B. Nếu đang dùng chung component với trang `/p` thì tách cho trang `/p` dùng bố cục mới, ảnh phiếu giữ như cũ.

### Yêu cầu B — Tách nợ từng tháng
Hiện tại nợ cũ hiện gộp, ví dụ "Nợ 2 tháng trước 480.000 đ". User muốn tách rõ từng tháng: "Tháng 7 còn thiếu x", "Tháng 8 còn thiếu y", dòng "Tổng nợ cũ 480.000 đ".
1. Hiện ở: phiếu học phí (ảnh phiếu + trang `/p`), sheet chi tiết học phí của giáo viên (`TuitionDetailSheet`). Ô tiền ở danh sách Học phí (`TuitionAmountCell`) giữ dạng gộp cho gọn.
2. Số còn thiếu từng tháng phải khớp cách hệ thống đang chia tiền (FIFO trừ tháng cũ nhất trước, `allocatePayment`/`loadMonthLedgers`/`computeClosingBalances`, có tính miễn/`isFullPaid`).
   - **Bất biến:** tổng các dòng tháng = đúng `previousBalance`.
   - Nếu không tách được cho khớp (vd có tiền dư trả trước, số âm, dữ liệu lạ) thì quay về dòng gộp như cũ, không hiện số sai.
3. Chỉ 1 tháng nợ thì giữ như cũ ("Tháng N còn thiếu"). Nhiều tháng thì liệt kê tháng cũ → mới, rồi dòng tổng. Tối đa theo cửa sổ `debtMonths` hiện có (12 tháng). Nợ kéo dài hơn 12 tháng thì gộp phần cũ hơn thành "Trước tháng N".
4. Tính toán trên server, không tạo N+1 (gom truy vấn như `getMonthlyTuitionStatus` đang làm), đưa vào DTO.

### Quy tắc bắt buộc
- Đọc `docs/CLAUDE.md`, `docs/coding-rule.md` (§6.1 bảo vệ DB production, mục Hướng dẫn đi cùng tính năng).
- Không migration (không cần đổi schema). TUYỆT ĐỐI KHÔNG chạy `prisma migrate*`, `db push`, `pnpm db:*`, `pnpm build`.
- DB test `localhost:5433` đã chạy được. Integration/`pnpm test:*` **chỉ chạy khi LEADER bảo**, để tránh 2 người dùng chung DB. DEV chạy unit bằng vitest config tạm (không nối DB) như các gói trước.
- Hướng dẫn đi kèm: cập nhật `guide-content.ts` + "Có gì mới" `releases.ts` (bản 0.28.0, nâng `package.json`). Ảnh hướng dẫn LEADER sẽ chụp lại sau.
- TDD, code tối giản, đúng style, i18n vi/en. Commit 1 dòng `[AU] ...`, không body, không Co-Authored-By. Không push, không merge.

### Tiêu chí hoàn thành
- Trang `/p` đúng bố cục ở 1280px và 360/390px với nhận xét dài, ngắn và không có. QR và số tiền luôn dễ thấy. Nút sao chép hoạt động.
- Nợ nhiều tháng hiện từng tháng + tổng, tổng khớp `previousBalance`. Có unit test cho hàm tách nợ: FIFO trả một phần, miễn, dư trả trước, quá 12 tháng.
- tsc, lint sạch; unit xanh; integration xanh (LEADER chạy).

---

## 2. DEV — Báo cáo

**Commit:** `0a9cbe3`. Nhánh `feat/au-trang-ph-tach-no`, chưa push/merge. Không migration. Không chạy integration / `pnpm test` / migrate / build.

### B — Tách nợ cũ từng tháng
- `src/lib/debt-breakdown.ts` (mới):
  - `splitDebt(ledgers, lastKey, previousBalance)`: đi các tháng cũ → mới với hàng đợi FIFO: học phí tháng vào hàng đợi (trừ tín dụng trả dư trước), tiền thu tháng đó trừ phần cũ nhất trước, dư thì thành tín dụng; tháng miễn (`isFullPaid`) xoá hết nợ dương, giữ tín dụng — cùng công thức `computeClosingBalances`/`allocatePayment`. **Bất biến:** tổng hàng đợi phải = `previousBalance`, lệch / học phí âm / không nợ → `null` (giao diện về dòng gộp). Cửa sổ 12 tháng; cũ hơn gộp 1 dòng `before` ("Trước tháng N", N = tháng đầu cửa sổ).
  - `debtLines(t, row)`: dựng dòng hiển thị dùng chung: nhiều tháng → từng tháng (`kind: "month"`) + "Tổng nợ cũ"; 1 tháng → "Tháng N còn thiếu" (đúng tháng phát sinh); `null` → dòng gộp cũ (`debt_n_months_label` / `debt_prev_month_label`). Khác năm thì ghi "12/2025".
- `src/server/services/tuition.service.ts`: tách `computeClosingBalances` thành `loadLedgersBefore` (vẫn 2 truy vấn gom cho mọi HS, không N+1) + `closingsFromLedgers`; `computeClosingBalances` giữ chữ ký cũ (report.service dùng). `getMonthlyTuitionStatus` dùng sổ đó để tính cả dư nợ lẫn `debtBreakdown` → có trong `TuitionStatusDTO`; `tuition-notice.service` đưa vào `TuitionNoticeDTO` (nên trang `/p` cũng có).
- `src/lib/types/models.ts`: `debtBreakdown?: DebtPart[] | null` (optional để fixture cũ không phải sửa; thiếu = dòng gộp).
- Hiển thị: `TuitionNoticeCard` (ảnh phiếu — bố cục không đổi, chỉ thay dòng nợ), `TuitionDetailSheet` (sheet GV), khối thanh toán trang `/p`. `TuitionAmountCell` giữ gộp.
- i18n: `debt_before_month`, `debt_total_prev` (vi/en).

### A — Trang `/p/[token]` bố cục mới
- `src/components/parent/ParentView.tsx` viết lại; tách `ParentPayBlock.tsx`, `ParentComment.tsx`, `ParentSessions.tsx` (`ParentAttendance`, `ParentUpcoming`). Breakpoint `lg` (1024) như layout cũ.
  - Web: grid `minmax(0,1fr) 380px`; trái: Nhận xét, Điểm danh, Lịch (`lg:col-start-1`); phải: khối Thanh toán `lg:sticky lg:top-4 lg:row-span-3`.
  - Điện thoại (thứ tự DOM): thẻ tiền màu `bg-primary` "Còn phải trả tháng N" + nút **Mã QR ↓** (không có QR thì **Chi tiết ↓**) → Nhận xét → Thanh toán → Điểm danh → Lịch. Thanh dính đáy (`fixed`, `lg:hidden`) chỉ hiện khi IntersectionObserver thấy cả thẻ tiền lẫn khối thanh toán đều ra khỏi màn.
  - Khối Thanh toán: tiêu đề + nhãn (Chưa đóng / Chưa đóng đủ / Đã đóng đủ / Đã tất toán), số còn phải trả to (tháng đang học theo buổi: "Cần đóng ngay" + dòng tạm tính như phiếu), học phí tháng (kèm "n × đơn giá" nếu cùng giá), nợ cũ tách tháng, dư tháng trước, đã trả + từng lần thu, QR (payOS: nút **Mở trang thanh toán** giữ nguyên), ngân hàng · chủ TK, 3 dòng có nút **Sao chép** (số TK, số tiền dạng số thuần, nội dung), GV + ngày lập. Không QR → không ô QR / nút sao chép.
  - Nhận xét: avatar chữ đầu tên GV, "Nhận xét tháng N", text thường `whitespace-pre-wrap`; điện thoại thu gọn 7 dòng (`max-h-[11.9em]`, đo `scrollHeight` bằng ResizeObserver) + **Đọc tiếp**; web hiện đủ.
  - Điểm danh: 3 ô số + chip ngày (có mặt xanh, muộn vàng, vắng đỏ gạch ngang, chưa điểm danh xám; có `sr-only` tên trạng thái), danh sách giờ trong `<details>` "Xem giờ học từng buổi". Lịch: 3 buổi + `<details>` "Xem thêm N buổi".
  - Giữ: chọn tháng, payOS, nơi tính theo ca (notice null → không khối tiền/nhận xét), trạng thái đã đóng / dư.
- Ảnh phiếu (`TuitionNoticeCard`) không đổi bố cục. Biến thể `variant="wide"` nay không còn nơi dùng (trước chỉ `ParentView` dùng) — để nguyên, chưa xoá.
- i18n mới: `parent_pay_title`, `parent_remaining_month`, `parent_goto_qr`, `parent_goto_detail`, `parent_pay_now`, `parent_comment_title`, `parent_read_more`, `parent_show_times`, `parent_more_sessions`, `parent_bank_owner`, `copied_short`.

### Hướng dẫn đi kèm
- `guide-content.ts` mục Học phí: thêm 2 bước chữ (trang PH mới; nợ từng tháng). `releases.ts` bản **0.28.0** (notify), `package.json` 0.27.0 → 0.28.0, chạy lại `pnpm guide:docx` (chỉ đọc nội dung + ảnh có sẵn). Ảnh `link-phu-huynh` LEADER chụp lại sau.

### Test (TDD) + kiểm tra (chạy thật 2026-10-30)
- Mới: `tests/unit/lib/debt-breakdown.test.ts` (16: FIFO trả một phần, miễn, dư trả trước, tháng 0 đ, quá 12 tháng → "Trước tháng", qua năm, bỏ tháng đang xem, không nợ / lệch tổng / số âm → null; `debtLines`), `tests/unit/services/tuition-debt-breakdown.test.ts` (getMonthlyTuitionStatus với db giả, đỏ trước khi sửa), `tests/unit/components/TuitionNoticeCardDebt.test.tsx` (2, đỏ trước), `ParentView.test.tsx` viết lại cho bố cục mới (19), thêm 2 ca tách nợ ở `TuitionDetailSheetReviewFix.test.tsx` (viết sau khi sửa sheet).
- Integration (chưa chạy, để LEADER): thêm describe "tách nợ cũ từng tháng (AU)" ở `tests/integration/tuition-notice.test.ts`.
- e2e: `tests/e2e/parent-link.spec.ts` đổi `notice-card` → `parent-pay` (trang `/p` không còn TuitionNoticeCard). Chưa chạy.
- `node_modules/.bin/tsc --noEmit` exit 0 · `pnpm lint` 0 lỗi (2 cảnh báo có sẵn ở `.superpowers/mockups/aj/_plans.js`, không thuộc gói) · unit toàn bộ `tests/unit` (config tạm, không nối DB): **196 file / 1371 test pass**.
- Kiểm bố cục bằng chrome-devtools trên trang demo tạm (`src/app/p/au-demo`, dữ liệu giả, dev server cổng 3999 với `DATABASE_URL` cổng chết — **đã xoá trang tạm, không commit**):
  - 1280×800: 2 cột; khối thanh toán cao **678px** (top 96 → bottom 774), cuộn thì dính `top 16 → bottom 694`, thấy cả QR lẫn số TK, thanh dính đáy ẩn.
  - 390×844: đúng thứ tự, nhận xét dài có "Đọc tiếp", thanh dính đáy ẩn ở đầu trang / khi còn thấy khối thanh toán, hiện khi đã cuộn qua; không tràn ngang.
  - 360×780 (nhận xét ngắn): `scrollWidth = 360`, nav tháng 1 dòng (cao 45.6px), nút nhỏ nhất 44px, không có "Đọc tiếp".

### QA nên kiểm
1. Integration `tuition-notice.test.ts` (+ toàn bộ tuition/report vì đổi nội bộ `computeClosingBalances`), e2e `parent-link.spec.ts`.
2. Nợ có tháng miễn / trả dư / tháng 0 đ / nợ > 12 tháng: số từng tháng khớp tổng; dữ liệu lạ thì về dòng gộp.
3. Trang `/p` thật: payOS, đã đóng đủ, tháng không có học phí (nơi theo ca), không có tài khoản ngân hàng, nhận xét dài/ngắn/không, Safari iOS (thanh dính đáy + `env(safe-area-inset-bottom)`), nút Sao chép trên điện thoại.
4. Ảnh phiếu tải về vẫn đúng bố cục cũ, chỉ khác dòng nợ.

### Vòng 2 — sửa AU-1, AU-2, AU-3
**Commit:** `3d2424d`.

- **AU-1** `src/components/parent/ParentPayBlock.tsx`: trên web (`useMediaQuery("(min-width: 1024px)")`, cùng breakpoint `lg`):
  - Nợ cũ ≥ 2 dòng tháng → thu vào `<details>` đóng sẵn, tiêu đề "Nợ cũ N tháng · tổng" (có dòng "Trước tháng" thì "N+"), bên trong là từng tháng.
  - Lần thu ≥ 2 → `<details>` "Đã trả X · N lần".
  - 1 tháng nợ / 1 lần thu → hiện thẳng như cũ. Điện thoại giữ hiện đủ (không `<details>`). "Còn phải trả", QR, số TK luôn ngoài `<details>`.
  - Kèm `src/components/parent/ParentView.tsx`: grid web thêm `lg:grid-rows-[auto_auto_1fr]` — trước đó khối thanh toán span 3 hàng cao hơn cột trái làm giãn khe giữa thẻ Nhận xét / Điểm danh / Lịch (thấy khi đo); nay phần dư dồn xuống hàng cuối.
- **AU-2**: xoá nhánh `variant="wide"` trong `TuitionNoticeCard.tsx` (prop, `isWide`, nhánh QR bên cạnh); xoá ca "variant='wide'" trong `TuitionNoticeCardVariant.test.tsx` (giữ ca khung mặc định 360px vì nó canh spec AR A1 của ảnh phiếu, đổi tên describe) và ca "bản rộng" trong `TuitionNoticeCardComment.test.tsx`; xoá khoá `parent_present_summary` vi/en.
- **AU-3**: `CopyRow` bắt lỗi clipboard → hiện dòng đỏ "Không sao chép được, hãy chép tay" (`role="status"`, tự ẩn sau 3 giây).
- i18n mới: `parent_debt_summary`, `parent_paid_summary`, `copy_failed_manual` (vi/en).
- Không đụng `allocatePayment` (theo LEADER, để gói riêng).

**TDD:** 4 test mới trong `tests/unit/components/ParentView.test.tsx` (`[AU-1]` web nhiều tháng + nhiều lần thu → 2 `<details>` đóng, tiêu đề đúng, số tiền / nút Sao chép / QR ở ngoài; `[AU-1]` web 1 tháng + 1 lần thu → không `<details>`; `[AU-1]` điện thoại hiện đủ; `[AU-3]` clipboard bị chặn). 2 ca web nhiều tháng và AU-3 đỏ trước khi sửa.

**Kiểm tra (chạy thật 2026-10-30):** `node_modules/.bin/tsc --noEmit` exit 0 · `pnpm lint` 0 lỗi (2 cảnh báo có sẵn ở `.superpowers/mockups/aj/_plans.js`) · unit toàn bộ `tests/unit` (config tạm, không nối DB): **197 file / 1379 test pass**. Không chạy integration / e2e / migrate / build.

**Đo bằng chrome-devtools** (trang tạm `src/app/p/au-demo2`, `next dev -p 3998`, `DATABASE_URL` cổng chết; **đã xoá trang tạm + `.next/types`, đã tắt server**), ca xấu nhất: nợ 14 tháng (13 dòng, có "Trước tháng 10/2025") + 5 lần thu:
- 1280×720: khối thanh toán cao **634px** (trước 1010px), 2 `<details>` đóng, QR + số TK + "Còn phải trả" đều thấy; cột trái không còn khe giãn.
- 390×844: không `<details>`, đủ 12 dòng "còn thiếu", `scrollWidth` 390.

---

## 3. QA — Báo cáo

Kiểm trên HEAD `49f0b53` (code DEV `0a9cbe3`), chạy 2026-10-30. Không chạy integration / e2e / `pnpm test` / migrate, không đụng DB 5433 / Docker, không dùng cổng 3000.

### Lệnh (chạy thật)
- `node_modules/.bin/tsc --noEmit`: exit 0.
- `pnpm lint`: exit 0, 0 lỗi, 2 cảnh báo có sẵn ở `.superpowers/mockups/aj/_plans.js` (không thuộc gói).
- Unit toàn bộ `tests/unit` (config tạm, `DATABASE_URL` cổng chết 5999, không nối DB): **197 file / 1377 test pass, 0 fail** (gồm 6 test QA mới).
- Test QA mới: `tests/unit/qa/au-debt-breakdown-edge.test.ts` (6 test):
  - 2000 bộ sổ ngẫu nhiên (tháng trống, trả một phần, trả dư, miễn, 21 tháng): dư nợ > 0 thì luôn tách được, tổng = dư nợ, mỗi dòng > 0, tăng dần, ≤ học phí tháng đó, tối đa 13 dòng, "Trước tháng N" chỉ ở đầu và N = tháng đầu cửa sổ.
  - 1000 bộ: ghi thêm khoản thu qua `allocatePayment` → bảng tách mới đúng bằng bảng cũ trừ FIFO từ tháng cũ nhất (khớp cách hệ thống chia tiền).
  - Miễn khi đang có tín dụng; trả đủ → null; số thu âm → null.
  - `computeClosingBalances` sau refactor (4 HS × 18 tháng ngẫu nhiên, có vắng / chưa điểm danh / miễn / trả dư) khớp bản tính tay theo vòng lặp cũ trên main → `report.service` nhận kết quả không đổi.

### Ca kiểm thử
| # | Ca | Kết quả |
|---|----|---------|
| 1 | Tách nợ FIFO, tổng = `previousBalance`, miễn / trả dư / qua năm / quá 12 tháng gộp "Trước tháng N" / dữ liệu lạ → dòng gộp | PASS (review + test DEV + test QA) |
| 2 | Refactor `computeClosingBalances` (`loadLedgersBefore` + `closingsFromLedgers`) giữ kết quả; vẫn 2 truy vấn gom, không N+1 | PASS |
| 3 | Riêng tư: `ParentViewDTO` không đổi ngoài `debtBreakdown`; trang `/p` không có `notes` / token (quét chữ trang ở 8 ca: không có) | PASS |
| 4 | Web 1280×800, nhận xét dài, nợ 2 tháng, 1 lần thu: 2 cột, khối thanh toán 380×**696px** (top 96), cuộn thì dính top 16 → bottom 712, thấy cả QR + số TK; không có thanh dính đáy | PASS |
| 5 | Web 1280×800, nợ 14 tháng (13 dòng) + 5 lần thu | **FAIL — AU-1** |
| 6 | Điện thoại 390×844, nhận xét dài: thứ tự thẻ tiền → nhận xét → thanh toán → điểm danh → lịch; `scrollWidth` 390; "Đọc tiếp" có, bấm thì mở 179 → 612px và nút biến mất; "Mã QR ↓" cuộn khối thanh toán về top 16; thanh dính đáy ẩn ở đầu trang và khi khối thanh toán đang hiện, hiện khi cuộn qua hết | PASS |
| 7 | 360×780: nhận xét ngắn / không có / không QR ("Chi tiết ↓", không ô QR, không nút sao chép) / đã đóng đủ + trả dư (không thẻ tiền, không thanh dính đáy, "Trả dư 50.000 đ") / đã tất toán / payOS (nút "Mở trang thanh toán") / nơi tính theo ca (chỉ điểm danh + lịch) / nợ 14 tháng: tất cả `scrollWidth` = 360, nav tháng 1 dòng (46px), không nút chạm nào < 44px | PASS |
| 8 | Nút Sao chép: chép đúng `0123456789012`, `1000000` (số thuần), nội dung CK; chữ đổi "Đã chép" | PASS (lỗi clipboard → AU-3) |
| 9 | Chip điểm danh: đủ 4 trạng thái thật (`present` xanh, `late` vàng, `absent` đỏ gạch ngang, `pending` xám), có `sr-only`; 3 ô số; "Xem giờ học từng buổi"; lịch 3 buổi + "Xem thêm 2 buổi" | PASS |
| 10 | Ảnh phiếu (`TuitionNoticeCard` mặc định): bố cục cũ giữ nguyên (tiêu đề, ngày học, Tổng tiền cần đóng, Nhận xét, QR), chỉ thay dòng nợ bằng "Tháng 8 còn thiếu / Tháng 9 còn thiếu / Tổng nợ cũ" | PASS |
| 11 | i18n vi/en đủ khoá mới; releases 0.28.0 + `package.json` | PASS |

Cách dựng: trang tạm `src/app/p/qa-au` (dữ liệu giả, không import DB), `next dev -p 3997` với `DATABASE_URL` cổng chết, đo bằng Chrome DevTools. **Đã xoá trang tạm + `.next/types` sinh ra, không commit, đã tắt server.**

### Lỗi
- **AU-1 (Trung bình)** `src/components/parent/ParentPayBlock.tsx:103-112` (dòng nợ + từng lần thu) cùng với `ParentView.tsx:110` (`lg:sticky`).
  - Khối thanh toán web không có giới hạn cao. Đo: mỗi dòng nợ 20px, mỗi lần thu 16px, ca cơ bản (nợ 2 tháng, 1 lần thu) đã 696px.
  - Nợ ≥ 4 tháng hoặc ≥ 3 lần thu trong tháng là vượt 720px (yêu cầu LEADER: "nằm gọn trong 1 màn laptop ~720px").
  - Ca nợ 14 tháng + 5 lần thu: cao **1010px**. Khi cuộn, sticky không giữ được (cuộn 400px thì top −290), tức là đang xem QR thì số "Còn phải trả" và tiêu đề đã trôi mất.
  - Tái hiện: HS nợ nhiều tháng, mở `/p/<token>` ở 1280×800 (hoặc màn cao 720) rồi cuộn.
  - Gợi ý: trên web thu dòng tách nợ / lần thu vào `<details>` (giữ dòng "Tổng nợ cũ"), hoặc giới hạn số dòng.
- **AU-2 (Thấp, dọn code chết do gói tạo ra)**
  - `src/components/tuition/TuitionNoticeCard.tsx`: `variant="wide"` (dòng 14, 24, 28, 71, 100, 111, nhánh 160–223) không còn nơi dùng trong `src/` (trang `/p` thôi dùng card). Chỉ còn test giữ: `tests/unit/components/TuitionNoticeCardVariant.test.tsx`, `TuitionNoticeCardComment.test.tsx:61`.
  - Khoá i18n `parent_present_summary` (`vi.json` / `en.json` dòng 518) không còn dùng.
  - Đề nghị DEV xoá.
- **AU-3 (Thấp)** `ParentPayBlock.tsx:23`: trình duyệt chặn clipboard thì `catch {}` im lặng, phụ huynh bấm "Sao chép" không thấy gì. Nên báo ngắn (vd "Không chép được, hãy giữ để chọn chữ").

### Ghi nhận ngoài phạm vi AU (có từ trước, không do gói này)
- `src/lib/payment-allocation.ts:16`: `allocatePayment` xét `residual > 0` từng tháng trước khi gặp tháng miễn phía sau, nên có thể chia khoản thu mới vào tháng **trước tháng đã miễn**. Tiền đó bị miễn mất, tháng sau vẫn nợ.
- Ví dụ: T7 nợ 100k, T8 GV bấm Miễn, T9 học 100k, phụ huynh trả 100k → khoản thu ghi vào T7, T9 vẫn còn thiếu 100k.
- Test ngẫu nhiên của QA phát hiện điều này, nên ca so khớp `allocatePayment` đã bỏ tháng miễn. Nhờ LEADER xem có giao gói riêng không.

### Chưa kiểm
- Integration (`tuition-notice` + tuition / report) và e2e `parent-link.spec.ts`: LEADER chạy.
- Safari iOS thật (`env(safe-area-inset-bottom)`), clipboard trên điện thoại thật.

### Kết luận: **KHÔNG ĐẠT**
Tách nợ đúng, refactor `computeClosingBalances` giữ nguyên kết quả, bố cục điện thoại và các trạng thái trang `/p` đúng, ảnh phiếu giữ bố cục.

Cần sửa:
- AU-1: khối thanh toán web vượt 720px, sticky mất số tiền khi nợ nhiều tháng hoặc nhiều lần thu.
- AU-2: dọn code chết theo yêu cầu LEADER.

AU-3 tuỳ LEADER.

### Vòng 2 — kiểm lại trên `3d2424d` (chạy 2026-10-30)
- `node_modules/.bin/tsc --noEmit` exit 0 · `pnpm lint` 0 lỗi (2 cảnh báo có sẵn) · unit `tests/unit` (config tạm, không nối DB, có nạp khoá mã hoá của `.env.test`): **197 file / 1379 test pass**.
- Review diff vòng 2: dòng "Trước tháng N" là `kind: "month"` nên vẫn nằm trong `<details>`, tổng không lệch; nút Sao chép / QR / "Còn phải trả" ngoài `<details>`.
- Đo bằng Playwright (trang tạm `src/app/p/qa-au2`, `next dev -p 3996`, `DATABASE_URL` cổng chết; **đã xoá trang tạm, đã tắt server**), ca nợ 14 tháng (13 dòng) + 5 lần thu + nhận xét 12 dòng:
  - 1280×720: khối thanh toán cao **636px**, 2 `<details>` đóng ("Nợ cũ 12+ tháng · 1.400.000 đ", "Đã trả 500.000 đ · 5 lần"); cuộn hết trang khối ở top 4 → bottom 640, thấy "Còn phải trả" + QR + số TK. `scrollWidth` 1280.
  - 1280×800: 636px, cuộn thì dính top 16 → bottom 652.
  - 390×844 / 360×780: không `<details>`, đủ 12 dòng "còn thiếu", có "Đọc tiếp", `scrollWidth` = bề ngang, không nút chạm < 44px.
- AU-1, AU-2, AU-3: **ĐẠT**.

---

## 4. Trao đổi

- [DEV → LEADER] Bản sửa ở `computeClosingBalances` là refactor nội bộ (tách sổ → dư nợ), giữ nguyên kết quả; unit xanh nhưng nên chạy integration report/tuition để chắc.
- [DEV → LEADER] Trên trang `/p` bỏ dòng "Tổng phải đóng" (demo chỉ có học phí tháng / nợ cũ / đã trả, số to là "Còn phải trả"). Ảnh phiếu vẫn giữ dòng này.
- [DEV → LEADER] Demo có ngày ở dưới tên GV trong thẻ Nhận xét; app không lưu ngày viết nhận xét nên chỉ hiện tên GV.
- [DEV → LEADER] `TuitionNoticeCard` `variant="wide"` không còn chỗ dùng; giữ lại (có test riêng). Muốn dọn thì giao thêm.
- [QA → DEV] AU-1: khối thanh toán web cao 696px ở ca cơ bản, mỗi dòng nợ +20px, mỗi lần thu +16px. Nợ ≥ 4 tháng hoặc ≥ 3 lần thu là vượt 720px; ca 14 tháng là 1010px, sticky trôi mất số tiền. Đề nghị thu chi tiết vào `<details>` trên web.
- [QA → DEV] AU-2: xoá nhánh `variant="wide"` của `TuitionNoticeCard` + test đi kèm + khoá `parent_present_summary`.
- [QA → LEADER] Ngoài phạm vi: `allocatePayment` chia tiền vào tháng nằm trước tháng miễn, nên tiền bị miễn mất (ví dụ ở mục 3). Cân nhắc giao gói riêng.
- [QA → LEADER] Nhờ chạy integration `tuition-notice` + tuition/report và e2e `parent-link.spec.ts`.
- [DEV → QA] AU-1: đã sửa — web thu nợ nhiều tháng / nhiều lần thu vào `<details>` đóng sẵn; ca 14 tháng + 5 lần thu đo còn 634px (1280×720). Kèm sửa khe giãn cột trái (`lg:grid-rows-[auto_auto_1fr]`). Nhờ đo lại.
- [DEV → QA] AU-2: đã xoá nhánh `variant="wide"` + ca test của nó + khoá `parent_present_summary`. Giữ ca khung mặc định 360px trong `TuitionNoticeCardVariant.test.tsx` (canh ảnh phiếu, không thuộc nhánh wide).
- [DEV → QA] AU-3: đã sửa — clipboard bị chặn thì hiện "Không sao chép được, hãy chép tay".

---

## 5. LEADER — Kết luận

- Integration `tests/integration` trên `3d2424d` (DB test `localhost:5433`): **102 file / 802 test pass**.
- E2E học phí / trang PH / payOS / điện thoại (24 file, gồm `parent-link.spec.ts`, `tuition-notice.spec.ts`): **76/76 pass**.
- QA vòng 2 đạt. **Duyệt merge vào `main`.**
- Còn lại: chụp lại ảnh hướng dẫn `link-phu-huynh`; gói riêng (AV) cho lỗi `allocatePayment` chia tiền vào tháng trước tháng miễn (QA mục 3).

