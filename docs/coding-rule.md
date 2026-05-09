# Quy tắc lập trình (Coding Rules)

File này quy định các tiêu chuẩn code cho dự án **Teaching Schedule Manager**. Tất cả thành viên (bao gồm cả AI) phải tuân thủ nghiêm ngặt.

---

## 1. Nguyên tắc cốt lõi
- **Ngôn ngữ:** 
    - Code (Biến, Function, Class, File): **Tiếng Anh**.
    - Comment, Message (UI, Toast, Log): **Tiếng Việt**.
- **Tính nhất quán:** Tuân thủ cấu trúc thư mục và kiến trúc hiện tại (tRPC + Prisma + Services).
- **An toàn:** KHÔNG bao giờ commit secrets, file `.env`, hoặc file `.env.test` vào repo.

## 2. Tiêu chuẩn Code (TypeScript)
- **Strict Typing:** Tuyệt đối không dùng `any`. Sử dụng `z.infer<typeof schema>` cho các kiểu dữ liệu từ Zod.
- **Service Layer:** Logic nghiệp vụ (Business Logic) phải nằm ở thư mục `src/server/services/`. Router tRPC chỉ gọi service.
- **Error Handling:** Sử dụng `TRPCError` với các mã lỗi phù hợp (`NOT_FOUND`, `BAD_REQUEST`, `UNAUTHORIZED`).

## 3. Database (Prisma)
- **Tránh N+1:** Luôn sử dụng `include` hoặc `select` để lấy dữ liệu liên quan trong một câu query duy nhất.
- **Naming:** Table name dùng PascalCase, Field name dùng camelCase (theo schema.prisma hiện tại).
- **Migrations:** Luôn chạy `pnpm build` hoặc `prisma migrate dev` để kiểm tra schema trước khi commit.

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

## 7. Quy tắc về Text & Đặt tên (I18n & Naming)
- **Internationalization (i18n):**
    - Luôn tìm kiếm các key hiện có trong `src/language/*.json` trước khi tạo mới để dùng chung (reusable).
    - Chỉ tạo key mới khi thực sự cần thiết để tránh trùng lặp dữ liệu và tối ưu dung lượng file.
- **Naming Convention:**
    - Đặt tên ngắn gọn, tối giản, bỏ các hậu tố (suffixes) thừa thãi.
    - Không dùng các dạng như `student_btn`, `student_label`, `student_title` nếu bản thân từ đó đã đủ nghĩa trong ngữ cảnh.
    - Ưu tiên các key đơn lẻ như `save`, `edit`, `delete`, `title`, `name`, `status`.
