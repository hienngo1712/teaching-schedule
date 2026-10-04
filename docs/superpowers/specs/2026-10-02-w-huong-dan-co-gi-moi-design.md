# W — Hướng dẫn sử dụng + thẻ "Bắt đầu" + "Có gì mới"

> Ngày: 2026-10-02 · Người yêu cầu: chủ ứng dụng · Phiên bản: **0.11.0** (minor, **có migration**: 2 cột trên `users`). Cập nhật 2026-10-04: Y (0.10.0) chen trước nên W thành 0.11.0.
> Làm sau X (0.9.5). Người dùng duyệt hướng ngày 2026-10-02: làm cả 3 dạng hướng dẫn nhưng chung 1 nguồn nội dung; thẻ "Bắt đầu" thay tour; popup "Có gì mới" theo bố cục mẫu iOne (màu của mình); chỉ tự mở ở bản có thay đổi người dùng thấy; trạng thái đã xem lưu DB.

## 1. Mục tiêu

- Giáo viên mới tự dùng được app không cần hỏi: có trang hướng dẫn đầy đủ, tải PDF để gửi nhau, và thẻ 5 bước trên Tổng quan dẫn họ làm lần đầu.
- Mỗi bản có tính năng mới, giáo viên **được báo ngay trong app**: thay đổi gì, ở đâu, xem chi tiết ở đâu, để khỏi hỏi lại.

## 2. Ba phần

| Phần | Là gì | Ai thấy |
|---|---|---|
| **W1 Hướng dẫn** `/guide` | Trang nội dung theo mục, có mục lục, nút "Tải PDF" | Mọi người (công khai như `/privacy`) |
| **W2 Thẻ "Bắt đầu"** | Thẻ 5 bước trên `/dashboard` | Giáo viên chưa xong 5 bước và chưa ẩn thẻ |
| **W3 "Có gì mới"** | Nút trên thanh đầu trang + ô thả xuống + trang `/updates` | Giáo viên (không phải admin) |

## 3. W1 — Trang hướng dẫn `/guide`

### 3.1 Nội dung (nguồn duy nhất)
- `src/lib/guide-content.ts`: mảng mục `{ id, title, intro?, steps: string[], tips?: string[] }`. `id` là anchor (`#hoc-sinh`), dùng cho link từ W2 và W3.
- Mục (thứ tự):
  1. `bat-dau` Đăng ký, đăng nhập, đổi mật khẩu
  2. `mon-hoc` Môn học
  3. `hoc-sinh` Học sinh: thêm, sửa, nghỉ học; **cách thu theo buổi / trọn tháng**
  4. `nhap-excel` Nhập học sinh từ Excel
  5. `lich-day` Lịch dạy: tạo ca, ca lặp, chuyển ca, huỷ ca, ca bù
  6. `diem-danh` Điểm danh
  7. `hoc-phi` Học phí: thu tiền, phiếu báo QR, đánh dấu đã gửi, link phụ huynh
  8. `bao-cao` Báo cáo tháng
  9. `tai-khoan-ngan-hang` Tài khoản nhận học phí
  10. `goi-dich-vu` Gói Standard / Plus / Pro, dùng thử, gia hạn
  11. `thung-rac` Thùng rác, khôi phục
  12. `sao-luu` Sao lưu Excel
  13. `bao-mat` Bảo mật dữ liệu (tóm tắt + link `/privacy`)
- **Mỗi bước trong plan phải đối chiếu giao diện thật** (tên nút, tên menu đúng như i18n `vi.json`). Không dùng ảnh chụp màn hình (nhanh lỗi thời); chỉ chữ + tên nút in đậm.
- **Chỉ tiếng Việt.** Giao diện tiếng Anh vẫn hiện nội dung tiếng Việt; tiêu đề trang, nút, mục lục dịch qua i18n. (Ít người dùng tiếng Anh, giống quyết định R3 ở spec U.)

### 3.2 Trang
- Trang công khai, bố cục như `/privacy` (không sidebar): tiêu đề, mục lục (link anchor), các mục, chân trang link `/privacy` + `/login`.
- Thêm `guide` vào danh sách loại trừ của `src/middleware.ts` matcher.
- **Tải PDF** = nút gọi `window.print()`. CSS `@media print`: ẩn nút, mục lục, chân trang; mỗi mục không bị cắt giữa (`break-inside: avoid` cho bước); chữ đen nền trắng. Không thư viện PDF.
- Mở từ app: mục **"Hướng dẫn sử dụng"** trong menu avatar (`AppHeader`, có cả trên mobile), **mở tab mới**. (Điều chỉnh khi viết plan: không thêm vào tab "Thêm" mobile vì danh sách đó toàn link cùng tab; menu avatar đã có trên mobile.) Trang Đăng nhập thêm link "Hướng dẫn" cạnh "Chính sách bảo mật".
- `page.tsx` không đọc `params/searchParams` (luật `next15-contract.test.ts`).

