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

---

## 3. QA — Báo cáo

---

## 4. Trao đổi

- [DEV → LEADER] Bản sửa ở `computeClosingBalances` là refactor nội bộ (tách sổ → dư nợ), giữ nguyên kết quả; unit xanh nhưng nên chạy integration report/tuition để chắc.
- [DEV → LEADER] Trên trang `/p` bỏ dòng "Tổng phải đóng" (demo chỉ có học phí tháng / nợ cũ / đã trả, số to là "Còn phải trả"). Ảnh phiếu vẫn giữ dòng này.
- [DEV → LEADER] Demo có ngày ở dưới tên GV trong thẻ Nhận xét; app không lưu ngày viết nhận xét nên chỉ hiện tên GV.
- [DEV → LEADER] `TuitionNoticeCard` `variant="wide"` không còn chỗ dùng; giữ lại (có test riêng). Muốn dọn thì giao thêm.

---

## 5. LEADER — Kết luận

