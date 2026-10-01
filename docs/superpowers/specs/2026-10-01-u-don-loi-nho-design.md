# U — Dọn lỗi nhỏ còn tồn (sổ theo dõi B → V)

> Ngày: 2026-10-01 · Người yêu cầu: chủ ứng dụng ("còn bn lỗi viết plan spec fix hết đi") · Phiên bản: **0.9.3** (patch, **không migration**).
> Nguồn: các dòng `Final: minor (deferred)` trong `.superpowers/sdd/*/progress.md` + backlog cũ. Claude đã đối chiếu từng dòng với code `main` (3266c11).

## 1. Kết quả đối chiếu

Tổng cộng **71 mục** (64 dòng trong sổ theo dõi, tách các dòng gộp nhiều lỗi, + 4 mục backlog cũ còn mở):

| Nhóm | Số mục | Xử lý |
|---|---|---|
| Còn lỗi thật | **31** | Sửa trong spec này (mục 2) |
| Đã được sửa ở các phần sau | 19 | Không làm (mục 3.1) |
| Cố ý / đúng spec / không ảnh hưởng người dùng | 21 | Không làm, ghi lý do (mục 3.2) |

## 2. Sửa (31 mục)

### 2.1 Phiếu báo / học phí (V) — 5
- **U1** Lỗi khi bấm "Đánh dấu đã gửi" trong sheet học phí hiện **2 toast** (callback ở `useMutation` + ở `mutate`). → chỉ toast 1 lần.
- **U2** `trpc.useUtils?.()` / `trpc.tuition.setNoticeSent?.useMutation ? … : {…}` gọi hook có điều kiện chỉ để chiều mock test cũ. → gọi thẳng, sửa mock trong test.
- **U3** Đóng phiếu báo trước khi đánh dấu xong thì **mất toast "Hoàn tác"**. → toast + làm mới đặt ở callback cấp `useMutation` (vẫn chạy khi component đã đóng); Hoàn tác gọi client tRPC trực tiếp.
- **U4** Sheet chi tiết học phí **không hiện "số tiền đã đổi"** khi `noticeStatus = "changed"`. → thêm dòng cam `notice_changed` dưới ngày gửi.
- **U5** `noticeFilter` lọt vào `filterParams` dùng chung → gửi thừa lên `session.getMonth` (lịch). → bỏ khỏi `filterParams` (trang Học phí đã tự dựng).

### 2.2 Học phí theo tháng (T) — 7
- **U6** File sao lưu, sheet "Lịch sử cách thu" có cả HS trong Thùng rác. → lọc `student.isDeleted = false`.
- **U7** Điểm danh / chi tiết ca dùng **cách thu hiện tại** của HS, không theo tháng của ca (ca tháng trước của HS vừa chuyển trọn tháng lại hiện "Trọn tháng"). → `billingMode` của từng HS trong ca = `resolveBilling(lịch sử, monthKey(tháng của ca)).mode`.
- **U8** Sheet học phí: dòng học phí tháng của HS trọn tháng chưa ghi "(trọn gói)" như spec T §5. → nhãn `Học phí tháng (trọn gói) · Đã học p/n buổi`.
- **U9** Xem trước nhập Excel hiện **0đ** cho dòng "Cách thu = tháng". → hiện `monthlyFee` + "/tháng".
- **U10** Xuất Excel lịch 1 HS ghi "Học phí/buổi (mặc định)" = `tuitionFee` cho HS trọn tháng. → HS trọn tháng ghi "Học phí tháng (trọn gói)" = `monthlyFee` của tháng đó.
- **U11** Form sửa HS: chỉ đổi **mức tiền tháng** (vẫn trọn tháng) thì không hiện ghi chú "Áp dụng từ tháng…". → hiện cả khi mức tháng đổi.
- **U12** Cho lưu HS trọn tháng với **0đ** không báo gì. → form báo lỗi dưới ô "Học phí/tháng"; server trả BAD_REQUEST (create/update).

### 2.3 Thùng rác / giới hạn gói (Q, R) — 5
- **U13** Thêm HS / bật lại "đang học" / khôi phục HS từ Thùng rác kiểm giới hạn gói **không khoá** → 2 thao tác cùng lúc vượt giới hạn. → kiểm giới hạn trong transaction sau `pg_advisory_xact_lock(userId)` (cùng khoá với nhập Excel).
- **U14** Xoá môn: kiểm "còn ca" rồi mới xoá, không khoá → tạo ca cùng lúc lọt. → kiểm + xoá trong 1 transaction có khoá theo user.
- **U15** Khôi phục ca/lần thu mà môn/HS **đã dọn vĩnh viễn** báo "Hãy khôi phục … trước" (không thể làm). → báo "Môn/HS đã bị dọn vĩnh viễn nên không khôi phục được."
- **U16** Hộp xoá HS dùng kết quả kiểm tra cũ tới 60 giây. → `staleTime: 0` cho `student.deleteCheck`.
- **U17** Log admin khôi phục tài khoản thiếu username. → ghi username như log xoá.

### 2.4 Đăng ký (O) — 1
- **U18** Đăng ký: tạo user và ghi đồng ý (consent) **không cùng transaction** → lỗi giữa chừng để lại tài khoản không có consent, thử lại báo trùng tên. → `registerUser` ghi consent trong cùng transaction.

### 2.5 Lịch / cài đặt (S) — 4
- **U19** Thẻ ca trên lịch desktop nháy "L5" → "Lớp 5" lúc tải (mỗi thẻ 1 `useMediaQuery`). → render cả 2 chuỗi, ẩn/hiện bằng CSS `md:`.
- **U20** Dòng meta của ca trên mobile (giờ | lớp | số HS) không xuống dòng, lớp dài tràn. → `flex-wrap`.
- **U21** Ô chọn ngân hàng thiếu `aria-controls` / `aria-activedescendant` cho trình đọc màn hình.
- **U22** Thanh ← → hiện "Ca 1/n" khi ca hiện tại không còn trong danh sách. → ẩn chữ vị trí khi không tìm thấy.

