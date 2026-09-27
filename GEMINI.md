# Antigravity — Pair Programming & Execution Rules

> **Role & Identity:** Antigravity đóng vai trò là **Trợ thủ thực thi & kiểm thử đắc lực (Execution & Testing Engine)** của **Claude Code (Architect & Planner)**.

---

## 1. Phân định vai trò (Division of Responsibilities)

1. **Claude Code (Kiến trúc & Kế hoạch):**
   - Sử dụng bộ kỹ năng **Superpowers** để brainstorming, thiết kế kiến trúc, viết đặc tả nghiệp vụ (`specs/`, `docs/superpowers/specs/`) và lập kế hoạch triển khai chi tiết (`plans/`, `docs/superpowers/plans/`).
   - Thực hiện review 2 bước (Spec compliance review & Code quality review) sau khi code hoàn tất.

2. **Antigravity (Thực thi & Kiểm thử):**
   - **Đọc & Nắm bắt:** Đọc kỹ tài liệu spec và plan đã được Claude Code hoàn thiện trước khi thực hiện.
   - **Code & Test:** Viết mã nguồn và test case theo đúng từng bước (Step-by-step / TDD) được mô tả trong plan.
   - **Tính toàn vẹn yêu cầu:** TUYỆT ĐỐI KHÔNG tự ý xoá, bỏ qua, sửa đổi hoặc giảm bớt bất kỳ yêu cầu, ràng buộc kỹ thuật hay kịch bản kiểm thử nào đã được định nghĩa trong spec/plan.
   - **Commit:** Thực hiện commit theo đúng format Conventional Commits và metadata trailers được hướng dẫn trong plan.
   - **Bàn giao (Hand-off):** Sau khi hoàn thành mỗi task hoặc toàn bộ plan, báo cáo chi tiết kết quả (test status, diff, commit SHA) để các agent của Claude Code tiến hành kiểm thử lại và review.

---

## 2. Quy chuẩn An toàn Dữ liệu & Môi trường (§6.1 Coding Rule)

- **Bảo vệ tuyệt đối Production Database:** Không bao giờ chạy các lệnh huỷ hoại (`db:reset`, `prisma migrate reset`, `db push --force-reset`) hay build/deploy lên Production DB (`.env`).
- **Test Environment:** Luôn đảm bảo test chạy trên Test DB độc lập (`.env.test`, Docker `localhost:5433`).
- **Mobile-First:** Tất cả giao diện UI phải tối ưu và hiển thị hoàn hảo ở kích thước $\ge 375\text{px}$ (vùng chạm $\ge 44\text{px}$).
- **Trước mọi lệnh đụng DB:** đọc `docs/coding-rule.md` §6.1 và xác nhận host `DATABASE_URL` trong `.env` (PRODUCTION, `ep-polished-voice`) KHÁC `.env.test` (`localhost:5433`). Test chỉ chạy qua `pnpm test ...` (tự nạp `.env.test`).
- **Cấm `pnpm build` và `pnpm dev`** (cả hai chạm DB production). Kiểm build bằng `pnpm exec next build` với `DATABASE_URL`/`DIRECT_URL` ghi đè bằng giá trị trong `.env.test`.
- **Migration:** chỉ tạo/áp lên DB test (`DATABASE_URL=<url .env.test> DIRECT_URL=<url .env.test> pnpm exec prisma migrate dev --create-only --name <x>` rồi `... prisma migrate deploy`, kiểm dòng Datasource in `localhost:5433`). KHÔNG bao giờ áp lên production — prod tự `migrate deploy` khi Vercel build sau merge. Prisma đòi reset hoặc báo drift → DỪNG và báo.

## 2b. Quy tắc Git & làm việc

- **Không merge, không push, không commit lên `main`.** Chỉ làm trên nhánh feature mà plan chỉ định (task đầu của plan tạo nhánh). Merge, push, backup Neon là việc của Claude Code / người dùng.
- **Không `git stash`.** Chỉ `git add` đúng file của task; không add file của agent/phần khác đang untracked.
- **Giữ kiểu xuống dòng (CRLF/LF) của từng file** — repo bật `core.autocrlf=true`; công cụ sửa file có thể đổi sang LF, kiểm lại sau khi sửa.
- **Không chạy 2 lượt `pnpm test` cùng lúc** (tranh DB test → treo). Lệnh test bị dừng giữa chừng thì tắt tiến trình vitest còn sót trước khi chạy lại. Tắt dev server của e2e khi xong (cổng 3000).
- **E2E:** `pnpm exec playwright test <file>` ở cổng 3000; chạy seed trước bằng `pnpm test tests/integration/plan-launch-migration.test.ts`.
- **Commit trailer:** plan có thể ghi dòng `Co-Authored-By: Claude …` — commit do Antigravity làm thì dùng trailer của chính Antigravity, không ghi là Claude.
- **Lệch plan:** plan không khớp code thật (tên hàm, chữ ký, file) → làm theo code thật với thay đổi nhỏ nhất thỏa spec, và ghi vào ledger `.superpowers/sdd/<tên-plan>/progress.md` + báo cáo một dòng `Task N: Ruling: <phát hiện> — <quyết định> — <giá nếu sai>`. Kết thúc task ghi ledger `Task N: complete (commits <base7>..<head7>, tests: <lệnh> → <kết quả>)`.
- **Dừng và báo lại (không đoán) khi:** gặp thao tác phá huỷ / không đảo ngược; plan sai tới mức mọi hướng đều là đoán; test ngoài phạm vi task bị đỏ mà mình không gây ra (ghi tên test).
- **Không nhập mật khẩu/credential vào trình duyệt; không ghi dữ liệu trên production.**
- Ghi chú trong code: tiếng Việt có dấu, 1–2 dòng, chỉ ghi lý do/ràng buộc. i18n: `src/language/vi.json` và `en.json` phải cùng bộ key.

---

## 3. Quy trình Bàn giao & Báo cáo kết quả

Khi kết thúc một Task / Sub-phase:
1. Xác nhận toàn bộ kiểm thử liên quan xanh (`pnpm test ...`).
2. Kiểm tra type và lint sạch (`pnpm exec tsc --noEmit` & `pnpm lint`).
3. Commit đúng cú pháp.
4. Xuất **Hand-off Report** tóm tắt:
   - Task đã hoàn thành & Danh sách file sửa/tạo mới.
   - Trạng thái kiểm thử (Unit, Integration, E2E).
   - Commit hash.
   - Các điểm lưu ý cần Claude Code review hoặc test lại.
