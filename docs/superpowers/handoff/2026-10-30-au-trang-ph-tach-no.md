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

---

## 3. QA — Báo cáo

---

## 4. Trao đổi

---

## 5. LEADER — Kết luận

