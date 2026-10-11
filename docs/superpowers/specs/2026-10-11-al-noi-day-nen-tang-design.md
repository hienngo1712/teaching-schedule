# AL — Nơi dạy (nền tảng) + đăng ký chọn nơi dạy + gói chung mới

**Ngày:** 2026-10-11 · **Version:** 0.20.0 · **Có migration** (backup Neon trước merge) · **Bên code:** Claude-OTD

**Chuỗi:** AK (thanh lọc) → **AL** → AM (Bảng công + Thu nhập) → AN (Phiếu báo theo nơi, Chuyên cần, 12 tháng) → AO (payOS theo nơi).

**Mẫu UI:** `.superpowers/mockups/aj/` bản AJ5: 01, 02, 03, 04, 04b, 05a, 05b, 06a, 06b, 07a, 07b, 07c, 11, 14. Làm theo pattern UI cũ như bảng "Đồng bộ UI" trong `bao-cao-AJ.md`, thanh lọc dùng `FilterBar` mới của AK.

## 1. Mục tiêu

Một giáo viên có thể dạy ở nhiều nơi cùng lúc: lớp tại nhà, gia sư (tại nhà HS hoặc online, nhận qua nhóm gia sư) và trung tâm.

Mỗi **nơi dạy** có **cách tính tiền**:
- **Theo học sinh** (`per_student`): dùng trang Học phí như hiện nay.
- **Theo ca/giờ, nơi đó trả** (`per_session`): HS ở đó không có học phí. Tiền tính theo ca/giờ ở AM.

App chỉ hiện những gì GV cần:
- Không có nơi nào tính theo học sinh → ẩn toàn bộ phần học phí.
- Tài khoản cũ không thấy gì thay đổi.

## 2. Dữ liệu

```prisma
model TeachingPlace {
  id        Int       @id @default(autoincrement())
  userId    Int       @map("user_id")
  name      String    @db.VarChar(100)
  kind      String    @db.VarChar(10)   // home | tutor | center
  color     String    @db.VarChar(7)    // bảng 10 màu của Môn học
  sortOrder Int       @default(0) @map("sort_order")
  isDeleted Boolean   @default(false) @map("is_deleted")
  deletedAt DateTime? @map("deleted_at")
  createdAt DateTime  @default(now()) @map("created_at")
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  billingChanges PlaceBillingChange[]
  students  Student[]
  sessions  TeachingSession[]
  @@unique([userId, name])
  @@index([userId, isDeleted, sortOrder])
  @@map("teaching_places")
}

// Cách tính tiền theo thời gian, giống StudentBillingChange: fromKey = year*12 + month-1, 0 = mọi tháng.
model PlaceBillingChange {
  id        Int      @id @default(autoincrement())
  placeId   Int      @map("place_id")
  fromKey   Int      @map("from_key")
  billing   String   @db.VarChar(12)   // per_student | per_session
  createdAt DateTime @default(now()) @map("created_at")
  place     TeachingPlace @relation(fields: [placeId], references: [id], onDelete: Cascade)
  @@unique([placeId, fromKey])
  @@map("place_billing_changes")
}
```

Thêm vào model có sẵn:
- `Student.placeId Int? @map("place_id")`, FK SetNull, `@@index([placeId])`.
- `TeachingSession.placeId Int? @map("place_id")`, FK SetNull, `@@index([userId, placeId, sessionDate])`.

**Migration (một file, chạy được nhiều lần không hỏng):**
- Mỗi user chưa có nơi dạy được tạo 1 nơi `"Lớp tại nhà"`, `kind=home`, màu đầu bảng, với `PlaceBillingChange{fromKey:0, billing:per_student}`.
- Gán `placeId` của mọi Student và TeachingSession của user đó vào nơi vừa tạo.
- Viết bằng SQL thuần trong migration (`INSERT ... SELECT`, `UPDATE ... FROM`). Không cần script riêng.
- **User đăng ký mới sau migration KHÔNG được tạo sẵn nơi dạy.** Họ chọn ở popup (mục 5).

`placeId` để nullable cho an toàn. Code đọc `null` thì coi là nơi `per_student` mặc định của user: nơi `per_student` đầu tiên theo `sortOrder`. Nếu user không có nơi nào thì coi là `per_student`.

## 3. Quy tắc tính tiền

- Hàm thuần `resolvePlaceBilling(changes, key) → "per_student" | "per_session"` đặt cạnh `resolveBilling` hiện có. Lấy dòng có `fromKey` lớn nhất ≤ key. Không có dòng nào thì trả `per_student`.
- **HS thuộc nơi `per_session` trong tháng M** thì học phí tháng M = 0. Áp ở mọi chỗ đang tính học phí:
  - `tuition.service` (danh sách, snapshot, nợ chạy)
  - `report.service` (doanh thu, dự kiến, đã thu, còn nợ, Tổng quan)
  - `attendance.service` (phí từng buổi hiển thị)
  - phiếu báo, payOS HS, sao lưu Excel, xuất Excel
