# AP — Hướng dẫn sử dụng + ảnh + tour cho Nơi dạy, Bảng công, Phiếu nơi dạy, Chuyên cần (0.24.0)

## 1. Mục tiêu

Chuỗi AK→AO (0.19.0 → 0.23.0) đã lên prod nhưng Hướng dẫn sử dụng (`/guide` + file Word) chưa có mục nào cho tính năng mới, và ảnh cũ còn thanh lọc / menu kiểu cũ.

AP làm 4 việc:
- viết mục mới
- sửa mục cũ cho khớp giao diện mới
- chụp lại toàn bộ ảnh hướng dẫn
- thêm 2 tour "Chỉ cho tôi"

Đồng thời ghi luật vào tài liệu dự án: từ nay mọi tính năng mới phải kèm hướng dẫn, ảnh và tour trong cùng đợt.

**Không** migration. **Không** đổi logic nghiệp vụ. Chỉ đụng nội dung hướng dẫn, ảnh, tour (data-tour + i18n), tài liệu.

## 2. Nguồn nội dung

- `src/lib/guide-content.ts`: nguồn duy nhất cho `/guide` và file Word. Chỉ tiếng Việt (spec W §3.1).
- `tests/guide-shots/guide-shots.spec.ts` + `demo-data.ts`: chụp ảnh `public/guide/<shot>-{desktop,mobile}.jpg`.
- `pnpm guide:docx`: sinh `public/guide/huong-dan-su-dung.docx`.
- `src/lib/tours.ts`: tour, `GUIDE_TOURS` gắn nút "Chỉ cho tôi" vào mục hướng dẫn.

Giọng văn: theo các mục sẵn có. Câu ngắn, mỗi bước 1 việc, tên nút in đậm `**...**`, không thuật ngữ kỹ thuật.

## 3. Mục mới (thêm vào `GUIDE_SECTIONS`)

Thứ tự đề xuất: sau `lich-day`/`diem-danh` là **noi-day**; sau `bao-cao` là **bang-cong**, **phieu-noi-day**, **chuyen-can**.

### 3.1 `noi-day` — "Nơi dạy"

- **Intro:** dạy ở nhiều nơi (lớp tại nhà, gia sư, trung tâm), mỗi nơi tính tiền một kiểu.
- **Bước:**
  1. Lúc đăng ký: popup **Bạn đang dạy ở đâu?** Chọn một hoặc nhiều nơi, trung tâm nhập tên. Sau đó chọn gói hoặc **Bắt đầu miễn phí**. Ảnh: popup bước 1.
  2. Mở **Nơi dạy** (điện thoại: **Thêm** → **Nơi dạy**). Danh sách chia 2 nhóm: tính tiền theo học sinh, tính tiền theo ca/giờ. Ảnh.
  3. **Thêm nơi dạy**: tên, loại, **Cách tính tiền**:
     - **Theo học sinh (học phí):** như hiện nay.
     - **Theo ca/giờ, nơi này trả:** học sinh ở nơi đó không có học phí.
     Ảnh: form.
  4. Có từ 2 nơi trở lên: form học sinh có ô **Nơi học**, form ca có ô **Nơi dạy**. Thẻ ca trên lịch có chấm màu + tên nơi. Ảnh: form ca có Nơi dạy.
  5. Đổi cách tính của một nơi chỉ áp dụng từ tháng hiện tại. Tháng trước giữ nguyên, nợ cũ không mất.
- **Mẹo:**
  - Không xoá được nơi cuối cùng, hoặc nơi còn học sinh / ca sắp tới. Chuyển học sinh sang nơi khác trước.
  - Chỉ dạy trung tâm: Học phí và Báo cáo tự ẩn, thay bằng Bảng công.

### 3.2 `bang-cong` — "Bảng công và Thu nhập"

- **Intro:** cho nơi tính tiền theo ca/giờ. Đối chiếu số ca, số giờ với trung tâm và theo dõi tiền nơi đó đã trả.
- **Bước:**
  1. **Đơn giá:** sửa nơi dạy → **Đơn giá**:
     - chọn **Theo ca** / **Theo giờ**, nhập số tiền
     - nơi đã có ca thì chọn **Áp dụng từ tháng**
     - để trống nếu chưa muốn tính thu nhập
     Ảnh: form có đơn giá.
  2. Mở **Bảng công**, tab **Bảng công** (gói Plus): chọn nơi và tháng, xem số ca đã dạy, giờ, ca bù, ca huỷ. Ảnh.
  3. **⋯** → xuất Excel / ảnh để gửi trung tâm. Mặc định không kèm tiền; tick **Kèm số tiền** nếu cần.
  4. Tab **Thu nhập**: mỗi nơi có thu nhập dự kiến, đã nhận, còn thiếu và trạng thái (Chưa nhận / Nhận một phần / Đã nhận đủ). Ảnh.
  5. Bấm vào một nơi để xem diễn giải. Bấm **Ghi nhận đã nhận** (gói Plus) khi trung tâm trả tiền. Ảnh: sheet chi tiết.
  6. Tổng quan có thẻ **Thu nhập tháng này** và **Giờ dạy tháng này**. Gói Pro có nhóm **Nơi dạy còn thiếu tiền tháng trước** ở **Cần chú ý**. Ảnh: Tổng quan hỗn hợp.
