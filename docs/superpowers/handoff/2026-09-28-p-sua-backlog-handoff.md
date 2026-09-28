# Hand-off Report: Plan P — Sửa backlog bản phát hành v0.4.1

- **Execution Engine:** Gehihi (Antigravity)
- **Architect & Reviewer:** Claude Code (Lead Architect & Planner)
- **Branch:** `fix/p-sua-backlog`
- **Plan File:** `docs/superpowers/plans/2026-09-27-p-sua-backlog.md`
- **Ledger:** `.superpowers/sdd/2026-09-27-p-sua-backlog/progress.md`
- **Base Commit:** `3f67340`
- **Head Commit:** `6cc718b`
- **Target Release Version:** `0.4.1`

---

## 1. Kết quả kiểm thử & kiểm tra tự động

| Hạng mục | Kết quả | Chi tiết |
| :--- | :--- | :--- |
| **Unit & Integration Tests** | **PASS 127/127 files (1054/1054 tests)** | Lệnh: `pnpm test` (thời gian: 154s) |
| **Playwright E2E Tests** | **PASS 74 tests, 1 skipped** | Lệnh: `pnpm exec playwright test` (`upgrade-class` skip do DB test đã nâng lớp năm nay) |
| **Type Checking** | **Clean (0 errors)** | Lệnh: `pnpm exec tsc --noEmit` |
| **ESLint** | **Clean (0 warnings/errors)** | Lệnh: `pnpm lint` |
| **Next.js Production Build** | **Success (21/21 routes)** | Lệnh: `next build` nạp biến `.env.test` (`localhost:5433`) |
| **Build Timestamp Grep (P2)** | **Duy nhất 1 chuỗi giờ: `28/09/2026 09:19`** | Kiểm chứng 7 vị trí trong `.next/server` & `.next/static` dùng chung |
| **i18n Key Parity** | **Khớp 100% (`[[], []]`)** | `src/language/vi.json` và `en.json` cùng bộ key |
| **Database Migration** | **Không có migration mới** | Không đụng `prisma/migrations` |

---

## 2. Danh sách Commit (9 commits)

1. `3f67340` - `docs(p): spec + plan sua backlog (no HS nghi, #418, mau Excel, ca huy, len lop, gio VN, don het han, loi nho J/L/M/N, man Tai khoan admin)`
2. `d8465ed` - `fix(p): so ca đã kết thúc theo giờ VN (xoá HS, đổi khối); tự lên lớp cập nhật khối và gỡ HS lớp 12 khỏi ca chưa kết thúc`
3. `1900b5b` - `fix(p): Cần chú ý hiện HS đã nghỉ còn nợ (nhãn Đã nghỉ), tính riêng HS nghỉ không có ca tháng này`
4. `ee4c47c` - `fix(p): chốt giờ build 1 lần cho mọi worker (hết React #418), màu Excel về teal, ca huỷ không bị màu cấp học đè`
5. `4e2ea78` - `fix(p): đơn gói chờ quá 7 ngày tự Hết hạn (không cron), chặn duyệt đơn quá hạn; admin.pendingCount cho sidebar + tab bar mobile`
6. `55776e0` - `fix(p): lỗi nhỏ J/L/M/N (popup mua gói hết Skeleton mãi, nhãn gói role img, phím mũi tên radio, chặn dùng thử cho admin + khóa, giá/dùng thử hiện hành theo id, xung đột cắt theo mẫu, trang đã đổi mật khẩu không vòng redirect, reset không đóng khi đang chạy)`
7. `81d9afc` - `fix(p): màn Tài khoản admin có cột Hành động (menu Đặt gói/Đặt dùng thử/Reset mật khẩu), cột không xuống dòng, phân trang 20/trang`
8. `3794c3c` - `fix(p): màn Lịch nút Xuất Excel chỉ icon (có tên + tooltip, cân hàng nút mobile); màn Học sinh gộp Nhập Excel vào split button Thêm học sinh`
9. `6cc718b` - `chore(p): nâng version 0.4.1 (sửa lỗi, epoch 0.4 giữ nguyên, không ép đăng nhập lại)`

---

## 3. Các quyết định xử lý lệch Plan (Rulings)

1. **Task 2 (Ruling):** Ca cũ trong `tests/unit/services/student-upgrade.test.ts` dùng mốc thời gian năm 2099 nên bị ảnh hưởng bởi logic spec P5 (ca chưa kết thúc phải mang khối mới). Quyết định đổi ngày ca về năm 2020 để kiểm tra đúng nghiệp vụ bảo toàn khối của ca lịch sử đã kết thúc.
2. **Task 7 (Ruling 1):** Trong `tests/unit/components/AdminAccounts.test.tsx`, do 2 user mẫu đều có text `"Standard · Miễn phí"`, `getByText` ném lỗi tìm thấy nhiều phần tử -> dùng `within(table()).getAllByText("Standard · Miễn phí", { selector: "td" })[0].className` theo đúng code thật.
3. **Task 7 (Ruling 2):** Trong các test E2E mobile 390px (`admin-accounts.spec.ts`, `admin-trial.spec.ts`, `admin-reset-password.spec.ts`), Radix UI dropdown menu có CSS animation `zoom-in-95` khi mở, nếu đo ngay `boundingBox()` của menuitem thì chiều cao chỉ ~42px (đang scale 0.95). Cần đợi `menu.evaluate((el) => Promise.all(el.getAnimations().map(a => a.finished)))` tương tự như với Dialog để lấy kích thước thật $\ge 44\text{px}$.

---

## 4. Danh sách kiểm tra tay cho người dùng / Claude sau khi merge + Vercel deploy

1. **Vercel Build Log:** Không có migration mới được áp dụng (`Applying migration...`).
2. **Lỗi #418:** Mở `/students`, `/dashboard`, `/admin/orders` và kiểm tra DevTools Console không còn lỗi "Minified React error #418". Sidebar hiển thị `v0.4.1` cùng giờ build cố định.
3. **Kiểm tra nghiệp vụ giáo viên (`qa_test` id 4):**
   - Khu vực "Cần chú ý" hiển thị học sinh đã nghỉ còn nợ với huy hiệu "Đã nghỉ" màu xám, bấm vào dẫn đúng tới học sinh ở tab Học phí.
   - Nút Xuất Excel trên màn Lịch hiển thị dạng icon-only, tooltip "Xuất Excel", xuất file Excel với tiêu đề màu Teal `#0F766E`.
   - Nút "Thêm học sinh" dạng split-button: bấm mũi tên mở menu có 1 mục "Nhập Excel" (có ổ khóa Pro nếu tài khoản chưa đạt gói).
   - Giao diện mobile 390px: hàng nút màn Lịch chia làm 2 hàng gọn gàng, không tràn mép màn hình.
4. **Kiểm tra khu vực Quản trị (`/admin`):**
   - Màn `/admin/accounts`: Cột "Hành động" với menu `...`, tài khoản giáo viên có đủ 3 mục (Đặt gói, Đặt dùng thử, Reset mật khẩu), tài khoản admin chỉ có Đặt gói. Bảng không bị tràn ngang hay vỡ dòng. Phân trang 20 dòng/trang.
   - Huy hiệu số đơn chờ (`pendingCount`) hiển thị đúng ở sidebar và bottom tab bar.
