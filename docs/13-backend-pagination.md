# 13 — Backend Pagination Implementation Plan

## Mục tiêu
Chuyển đổi từ phân trang Client-side sang Backend Pagination (Server-side) để tối ưu hóa hiệu năng, giảm dung lượng dữ liệu truyền tải qua mạng và đảm bảo tốc độ phản hồi API < 100ms ngay cả khi dữ liệu lên tới hàng nghìn bản ghi.

## 1. Nguyên tắc chung
- Tất cả các API danh sách (List/Query) phải hỗ trợ tham số `page` (hoặc `skip`) và `limit` (hoặc `take`).
- Response trả về phải có cấu trúc: `{ items: T[], totalCount: number }`.
- Backend chịu trách nhiệm thực hiện `skip` và `take` ở cấp độ Database (Prisma).
- Frontend đồng bộ `currentPage` và `pageSize` với tham số gửi lên API.
- **Default Limit:** Mọi API phân trang phải mặc định trả về **5** bản ghi nếu không có tham số `limit`. Max limit cho phép là **1000** (để hỗ trợ báo cáo).

## 2. Các module áp dụng ngay
### 2.1. Module Học sinh (Student)
- **Schema:** Cập nhật `StudentFilterInput` để bao gồm `page` và `limit`.
- **Service:** Cập nhật `listStudents` sử dụng `db.student.findMany({ skip, take })` và `db.student.count()`.
- **UI:** Chuyển `StudentList` từ việc dùng `usePagination` client-side sang quản lý state page/limit và gọi API.

### 2.2. Module Học phí (Tuition)
- **Schema:** Cập nhật `MonthlyTuitionFilterInput`.
- **Service:** Tối ưu hóa `getMonthlyTuitionStatus`. Hiện tại hàm này đang xử lý `Promise.all` trên toàn bộ danh sách, cần chuyển sang xử lý phân trang ngay từ bước lấy danh sách học sinh ban đầu.
- **UI:** Cập nhật `TuitionPage` để hỗ trợ phân trang server-side.

## 3. Kế hoạch chi tiết

### Bước 1: Cập nhật Schemas (`src/lib/schemas/`)
- Thêm các trường pagination chung (common schema).
- Áp dụng vào `student.ts` và `tuition.ts`.

### Bước 2: Cập nhật Backend Services (`src/server/services/`)
- Thay đổi chữ ký hàm list để nhận thêm `skip` và `take`.
- Thực hiện song song truy vấn dữ liệu và đếm tổng số bản ghi (`Promise.all([findMany, count])`).

### Bước 3: Cập nhật tRPC Routers (`src/server/trpc/routers/`)
- Cập nhật input validation.
- Thay đổi kiểu dữ liệu trả về.

### Bước 4: Cập nhật Frontend UI
- Chỉnh sửa logic fetch dữ liệu trong các component List.
- Đảm bảo `DataTablePagination` nhận đúng `totalPages` và `totalItems` từ backend.
- Reset về trang 1 khi thay đổi bộ lọc (Search/Grade).

## 4. Kiểm thử & Tối ưu hóa
- **Data Seeding:** Viết script tạo 500 học sinh mẫu để test tải.
- **Performance:** Sử dụng Prisma logs hoặc tRPC middleware để đo thời gian phản hồi. Mục tiêu < 100ms.
- **UX:** Đảm bảo không có hiện tượng "nhảy" trang khi dữ liệu đang load (Sử dụng Skeleton).

## 5. Quy định cho tương lai
- Mọi logic lấy danh sách mới bắt buộc phải thiết kế theo hướng phân trang backend ngay từ đầu.
- Tài liệu `docs/03-api.md` sẽ được cập nhật để phản ánh tiêu chuẩn này.
