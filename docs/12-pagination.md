# 12 — Xử lý phân trang (Pagination) (ĐÃ TRIỂN KHAI)

## Mục tiêu
Đảm bảo hiệu năng và trải nghiệm người dùng khi danh sách (học sinh, ca dạy, học phí) trở nên quá dài. Hệ thống cung cấp cơ chế phân trang đồng nhất, dễ tái sử dụng và luôn cố định ở vị trí thuận tiện.

## 1. Cấu trúc thành phần

### Hook `usePagination` (`src/hooks/usePagination.ts`)
Quản lý trạng thái phân trang client-side cho một mảng dữ liệu bất kỳ.

**Input:**
- `data`: Mảng dữ liệu cần phân trang (`T[] | undefined`).
- `initialPageSize`: Số dòng mặc định trên mỗi trang (mặc định là 5).

**Output:**
- `currentPage`: Trang hiện tại.
- `pageSize`: Số dòng trên mỗi trang.
- `paginatedData`: Mảng dữ liệu sau khi đã cắt theo trang.
- `totalItems`: Tổng số bản ghi.
- `totalPages`: Tổng số trang.
- `setCurrentPage`, `setPageSize`: Các hàm cập nhật trạng thái.

**Logic đặc biệt:** Tự động đưa về trang 1 khi độ dài của `data` thay đổi (ví dụ khi người dùng áp dụng bộ lọc).

### Component `DataTablePagination` (`src/components/ui/data-table-pagination.tsx`)
Thành phần giao diện hiển thị các nút điều hướng và bộ chọn kích thước trang.

**Tính năng:**
- Hiển thị dải bản ghi hiện tại (ví dụ: "Hiển thị 1-5 trong 20 bản ghi").
- Dropdown chọn số dòng mỗi trang: 5, 10, 20, 50.
- Nút điều hướng: Đầu trang, Trước, Sau, Cuối trang.
- **Sticky UI:** Luôn ghim ở đáy container (`sticky bottom-0`) để người dùng không phải cuộn chuột tìm kiếm nút chuyển trang.

## 2. Luồng xử lý dữ liệu

1. **Fetch dữ liệu:** Component gọi tRPC query để lấy toàn bộ danh sách (theo bộ lọc hiện tại).
2. **Khởi tạo Hook:** Truyền kết quả fetch vào `usePagination`.
3. **Hiển thị dữ liệu:** Sử dụng `paginatedData` thay vì dữ liệu gốc để `map()` ra các dòng trong bảng.
4. **Tính toán STT:** STT của mỗi dòng được tính theo công thức: `(currentPage - 1) * pageSize + index + 1`.
5. **Render Pagination:** Đặt `DataTablePagination` ở cuối bảng, truyền các hàm callback để cập nhật state.

## 3. Danh sách màn hình áp dụng

| Màn hình | Vị trí bảng | Loại dữ liệu |
|----------|-------------|--------------|
| Quản lý học sinh | `StudentList` | Danh sách HS active |
| Quản lý học phí | `TuitionPage` | Trạng thái đóng tiền tháng |
| Báo cáo chi tiết | `StudentScheduleView` | Lịch sử học của 1 HS |
| Điểm danh | `AttendancePanel` | Danh sách HS trong ca |

## 4. Kế hoạch trong tương lai (Server-side Pagination)
Nếu số lượng bản ghi lên tới hàng nghìn, việc phân trang client-side sẽ làm chậm trình duyệt.

**Plan:**
1. Cập nhật Service/Router để nhận `skip` và `take` từ client.
2. Prisma query sử dụng `skip` và `take`.
3. Trả về object chứa `{ items, totalCount }`.
4. Cập nhật `usePagination` để hoạt động theo chế độ remote (không slice mảng).
