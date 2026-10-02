# X — O3 dọn dẹp mã hoá + chính sách bảo mật nổi bật + xác nhận mật khẩu khi đăng ký

> Ngày: 2026-10-02 · Người yêu cầu: chủ ứng dụng · Phiên bản: **0.9.5** (patch, **không migration**).
> Gộp: O3 (Task 11 plan O `docs/superpowers/plans/2026-09-27-o-bao-mat-du-lieu-ca-nhan.md`) + 2 yêu cầu mới.
> Người dùng duyệt hướng ngày 2026-10-02 ("1 ok, 2 ok …"). Chỉ viết spec/plan; giao Gehihi khi người dùng bảo.

## 1. Mục tiêu

1. **O3**: sau O2 (2026-10-02, 243 giá trị đã mã hoá, verify khớp) mọi trường mã hoá phải là ciphertext. Có bản rõ mới lọt vào (đường ghi vòng qua extension) thì log cảnh báo để biết; tài liệu vận hành khoá đầy đủ.
2. **Chính sách bảo mật dễ đọc hơn**: người đăng ký thấy ngay 4 ý chính trước khi tick đồng ý, mở bản đầy đủ không mất form.
3. **Xác nhận mật khẩu** ở trang Đăng ký: gõ 2 lần, khác nhau thì không cho gửi.

## 2. O3 — cảnh báo bản rõ còn sót + tài liệu khoá

- Giữ nguyên Task 11 plan O, chỉ đổi:
  - Version **0.9.5** (không phải 0.8.1).
  - `decryptResult` hiện viết gọn 1 dòng (`src/server/crypto/prisma-encryption.ts:92-94`), khác đoạn plan O trích → tách nhánh như plan O: trường mã hoá + chuỗi không rỗng + chưa mã hoá → `warnPlaintext(key)` rồi trả nguyên.
- Cảnh báo `console.warn("[crypto] còn bản rõ ở trường <tên trường>")`, **1 lần mỗi tên trường mỗi tiến trình**, **không bao giờ in giá trị**. Chuỗi rỗng / null không cảnh báo.
- `resetPlaintextWarnings()` export chỉ để test.
- `docs/05-deploy.md` thêm mục "Khoá mã hoá dữ liệu cá nhân": 2 biến env (Production, Sensitive), lệnh sinh khoá dạng `k1:<base64 32 byte>`, lưu dự phòng 2 nơi (mất khoá = mất dữ liệu), quy trình xoay khoá (`--rotate`), các chế độ `scripts/crypto-backfill.ts` + `CONFIRM_HOST` + mã thoát, nhắc xoá Neon branch chứa bản rõ. **Không chép khoá hay URL thật.**
- Sau merge: người dùng xoá Neon branch `backup-truoc-o1-ma-hoa` (bản sao cuối còn bản rõ; branch O2 tự xoá 9/10), cân nhắc xoay khoá vì 1 phần khoá từng lộ trong ảnh chụp.

## 3. Chính sách bảo mật nổi bật

### 3.1 Trang Đăng ký — khung tóm tắt ngay trên ô đồng ý
- Khung viền `primary` nhạt (teal), icon khiên, tiêu đề "Trước khi đăng ký, bạn nên biết". 4 dòng, mỗi dòng 1 icon + câu ngắn, chữ đậm phần chính:
  1. **Lưu gì:** tài khoản của bạn và dữ liệu học sinh, lịch dạy, học phí do bạn nhập.
  2. **Bảo vệ thế nào:** họ tên, số điện thoại, số tài khoản được **mã hoá**; mật khẩu không ai đọc được.
  3. **Ai xem được:** chỉ bạn. Quản trị viên chỉ thấy thông tin gói. Không bán, không quảng cáo.
  4. **Xoá dữ liệu:** dữ liệu xoá vào thùng rác; xoá hẳn hoặc xoá tài khoản thì liên hệ `{contact}` (`PRIVACY_CONTACT`).