### 2.6 Admin / gói (K, P) — 6
- **U23** `getAdminStats` gọi `countNewAccounts` 2 lần (thẳng + trong `getPendingCount`). → dùng `pending.newAccounts`.
- **U24** "Trung bình/ngày" ở xu hướng tài khoản luôn định dạng vi-VN kể cả tiếng Anh. → theo ngôn ngữ đang chọn.
- **U25** Doanh thu 9+ chữ số tràn thẻ ở 390px. → thẻ `min-w-0`, số `break-words` + cỡ chữ nhỏ hơn trên mobile.
- **U26** "Hoạt động 24h" và "7 ngày" đếm cả tài khoản **bị khoá**. → bỏ tài khoản khoá ở cả hai.
- **U27** Popup mua gói, nhánh dự phòng (tải lại đơn lỗi) chỉ hiện mã SM, **không có số tiền**. → `createOrder` trả thêm `amount`, dự phòng hiện số tiền.
- **U28** Nhánh dự phòng phải chờ hết 1 lượt retry (Skeleton lâu). → hiện dự phòng ngay khi lần tải đầu lỗi (`failureCount > 0`).

### 2.7 Vệ sinh test — 3
- **U29** e2e `tuition-notice.spec` dọn HS theo `fullName startsWith` không chạy được (tên đã mã hoá) → HS test tồn đọng trong DB test. → helper giải mã rồi lọc.
- **U30** e2e `trash.spec` dọn HS còn nợ thất bại (không xoá được HS có tiền) → tồn đọng. → xoá cứng theo id ở `afterAll` (FK cascade).
- **U31** Chưa có test Báo cáo tháng cũ sau khi dọn HS. → thêm integration test: doanh thu tháng cũ giữ nguyên, tên hiện "Học sinh đã xoá".

## 3. Không làm

### 3.1 Đã được sửa ở phần sau (19)
B: giới hạn số tiền, timeout transaction (`TX_OPTIONS`), P2025 → NOT_FOUND, form tất toán theo dòng mới, toast xoá lần thu · J: dự phòng popup mua gói, aria `CurrentPlanBadge`, radiogroup phím mũi tên, sidebar dùng `pendingCount` + tab bar có số · L: chặn dùng thử cho admin, khoá khi đặt dùng thử · M: giới hạn xung đột theo mẫu, nhãn ca-slot · N: hộp reset mật khẩu không đóng khi đang chạy · Q: sửa lần thu đã xoá (extension soft-delete lọc `findUnique`), trang rỗng ở Thùng rác · Backlog: màu `COLORS.primary`, màu cấp đè ca huỷ, so giờ UTC.

### 3.2 Cố ý / đúng spec / không ảnh hưởng (21)
| Mục | Lý do |
|---|---|
| K1 Active 24h > 7 ngày mấy ngày đầu | Tự hết sau 7 ngày kể từ khi bắt đầu ghi (≈ 5/10). |
| L3 sắp giá theo createdAt trước id | Đã có id làm phụ; không có tình huống lệch thật. |
| L4 hộp dùng thử không có bước xác nhận riêng | Hạn mới hiện ngay trong hộp trước khi Lưu — đủ. |
| M3, server báo lỗi tiếng Việt | Người dùng đã chốt để sau (P). |
| N1 / P2 `/change-password` không redirect | Cố ý để tránh vòng lặp với middleware (spec P N1). |
| O2 consent ghi trước khi kiểm quyền | Cố ý: thời điểm đồng ý là lúc bấm Lưu (spec O Q11); dòng thừa không lộ dữ liệu. |
| O3 thiếu khoá mã hoá lúc chạy | Việc vận hành, đã có bước kiểm qa_test sau deploy. |
| O4, O5, S6, S7 | Lời văn báo cáo / commit cũ, không phải code. |
| P4 lazy expiry UPDATE mỗi lần tải trang admin | Chỉ đáng lo khi rất nhiều đơn. |
| Q3 cỡ trang 50 không về 20 khi đổi loại | Giữ lựa chọn của người dùng là hợp lý. |
| R3 tiếng Anh vẫn hiện "Học sinh đã xoá" | HS đã dọn không còn trong danh sách đang dùng, giao diện tiếng Anh hầu như không ai dùng. |
| R5 `purgeAll` không nguyên tử giữa các loại | Mỗi loại tự nguyên tử, bấm lại là dọn tiếp. |
| S4 danh sách ngân hàng không A-Z | Ngân hàng phổ biến lên đầu là cố ý, có ô tìm. |
| T3, T4 | Đúng spec T. |
| V7 `setNoticeSent` tính trạng thái 2 lần | Chỉ tối ưu, không ảnh hưởng người dùng. |
| Backlog 2: React #418 trên `/students` | Chưa tái hiện lại được; kiểm lại trên prod sau U, có lỗi mới mở việc riêng. |

## 4. Kiểm thử
- Mỗi mục có test RED → GREEN (unit / integration / e2e như plan ghi).
- Toàn bộ `pnpm test`, e2e 2 nửa, `tsc`, `lint` xanh.
- Kiểm tay trên prod (qa_test): sheet học phí HS trọn tháng hiện "(trọn gói)"; thẻ ca desktop không nháy; popup mua gói vẫn chạy.

## 5. Không làm trong U
- Không đổi schema DB, không migration.
- Không thêm tính năng mới; mọi thay đổi bám mục 2.