- **Mẹo:**
  - Ca đã dạy = ca không huỷ và ngày ≤ hôm nay. Ca bù vẫn tính công.
  - Gói Pro: thẻ **Thu nhập 12 tháng gần nhất** ở tab Thu nhập.

### 3.3 `phieu-noi-day` — "Phiếu báo cho nơi dạy"

- **Bước:**
  1. Ở **Thu nhập**, bấm **Phiếu báo** trên dòng nơi dạy (gói Plus). Ảnh: hộp phiếu.
  2. Phiếu có ngày đã dạy, số ca/giờ, đơn giá, đã nhận, còn phải trả, mã QR chuyển khoản (cần **Tài khoản nhận học phí** trong Cài đặt).
  3. **Sao chép link gửi** hoặc **Lưu ảnh** rồi gửi cho trung tâm. App tự đánh dấu **Đã gửi**, có **Hoàn tác**.
  4. Trung tâm mở link là xem được phiếu và các ca đã dạy, **không có tên học sinh**, không cần đăng nhập. Ảnh: trang người trả.
  5. Gửi nhầm link: menu **⋯** của nơi dạy → **Tạo link mới** (link cũ hết hiệu lực ngay) hoặc **Tắt link**.
- **Mẹo:**
  - Tháng chưa có ca đã dạy hoặc nơi chưa có đơn giá thì chưa tạo được phiếu.
  - Gói Pro đã nối payOS: phiếu có QR payOS, tiền vào tự ghi **Đã nhận** (xem mục payOS).

### 3.4 `chuyen-can` — "Chuyên cần"

- **Bước:**
  1. Mở **Chuyên cần** (điện thoại: **Thêm** → **Chuyên cần**). Theo tháng (gói Plus): tỉ lệ đi học, có mặt, vắng, muộn; mỗi học sinh có thanh tỉ lệ. Ảnh.
  2. Chọn **Năm học** (gói Pro): tháng 9 → tháng 5 năm sau, mỗi học sinh 1 dải màu theo tháng. Ảnh.
  3. **Bộ lọc**: theo nơi dạy, theo lớp (Pro). Nút Excel để xuất.
- **Mẹo:** tỉ lệ = (có mặt + muộn) / số buổi đã điểm danh. Ca huỷ, buổi chưa điểm danh không tính.

## 4. Sửa mục cũ

| Mục | Sửa |
|---|---|
| `bat-dau` | Thêm bước popup chọn nơi dạy + gói, trỏ sang mục Nơi dạy. Thẻ **Còn nợ** ở Tổng quan ghi 2 dòng **Tháng này / Các tháng trước**. |
| `hoc-sinh` | **Thêm học sinh ▾** trên đầu trang. **Nâng lớp hàng loạt** trong **⋯**. Ô **Nơi học** khi có ≥2 nơi. Lọc lớp / trạng thái / nơi trong **Bộ lọc**. |
| `lich-day` | **Tạo ca dạy ▾** gồm **Lịch lặp** và **Chép lịch tháng**. **Xuất Excel** trong **⋯**. Ô **Nơi dạy** khi ≥2 nơi. **Bộ lọc** lọc lớp / nơi. |
| `hoc-phi` | **Trạng thái** để ngoài, các lọc khác trong **Bộ lọc** (chip bỏ từng lọc, **Xoá lọc**). Lọc **Nơi học** khi có nhiều nơi. |
| `bao-cao` | **Bộ lọc**, lọc **Nơi học**, nhãn kỳ rút gọn. Nút **Xuất Excel** để ngoài. |
| `payos-hoc-phi` | Kết nối payOS dùng chung cho học phí và phiếu nơi dạy (gói Pro). Chuông **Tiền vào qua payOS** có cả dòng nơi dạy, bấm mở đúng nơi ở Thu nhập. |
| `goi-dich-vu` | Giới hạn học sinh **Standard 20 / Plus 50 / Pro không giới hạn**. Không ghi giá cứng (giá đổi ở admin). |
| `thung-rac` | Nút dọn nằm trong **⋯**; hàng tab cuộn ngang trên điện thoại. |
| `sao-luu` | File có thêm sheet **Nơi dạy**, **Đơn giá**, **Tiền nơi dạy trả**. |

## 5. Ảnh