- Dưới 4 dòng: link **"Đọc đầy đủ chính sách ↗"** → `/privacy`, `target="_blank" rel="noopener noreferrer"`, cao ≥ 44px trên mobile.
- **Đổi quyết định H2 (plan O)**: trước đây ô đồng ý không có link để người dùng không rời form. Mở tab mới thì form giữ nguyên → người dùng đồng ý đổi (2026-10-02). Ghi chú trong `ConsentCheckbox.tsx` cập nhật theo.
- Link chữ nhỏ "Chính sách bảo mật" ở chân trang Đăng ký: bỏ (đã có link rõ hơn ở khung). Trang Đăng nhập giữ nguyên link.
- Các ô đồng ý khác (TK ngân hàng, form HS, nhập Excel) **không đổi**.

### 3.2 Trang `/privacy`
- Đầu trang thêm cùng khung tóm tắt 4 ý (dùng chung component), dưới đó là 5 mục đầy đủ như hiện tại.
- **Không đổi lời văn 5 mục** → không nâng `CONSENT_TEXT_VERSION` → người dùng cũ không phải tick lại. Khung tóm tắt chỉ diễn giải lại nội dung đã có (spec O), không thêm cam kết mới.

### 3.3 Component
- `src/components/privacy/PrivacySummary.tsx` (mới): khung 4 ý, prop `showFullLink?: boolean` (Đăng ký = true, `/privacy` = false).
- i18n vi + en: `privacy_summary_title`, `privacy_summary_store`, `privacy_summary_protect`, `privacy_summary_who`, `privacy_summary_delete`, `privacy_read_full`. Phần đậm tách key riêng (`…_lead`) để không nhúng HTML vào chuỗi.

## 4. Xác nhận mật khẩu khi đăng ký

- Form thêm ô **"Nhập lại mật khẩu"** (`PasswordInput`) ngay dưới ô Mật khẩu.
- Schema riêng cho form: `registerFormSchema = registerSchema.extend({ confirmPassword: z.string() }).refine(v => v.password === v.confirmPassword, { path: ["confirmPassword"], message: <i18n "register_password_mismatch"> })`.
- **Chỉ kiểm ở client.** Khi gửi: bỏ `confirmPassword`, gửi `{ username, password, fullName, consent }` như cũ. `registerSchema`/`registerInputSchema` server không đổi.
- Lỗi hiện dưới ô xác nhận, sau khi người dùng rời ô hoặc bấm Đăng ký (mặc định react-hook-form `onSubmit`, rồi kiểm lại khi gõ).
- Gõ lại ô Mật khẩu sau khi đã báo khớp → kiểm lại ô xác nhận (`trigger("confirmPassword")` khi `password` đổi và ô xác nhận đã có giá trị).
- Trang Đổi mật khẩu đã có ô xác nhận (`ChangePasswordForm.tsx`) → không đụng.
- i18n: `register_confirm_password` ("Nhập lại mật khẩu"), `register_password_mismatch` ("Mật khẩu nhập lại không khớp").

## 5. Kiểm thử
- Unit `prisma-encryption.test.ts`: cảnh báo 1 lần/trường, không chứa giá trị, rỗng/null không cảnh báo; bản mã hoá không cảnh báo.
- Unit `RegisterForm`: 2 mật khẩu khác → hiện lỗi, **không gọi** mutation; khớp + tick → mutation nhận payload **không có** `confirmPassword`; khung tóm tắt hiện, link có `target="_blank"`.
- Unit `PrivacyContent`: có khung tóm tắt, không có link "Đọc đầy đủ".
- e2e đang điền form Đăng ký (`consent-privacy.spec.ts`, `admin-new-accounts.spec.ts`): điền thêm ô xác nhận; `consent-privacy` kiểm khung tóm tắt + link mở tab mới.
- Toàn bộ `pnpm test`, `tsc`, `lint`, e2e 2 nửa.
- Kiểm tay prod: mở `/register` (không đăng ký tài khoản), xem khung + link tab mới; Vercel log không có `[crypto] còn bản rõ`.

## 6. Không làm
- Không bắt cuộn hết / chờ giây mới cho tick (người dùng đồng ý bỏ).
- Không đổi lời văn chính sách, không nâng version đồng ý.
- Không migration, không đổi API đăng ký.