## 4. W2 — Thẻ "Bắt đầu" trên Tổng quan

### 4.1 5 bước, tự tick theo dữ liệu thật (chỉ đếm bản ghi chưa xoá mềm)
| # | Bước | Xong khi | Nút |
|---|---|---|---|
| 1 | Thêm học sinh | có ≥ 1 `Student` | → `/students` |
| 2 | Tạo ca dạy | có ≥ 1 `TeachingSession` | → `/calendar` |
| 3 | Điểm danh 1 ca | có ≥ 1 `SessionStudent.attendance ≠ "pending"` (ca chưa xoá) | → `/calendar` |
| 4 | Thu học phí | có ≥ 1 `Payment` của HS mình | → `/tuition` |
| 5 | Cài tài khoản nhận học phí | `users.bankAccountNumber` có giá trị (đọc rồi kiểm ở JS, không lọc DB theo trường mã hoá) | → `/settings` |

- **Điều chỉnh khi viết plan (2026-10-02):** bản đầu có bước "Thêm môn học", nhưng đăng ký đã tự tạo 5 môn mặc định (`seedSubjectsForUser`) nên bước này luôn xong ngay. Thay bằng "Cài tài khoản nhận học phí" (cần cho phiếu báo QR). Bước "Tạo ca" ghi chú "App đã tạo sẵn vài môn, sửa ở Môn học". Hệ quả: tài khoản cũ chưa cài ngân hàng sẽ thấy thẻ (4/5), bấm Ẩn được.

- Mỗi dòng có link "Xem hướng dẫn" → `/guide#<id>` tab mới.
- Thanh tiến độ "2/5".

### 4.2 Hiện / ẩn
- Hiện khi: giáo viên (không admin), **chưa đủ 5 bước** và `onboardingDismissedAt` null.
- Nút "Ẩn" (X) → ghi `onboardingDismissedAt = now()`, ẩn vĩnh viễn trên mọi máy.
- Đủ 5 bước → thẻ tự ẩn, không ghi gì.
- Tài khoản cũ đã có dữ liệu → đủ 5 bước → không thấy thẻ (không cần cờ "tài khoản mới").
- Vị trí: đầu `/dashboard`, trên `DashboardAlerts`.

### 4.3 API
- `onboarding.status` (query, `protectedProcedure`): `{ dismissed: boolean, steps: { student, session, attendance, payment, bank: boolean } }`. Mỗi bước 1 truy vấn `findFirst({ select: { id: true } })` của user, chạy song song.
- `onboarding.dismiss` (mutation).

## 5. W3 — "Có gì mới"

### 5.1 Nguồn dữ liệu
- `src/lib/releases.ts`: mảng, **bản mới nhất đầu tiên**:
  ```ts
  type ReleaseItem = { kind: "new" | "improve" | "fix"; title: string; body: string; guideId?: string }
  type Release = { version: string; date: string /* YYYY-MM-DD */; title: string; summary: string; notify: boolean; items: ReleaseItem[] }
  ```
- `notify: true` = bản có thay đổi người dùng thấy → tự mở. Bản sửa nhỏ: `notify: false`, vẫn ghi để hiện ở `/updates`.
- **Test bắt buộc**: `RELEASES[0].version === package.json version` → mỗi lần nâng version (kể cả patch) phải thêm mục. Ghi luật này vào `docs/05-deploy.md` (checklist deploy) và bước "nâng version" của mọi plan sau.
- Chỉ tiếng Việt như W1.
- Mục ban đầu: `0.11.0` (notify, giới thiệu Hướng dẫn, thẻ Bắt đầu, Có gì mới, nhắc lại Thu học phí 1 chạm, mã hoá dữ liệu cá nhân), `0.10.0` (notify, luồng thu học phí Y, trang phụ huynh 2 cột) và `0.9.5` (notify false: xác nhận mật khẩu, tóm tắt chính sách).

### 5.2 Nút trên thanh đầu trang
- `AppHeader` (biến thể teacher), bên trái nút ngôn ngữ.
- Desktop: nút viền "✦ Có gì mới" + nhãn version `v0.10` (major.minor). Mobile: chỉ icon ✦, `size-11`.
- Chấm báo (teal) khi có bản `notify` mới hơn `lastSeenRelease`.