- **Chụp lại TOÀN BỘ ảnh** có trong `GUIDE_SHOTS`, vì thanh lọc / menu đã đổi. Cả 2 khổ `desktop` (1280×800) và `mobile` (780×1688, DPR 2 ~ 390px), như hiện tại.
- **`demo-data.ts`** thêm:
  - 1 nơi "Lớp tại nhà" (theo học sinh)
  - 1 nơi "TT Ánh Dương" (theo ca, 150.000đ/ca), có ca đã dạy trong tháng chụp
  - 1 lần đã nhận
  - tài khoản ngân hàng demo như ảnh phiếu học phí hiện có
  - học sinh / ca demo gắn nơi phù hợp
- **Tên shot mới:** `noi-day-popup`, `noi-day-danh-sach`, `noi-day-form`, `lich-day-noi-day`, `bang-cong-don-gia`, `bang-cong`, `thu-nhap`, `thu-nhap-chi-tiet`, `tong-quan-thu-nhap`, `phieu-noi-day`, `phieu-noi-day-nguoi-tra`, `chuyen-can-thang`, `chuyen-can-nam-hoc`.
- Không chân trang dev, không dữ liệu thật, không mã khoá/số tài khoản thật (dùng số demo như ảnh hiện có).
- Sau khi chụp: `pnpm guide:docx`. File Word phải có đủ mục mới và ảnh.

## 6. Tour mới

Hai tour, cùng cơ chế `TOURS` / `data-tour` / i18n `tour_*` (vi + en) như tour AD.

### 6.1 `place` — href `/places`, gắn mục `noi-day`

1. `place-add` — "Thêm nơi dạy" (advanceOn click)
2. `place-form-name` — tên nơi
3. `place-form-kind` — loại nơi
4. `place-form-billing` — cách tính tiền (giải thích 2 lựa chọn)
5. `place-form-rate` — đơn giá (không bắt buộc)
6. `place-form-submit` — Lưu

### 6.2 `income` — href `/timesheet?tab=income`, gắn mục `bang-cong`

`requires: "perSessionPlace"`. Chưa có nơi theo ca/giờ thì 1 bước giữa màn, nút Tiếp chuyển sang tour `place` (theo mẫu `MISSING_STEPS`).

1. `income-month` — chọn tháng
2. `income-row` — dòng nơi dạy: dự kiến / đã nhận / còn thiếu
3. `income-notice` — Phiếu báo cho trung tâm
4. `income-row` (advanceOn click) — mở chi tiết
5. `income-record` — Ghi nhận đã nhận

- Standard: nút trong tour bị khoá thì tour vẫn chạy và mô tả "gói Plus". Không mở UpgradeDialog giữa tour.
- Điện thoại: phần tử nằm trong sheet / dialog phải tô sáng được (đã có tiền lệ ở tour `tuition`).
- Mục `phieu-noi-day` dùng chung tour `income`; `chuyen-can` không cần tour.
- `GUIDE_TOURS` thêm: `"noi-day": "place"`, `"bang-cong": "income"`, `"phieu-noi-day": "income"`.

## 7. Luật mới trong tài liệu dự án

Thêm vào `docs/coding-rule.md` (mục quy trình / trước khi phát hành) và `.superpowers/gehihi/LENH.md`, nếu có:

> Mọi màn, chức năng hoặc tính năng mới (hoặc đổi giao diện màn cũ) phải kèm trong CÙNG đợt: mục Hướng dẫn sử dụng (`guide-content.ts`), ảnh chụp lại (`guide-shots` + `pnpm guide:docx`), tour "Chỉ cho tôi" nếu màn có thao tác nhiều bước, và "Có gì mới". Plan phải có task riêng cho phần này trước task phát hành; review thiếu phần này là FIX.

## 8. Phát hành

- Version **0.24.0**.
- "Có gì mới": hướng dẫn mới cho Nơi dạy, Bảng công, Phiếu nơi dạy, Chuyên cần; tour Chỉ cho tôi cho Nơi dạy và Thu nhập.

## 9. Kiểm thử

- Unit:
  - `GUIDE_SECTIONS` có 4 id mới; mọi `shot` có file ảnh tương ứng trong `public/guide` (test hiện có kiểu này thì mở rộng).
  - `GUIDE_TOURS` trỏ id tồn tại.
  - Mọi `data-tour` của tour mới có mặt trong component (test kiểu tour AD).
- e2e tour:
  - `place` chạy hết 6 bước ở 1280 và 375.
  - `income` chạy hết khi có nơi theo ca; khi không có thì hiện bước thiếu và chuyển sang `place`.
- guide-shots chạy đủ, không lỗi. Tự xem ảnh mobile của 4 mục mới.
- Full vitest + full e2e ở task phát hành; xoá `.next` trước e2e.