- **Đổi cách tính tiền của một nơi:** tạo/ghi đè `PlaceBillingChange{fromKey = tháng hiện tại VN}`. Tháng cũ giữ nguyên. Giống hệt cách đổi theo buổi/theo tháng của HS.
- **Danh sách Học phí tháng M:** chỉ gồm HS mà nơi học tính theo học sinh trong tháng M. **Ngoại lệ:** HS ở nơi `per_session` nhưng còn nợ cũ (`previousBalance > 0`) vẫn hiện, kèm nhãn tên nơi học, để thu nốt.
- **Đổi nơi học của HS** chỉ đổi `Student.placeId`, không có lịch sử. Áp cho mọi tháng chưa chốt snapshot. Snapshot đã ghi không bị viết lại. Đây là chủ đích, giống quy tắc hiện nay. Ghi chú trong code.

## 4. Màn hình

### 4.1 Nơi dạy (mới): `/places`, nhóm Quản lý dưới Môn học, tab mobile ở "Thêm"
- Dựng theo trang Môn học (`SubjectList` + `SubjectFormDialog`), mẫu 07a.
- Dòng: chấm màu · tên · dòng phụ "loại · cách tính tiền" · menu ⋯ (Sửa, Xoá).
- **Form:**
  - Tên (bắt buộc, ≤100, không trùng).
  - Loại: 3 nút segmented Lớp tại nhà / Gia sư / Trung tâm.
  - Cách tính tiền: 2 lựa chọn. Mặc định theo loại: home/tutor → theo học sinh; center → theo ca/giờ.
  - Màu: bảng 10 màu như Môn học.
- **Sửa cách tính tiền của nơi đã có dữ liệu:** hiện dòng cảnh báo "Áp dụng từ tháng M/YYYY, các tháng trước giữ nguyên".
- **Xoá:** chặn nếu còn HS đang học hoặc còn ca từ hôm nay trở đi. Báo "Chuyển học sinh/ca sang nơi khác trước". Còn lại thì xoá mềm (`isDeleted`). Không cần tab Thùng rác.
- **Không cho xoá nơi cuối cùng.**
- Gói: mọi gói (Standard trở lên).

### 4.2 Học sinh (mẫu 05a/05b)
- Form thêm/sửa có ô **"Nơi học"** (Select, chấm màu, mục cuối "+ Thêm nơi dạy" mở form nơi dạy).
- **Chỉ hiện khi user có ≥ 2 nơi.** User có 1 nơi thì form giữ nguyên như hiện nay, `placeId` tự gán nơi đó.
- Nơi học là `per_session` (tháng hiện tại) → **ẩn khối học phí** (theo buổi/tháng, số tiền) và gửi `tuitionFee=0`, `monthlyFee=0` nếu tạo mới. Sửa HS cũ thì giữ số cũ trong DB, chỉ ẩn.
- Danh sách HS: thêm Bộ lọc "Nơi học" (AK pattern). Cột/dòng học phí hiện "—" với HS ở nơi `per_session`.
- Nhập Excel: không thêm cột. HS nhập vào nơi `per_student` mặc định.
- Sao lưu Excel thêm cột "Nơi học".

### 4.3 Ca dạy (mẫu 07b, 07c)
- Form tạo/sửa ca có ô **"Nơi dạy"** (chỉ hiện khi ≥ 2 nơi). Mặc định = nơi học của HS đầu tiên được chọn, hoặc nơi của ca trước đó GV vừa tạo.
- HS được chọn khác nơi với ca → dòng nhắc nhẹ màu vàng "Có học sinh thuộc nơi khác", vẫn cho lưu.
- **Học phí HS vẫn tính theo nơi học của HS, không theo nơi của ca.**
- Lịch dạy lặp, chép lịch tháng giữ `placeId` của ca nguồn.
- Lịch: Bộ lọc thêm "Nơi dạy" (khi ≥ 2 nơi). Thẻ ca có **chấm màu + tên nơi** khi ≥ 2 nơi. Giữ màu nền theo cấp học như cũ, không đổi màu thẻ.
- Chi tiết ca hiện tên nơi.

### 4.4 Hiện/ẩn theo nơi đang có
Query `place.summary → { count, hasPerStudent, hasPerSession }` tính theo tháng hiện tại VN, dùng chung một hook `usePlaceSummary()`.

Khi **`hasPerStudent = false`** (chỉ dạy trung tâm), ẩn:
- tab **Học phí**, **Báo cáo**
- 5 ô tiền ở Tổng quan (Học phí đã dạy, Đã thu, Còn nợ, Học phí dự kiến) và nhóm "Còn nợ tháng trước"
- chuông payOS
- bước "thu tiền"/"ngân hàng" của thẻ Bắt đầu (StartCard)

Mẫu 04b.

**Gõ thẳng URL `/tuition` hoặc `/reports`** → hiện trang trống có câu "Bạn chưa có nơi dạy nào tính học phí theo học sinh" + nút "Mở Nơi dạy".

`hasPerSession` dùng ở AM (tab Bảng công). AL chưa có gì cần nó.

Cài đặt **luôn** hiện thẻ ngân hàng và payOS (AM/AN cần cho phiếu theo nơi).

