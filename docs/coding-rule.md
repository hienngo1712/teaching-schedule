# Quy tắc lập trình (Coding Rules)

File này quy định các tiêu chuẩn code cho dự án **Teaching Schedule Manager**. Tất cả thành viên (bao gồm cả AI) phải tuân thủ nghiêm ngặt.

---

## 1. Nguyên tắc cốt lõi
- **Ngôn ngữ:** 
    - Code (Biến, Function, Class, File): **Tiếng Anh**.
    - Comment, Message (UI, Toast, Log): **Tiếng Việt**.
- **Comment ngắn gọn:** tối đa 1–2 dòng, chỉ giải thích *tại sao* khi không hiển nhiên. Không kể lại lịch sử bug, không JSDoc dài cho hàm nội bộ. Code tự nói được thì không cần comment.
- **Tính nhất quán:** Tuân thủ cấu trúc thư mục và kiến trúc hiện tại (tRPC + Prisma + Services).
- **An toàn:** KHÔNG bao giờ commit secrets, file `.env`, hoặc file `.env.test` vào repo.

## 2. Tiêu chuẩn Code (TypeScript)
- **Strict Typing:** Tuyệt đối không dùng `any`. Không sử dụng `any` để ép kiểu (casting) hoặc gán cho các thuộc tính/key của object. Phải dùng types đầy đủ hoặc `z.infer<typeof schema>` cho các kiểu dữ liệu từ Zod.
- **Model & Type Management:**
    - Tuyệt đối không khai báo lại các Interface/Type của Model thủ công ở nhiều nơi.
    - Sử dụng `src/lib/types/models.ts` cho các DTO dùng chung giữa FE và BE.
    - Ưu tiên sử dụng `RouterOutputs` và `RouterInputs` từ `@/lib/trpc` để suy luận (infer) type từ API, đảm bảo tính nhất quán 100% khi API thay đổi.
- **Service Layer:** Logic nghiệp vụ (Business Logic) phải nằm ở thư mục `src/server/services/`. Router tRPC chỉ gọi service.
- **Error Handling:** Sử dụng `TRPCError` với các mã lỗi phù hợp (`NOT_FOUND`, `BAD_REQUEST`, `UNAUTHORIZED`).

## 3. Database (Prisma)
- **Tránh N+1:** Luôn sử dụng `include` hoặc `select` để lấy dữ liệu liên quan trong một câu query duy nhất.
- **Naming:** Table name dùng PascalCase, Field name dùng camelCase (theo schema.prisma hiện tại).
- **Migrations:** Luôn chạy `pnpm build` hoặc `prisma migrate dev` để kiểm tra schema trước khi commit. Khi thay đổi schema (thêm field, đổi kiểu), PHẢI apply migration cho cả môi trường Production và Test (ví dụ: `.env` và `.env.local`) để đảm bảo code và DB luôn đồng bộ.

## 4. Frontend (Next.js & shadcn/ui)
- **"use client":** Chỉ đặt ở đầu file khi component sử dụng Hook (useState, useEffect) hoặc Browser API.
- **Components:** Chia nhỏ components vào `src/components/ui/` (nguyên tử) và `src/components/[feature]/` (nghiệp vụ).
- **Responsive:** **Ưu tiên Mobile-first Tuyệt đối.** Phải thiết kế và tối ưu hoàn chỉnh cho Mobile (screens >= 375px) TRƯỚC khi mở rộng ra bản Web. Một tính năng chưa được tối ưu cho Mobile được coi là chưa hoàn thành. Sử dụng các class `sm:`, `md:`, `lg:` của Tailwind để mở rộng dần layout.
- **Định dạng dữ liệu:** 
    - Tiền tệ: Luôn dùng `formatCurrency(value)` từ `src/lib/utils.ts`.
    - Ngày tháng: Luôn dùng `formatDate(date)` từ `src/lib/utils.ts`.
- **UI Consistency:** 
    - Các cột số (tiền tệ, số lượng) trong Table phải căn phải (`text-right`).
    - Không tự ý thay đổi font-family (như `font-mono`) cho dữ liệu hiển thị thông thường trừ khi có yêu cầu đặc biệt.
- **UX:** Luôn có trạng thái Loading (Skeleton) và Thông báo (Toast) sau mỗi hành động (Thêm/Sửa/Xóa).
- **Phân trang (Pagination):**
    - Tất cả các danh sách (Table/List) bắt buộc phải có phân trang.
    - **Default Page Size:** Phải là **5** item/trang để tối ưu tốc độ load trên mobile.
    - Phải sử dụng `DataTablePagination` ghim ở đáy (`sticky bottom-0`).
    - Các API lấy danh sách phải hỗ trợ phân trang ở Backend (Server-side) thông qua `paginationSchema`.

## 5. Quy trình làm việc & Commit
- **Kiểm tra trước khi commit:**
    1. `pnpm build` (Kiểm tra lỗi TypeScript & Build).
    2. `pnpm lint` (Kiểm tra format).
    3. `pnpm test` (Đảm bảo không phá vỡ logic cũ).