### 5.3 Ô "Có gì mới" (bố cục theo mẫu iOne, màu của app)
- Desktop: `Popover` neo dưới nút, rộng ~420px. Mobile: `Sheet` trượt từ dưới.
- Phần đầu: nền chuyển `primary` (#0F766E → teal đậm hơn), chữ trắng: nhãn "CÓ GÌ MỚI" + ngày (dd/MM/yyyy), tiêu đề bản, tóm tắt; nút X góc phải.
- Thân: tối đa 5 mục của bản đang hiện; mỗi mục: icon trong ô vuông bo góc nhạt (theo `kind`), tiêu đề + nhãn nhỏ (`MỚI` / `CẢI TIẾN` / `SỬA LỖI`), mô tả 1–2 dòng. Hơn 5 mục → dòng "và N thay đổi khác".
- Chân: nút **"Tìm hiểu thêm ↗"** → `/updates#v<version>` tab mới.
- Bản hiện trong ô: bản `notify` mới nhất (bấm nút lúc không có bản mới vẫn hiện bản này).
- Màu theo luật A3 (teal/slate, không indigo/violet/purple).

### 5.4 Tự mở và "đã xem"
- Cột `users.last_seen_release` (`VARCHAR(20)`, null).
- Tự mở **1 lần** khi vào app nếu tồn tại bản `notify` có version **lớn hơn** `lastSeenRelease` (so semver số, null = nhỏ nhất).
- Đóng ô (X, bấm ngoài, Esc) → `release.markSeen({ version: <bản notify mới nhất> })` → ghi cột; chấm báo tắt. Server chỉ ghi khi version gửi lên có trong `RELEASES` và lớn hơn giá trị đang có.
- Mutation lỗi → lần sau ô mở lại; không báo lỗi cho người dùng.
- **Đăng ký mới**: `registerUser` ghi `lastSeenRelease = RELEASES[0].version` → không tự mở; họ thấy thẻ Bắt đầu.
- **Không chồng popup**: tài khoản `mustChangePassword` đã bị layout `(app)` chuyển sang `/change-password` (ngoài layout có thanh đầu trang) nên ô không thể mở ở đó; không cần xử lý thêm.
- Admin: không có nút, không tự mở.
- Dữ liệu trạng thái: `release.status` (query) trả `{ lastSeenRelease: string | null }`; danh sách bản đọc thẳng từ `releases.ts` ở client.

### 5.5 Trang `/updates`
- Công khai như `/guide` (thêm vào matcher middleware).
- Liệt kê mọi bản mới → cũ, mỗi bản là 1 khối `id="v0.10.0"`: version, ngày, tiêu đề, tóm tắt, toàn bộ mục; mục có `guideId` có link "Xem hướng dẫn" → `/guide#<id>`.
- Nút "Tải PDF" (in) như W1, dùng chung CSS in.

## 6. Migration
- `ALTER TABLE users ADD COLUMN last_seen_release VARCHAR(20), ADD COLUMN onboarding_dismissed_at TIMESTAMP(3);` (chỉ thêm cột, null). Tài khoản cũ: `last_seen_release` null → thấy bản 0.11.0 tự mở (người dùng duyệt câu 5).
- Neon backup branch trước khi merge.
- Nâng minor 0.10 → mọi người bị đăng xuất 1 lần (luật phiên spec N); popup mở ngay sau khi đăng nhập lại.

## 7. Kiểm thử
- Unit: so version (`0.10.0 > 0.9.5`, null nhỏ nhất); `RELEASES[0].version === package.json`; mọi `guideId` trong releases và link ở W2 tồn tại trong `guide-content`; mọi `id` mục không trùng.
- Unit component: nút có chấm khi chưa xem / không chấm khi đã xem; tự mở 1 lần, đóng gọi `markSeen` đúng version; hơn 5 mục hiện "và N thay đổi khác"; thẻ Bắt đầu tick đúng theo `steps`, ẩn khi đủ 5 hoặc `dismissed`.
- Integration: `onboarding.status` đếm đúng, bỏ bản ghi xoá mềm, không lẫn user khác; `markSeen` từ chối version lạ, không lùi version; `registerUser` ghi `lastSeenRelease`.
- e2e: tài khoản seed (last_seen null) vào `/dashboard` → ô tự mở → đóng → tải lại không mở; `/guide` và `/updates` mở được khi chưa đăng nhập; tài khoản mới đăng ký thấy thẻ Bắt đầu, không thấy ô tự mở.
- Kiểm tay prod (qa_test): ô tự mở 1 lần, "Tìm hiểu thêm" mở tab mới, `/guide` in ra PDF đọc được.

## 8. Không làm
- Tour chỉ từng nút, ảnh chụp màn hình trong hướng dẫn.
- File PDF riêng duy trì tay; PDF riêng từng bản.
- "Lịch bảo trì", "Quay về bản cũ" (có trong mẫu iOne, không yêu cầu).
- Nội dung hướng dẫn / bản cập nhật bằng tiếng Anh.
- Trang quản trị để sửa nội dung cập nhật (sửa trong code mỗi bản là đủ).