### 4.5 Học phí (mẫu 14)
- Bộ lọc thêm "Nơi học" (khi ≥ 2 nơi `per_student` hoặc có ngoại lệ còn nợ).
- Dòng HS có nhãn nhỏ tên nơi khi ≥ 2 nơi.

### 4.6 Trang phụ huynh (mẫu 11)
- HS ở nơi `per_session` trong tháng đang xem → **ẩn** khối học phí/phiếu báo/QR, chỉ còn lịch học + điểm danh.
- Mỗi buổi ghi tên nơi khi GV có ≥ 2 nơi.
- Chữ chia sẻ link cho HS đó: "Xem lịch học và điểm danh của …". HS `per_student` giữ chữ cũ.

## 5. Đăng ký: chọn nơi dạy + chọn gói (mẫu 01, 02)

- **Popup** hiện khi user đã đăng nhập, **chưa có nơi dạy nào** và không phải admin. Không có nút đóng (phải chọn), chạy trước tour/Có gì mới.
- **Bước 1: "Bạn đang dạy ở đâu?"**, 3 ô tick chọn nhiều:
  - Lớp tại nhà → tạo nơi "Lớp tại nhà", home, per_student.
  - Gia sư (tại nhà học sinh, online) → tạo nơi "Gia sư", tutor, per_student.
  - Trung tâm → tạo nơi theo từng tên trung tâm nhập ở ô hiện ra (không bắt buộc, thêm được nhiều, trống thì tên "Trung tâm"), center, per_session.
  - Không tick gì vẫn cho Tiếp tục → tạo "Lớp tại nhà".
  - Gọi `place.setupInitial({ home, tutor, centers: string[] })`, chạy 1 transaction. **Gọi lần 2 khi đã có nơi dạy thì bỏ qua**, không tạo trùng.
- **Bước 2: "Chọn gói để bắt đầu"**: 3 thẻ như `PlanCompare` (phương án A).
  - Nút chính to nhất "Bắt đầu miễn phí" đóng popup.
  - "Mua gói Plus/Pro" mở `PlanPurchaseDialog` hiện có. Đóng popup mua thì về app, không quay lại bước 2.
  - **Không** có nhãn "MỚI" ở popup này.

## 6. Gói chung mới

- `STUDENT_LIMITS`: standard **20**, plus **50**, pro không giới hạn (đếm mọi HS đang học như hiện nay).
- `DEFAULT_MONTH_PRICES` (giá dự phòng khi DB thiếu): plus **39000**, pro **69000**. Giá thật người dùng tự đặt ở `/admin/prices`, không migration giá.
- `PLAN_FEATURES` thêm dòng `places` (Standard). Chữ trong `feature-labels.ts` + vi/en: "Nơi dạy: lớp tại nhà, gia sư, trung tâm".
- Trang "Gói của tôi" (06a) và `PlanCompare`:
  - Nhãn **"MỚI"** cạnh tính năng mới, chỉ hiện trong 30 ngày kể từ ngày phát hành 0.20.0. Hằng số ngày trong code.
  - Popup đăng ký không có nhãn này.
- Mục "Có gì mới" 0.20.0 ghi rõ: Standard nâng lên 20 HS, Plus 50 HS.

## 7. Ngoài phạm vi AL

Bảng công, thu nhập, đơn giá, đã nhận tiền (AM). Phiếu báo theo nơi, trang người trả, chuyên cần (AN). payOS theo nơi (AO). Báo cáo lọc theo nơi (AN).

## 8. Test chính

- Migration trên DB test có dữ liệu mẫu:
  - mỗi user có đúng 1 nơi
  - mọi HS/ca có `placeId`
  - chạy lại không nhân đôi
  - tổng học phí/nợ/doanh thu trước = sau (so số `report.monthlySummary` + `report.dashboard` trước và sau migration bằng test integration dựng dữ liệu rồi gọi hàm backfill SQL)
- `resolvePlaceBilling` (unit): không dòng / nhiều dòng / đổi giữa chừng.
- HS ở nơi `per_session`:
  - học phí tháng = 0, không vào danh sách Học phí, không vào doanh thu/còn nợ
  - còn nợ cũ thì vẫn hiện
  - đổi nơi sang `per_session` từ tháng này thì tháng trước giữ nguyên số
- `place.summary` đúng 3 trường hợp: chỉ home, chỉ center, hỗn hợp.
- Ẩn/hiện: user chỉ center không có tab Học phí/Báo cáo, Tổng quan không có ô tiền. User 1 nơi không thấy ô Nơi học / Nơi dạy.
- `setupInitial`: tạo đúng nơi theo tick; gọi lần 2 không tạo thêm.
- Xoá nơi: chặn khi còn HS đang học / ca tương lai; chặn nơi cuối.
- Giới hạn 20/50.
- Trang phụ huynh của HS `per_session` không có phiếu/QR.
- e2e: đăng ký mới → popup → tick Trung tâm + nhập "TT Ánh Dương" → Bắt đầu miễn phí → menu không có Học phí. Thêm nơi "Lớp tại nhà" → tab Học phí hiện.
- Ảnh 375/1280 mọi màn đổi, tự xem.