- **Commit Message:** Tuân thủ [Conventional Commits](https://www.conventionalcommits.org/):
    - `feat:` (Tính năng mới)
    - `fix:` (Sửa lỗi)
    - `refactor:` (Tái cấu trúc)
    - `docs:` (Tài liệu)
    - `test:` (Viết test)

---

## 6. Lưu ý về Testing & Deployment (QUAN TRỌNG)
- **Database Testing:** Phải sử dụng database branch riêng (ví dụ trên Neon).
- **Cấm chạy Test trên Production:** File `tests/setup.ts` sẽ tự động xóa sạch dữ liệu. Nếu thấy DATABASE_URL chứa `neon.tech` mà không có `.env.test` tương ứng cho test branch, hệ thống sẽ chặn.
- **Vercel Build:** Nếu gặp lỗi 403, kiểm tra lại IP Allowlist trên Neon hoặc quyền truy cập của DATABASE_URL.

---

## 6.1. RULE BẤT KHẢ XÂM PHẠM — Bảo vệ Production Data

**Sự cố tham chiếu (2026-05-23):** Production DB bị wipe vì `tests/setup.ts` chạy `deleteMany()` trên endpoint production do ES module import hoisting (db.ts được import TRƯỚC khi `dotenv.config({ path: ".env.test" })` chạy). Sau đó phải restore từ Neon PITR.

### A. Push/Merge code KHÔNG được xóa dữ liệu production
1. **Migration policy:**
   - Chỉ dùng `prisma migrate deploy` cho production (additive, idempotent). Build script Vercel hiện tại đã dùng đúng (`prisma generate && prisma migrate deploy && next build`).
   - **TUYỆT ĐỐI CẤM** chạy `prisma migrate reset`, `prisma db push --force-reset`, hoặc bất kỳ lệnh nào có flag `--force`/`--reset` lên `.env` (production).
2. **Schema thay đổi destructive (drop column, drop table, rename):**
   - Phải qua quy trình 2 bước: deploy code đọc cả old + new field → backfill data → deploy migration drop. KHÔNG được drop trực tiếp.
3. **Build/deploy pipeline KHÔNG được trigger test scripts.**
   - `pnpm test`, `pnpm test:e2e`, hoặc bất kỳ command nào load `tests/setup.ts` KHÔNG được nằm trong Vercel build pipeline.
   - Verify trong `vercel.json` (nếu có) và `package.json#scripts.build` — chỉ chứa `prisma generate`, `prisma migrate deploy`, `next build`.

### B. Test setup KHÔNG được đè lên data production
1. **Tách env loading khỏi db import:**
   - File `tests/env-setup.ts` (side-effect module) PHẢI là `setupFiles[0]` trong `vitest.config.ts`. Nó load `.env.test` và assert endpoint TRƯỚC khi module khác chạy.
   - File `tests/setup.ts` (chứa `beforeAll` + db reset) chạy SAU. Phải re-assert endpoint runtime ngay trước `deleteMany()` — defense-in-depth.
   - **Không bao giờ** đặt `import { db } from "@/server/db"` vào cùng file với `dotenv.config({ path: ".env.test" })` — ES module hoisting sẽ load db.ts trước.
2. **Endpoint guards (cả 3 phải pass mới chạy deleteMany):**
   - `.env.test` PHẢI tồn tại.
   - Endpoint của `.env.test` PHẢI khác endpoint của `.env` (so sánh hostname).
   - Tại runtime, `process.env.DATABASE_URL` sau khi load `.env.test` PHẢI bằng `.env.test` DATABASE_URL VÀ khác `.env` endpoint.
3. **Trước mọi destructive script** (`db:reset`, `db:seed`, `db:push`, các script `scripts/*.ts` xóa/sửa data):
   - Phải có safety check: refuse to run nếu endpoint trùng production endpoint trong `.env`, hoặc nếu thiếu env biến explicit confirm (vd `CONFIRM_DESTRUCTIVE=YES`).

### C. Local dev và manual test KHÔNG được wipe production
1. **`pnpm dev`** load `.env.local` (nếu có) + `.env`. Đây là môi trường developer thường dùng. Mọi nút bấm trong UI (vd "Nâng lớp hàng loạt", "Xóa học sinh") chạy MUTATION thật lên DB được set trong `.env`.
   - Nếu bạn không muốn touch production: tạo `.env.local` trỏ DATABASE_URL vào test branch và override `.env`.
2. **Manual test E2E** (Playwright với `headless: false`) tương tự — chạy lên DB của `.env`. Để an toàn, dùng `.env.local` trỏ tới test branch.

### D. Quy tắc sống còn cho AI agent / developer mới
1. **Trước khi chạy bất kỳ lệnh nào tương tác DB**, xác định rõ env file đang được load: `cat .env | grep DATABASE_URL` so sánh với `cat .env.test | grep DATABASE_URL`. Nếu giống nhau → STOP, báo user.
2. **Trước khi merge feature branch lên main**, verify migration mới là additive: `git diff main..feature -- prisma/migrations/` không chứa `DROP TABLE`, `DROP COLUMN`, `ALTER ... DROP NOT NULL` mà không có backfill.
3. **Sau mọi merge lên main**, monitor Vercel deploy log. Nếu thấy log dạng `Resetting database`, `Applied migration ... rolled_back`, hoặc bất kỳ message destructive → rollback ngay.
4. **Backup trước operation rủi ro:** trước khi apply migration phức tạp, Neon có "Branch from current" — tạo backup branch trước, sau đó migrate. Nếu lỗi, swap connection string.

---

## 7. Quy tắc về Text & Đặt tên (I18n & Naming)
- **Internationalization (i18n):**
    - Luôn tìm kiếm các key hiện có trong `src/language/*.json` trước khi tạo mới để dùng chung (reusable).
    - Chỉ tạo key mới khi thực sự cần thiết để tránh trùng lặp dữ liệu và tối ưu dung lượng file.
- **Naming Convention:**
    - Đặt tên ngắn gọn, tối giản, bỏ các hậu tố (suffixes) thừa thãi.
    - Không dùng các dạng như `student_btn`, `student_label`, `student_title` nếu bản thân từ đó đã đủ nghĩa trong ngữ cảnh.
    - Ưu tiên các key đơn lẻ như `save`, `edit`, `delete`, `title`, `name`, `status`.
