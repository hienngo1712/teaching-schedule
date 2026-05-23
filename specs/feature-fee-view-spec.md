# KẾ HOẠCH TRIỂN KHAI VIEW QUẢN LÝ HỌC PHÍ HỌC SINH

**Vai trò:** BA & Technical Lead  
**Tech Stack:** T3 Stack (Next.js, tRPC, TailwindCSS), PostgreSQL (Neon DB), Prisma/Drizzle ORM.  
**Mục tiêu:** Tối ưu UI/UX cho view danh sách học phí, chống nghẽn API (Timeout/N+1 Query) bằng Master-Detail Pattern.

---

## 1. PHÂN TÍCH VẤN ĐỀ & CHIẾN LƯỢC TIẾP CẬN

*   **Vấn đề:** Logic tính tiền học phí có tính kế thừa (carryover) từ tháng trước (thừa/thiếu) sang tháng này. Nếu load toàn bộ logic này ở màn danh sách sẽ dẫn đến việc DB phải query toàn bộ lịch sử đóng tiền của hàng loạt học sinh -> Gây chậm, timeout API. View quá nhiều số liệu sẽ làm UI rối mắt.
*   **Chiến lược UI/UX:** Áp dụng **Master-Detail Pattern**.
    *   **Master View (Table):** Chỉ hiển thị con số cuối cùng (Final Number) cần quan tâm và trạng thái thanh toán.
    *   **Detail View (Drawer / Modal / Sub-page):** Hiển thị luồng diễn giải dòng tiền (Cashflow breakdown).
*   **Chiến lược Database:** Áp dụng **Snapshot Pattern** (chốt sổ hàng tháng). Không query tính toán lịch sử từ đầu, mà mỗi tháng tạo ra 1 bản ghi tổng hợp chứa "số dư đầu kỳ".

---

## 2. THIẾT KẾ UI/UX CỤ THỂ

### 2.1. Master View (Bảng danh sách tổng - Table)
Mục đích: Giúp kế toán / quản lý nhìn lướt nhanh xem ai đã đóng, ai chưa, tổng tiền cần thu là bao nhiêu. Bắt buộc có Pagination (Phân trang) và Filter (Bộ lọc theo tháng/lớp/trạng thái).

**Các cột (Columns) hiển thị:**
1.  **STT**
2.  **Họ tên học sinh**
3.  **Lớp học**
4.  **Số buổi học:** `[Đã học] / [Tổng số buổi trong tháng]` (VD: 8/12)
5.  **Cần thanh toán:** Mức phí cuối cùng phải đóng của tháng này (Đã tự động cộng trừ mọi khoản nợ/dư từ tháng trước). 
6.  **Trạng thái:** Tag màu (VD: <span style="color:green">Đã đóng đủ</span>, <span style="color:red">Chưa đóng</span>, <span style="color:orange">Đóng thiếu</span>).
7.  **Hành động (Action):** Nút "Xem chi tiết" hoặc icon (Mắt / Dấu ba chấm).

### 2.2. Detail View (Chi tiết học phí - Drawer hoặc Modal)
Mục đích: Giải thích vì sao lại ra con số ở cột (5) và ghi nhận thanh toán. Dùng component Drawer (trượt từ phải sang) là hợp lý nhất để không làm mất context của bảng.

**Bố cục Drawer:**
*   **Phần 1: Thông tin chung:** Tên học sinh, Lớp, Tháng áp dụng.
*   **Phần 2: Diễn giải học phí (Breakdown):**
    *   [A] Dư nợ / Trả trước từ tháng trước chuyển sang: `+ 500,000 VND` (nợ) hoặc `- 200,000 VND` (thừa).
    *   [B] Tiền học gốc tháng hiện tại (Số buổi x Đơn giá): `2,000,000 VND`.
    *   [C] Tổng tiền cần đóng tháng này `(A + B)`: `2,500,000 VND`.
*   **Phần 3: Ghi nhận thanh toán:**
    *   [D] Số tiền khách thực đóng (Input field): `2,000,000 VND`.
    *   [E] Tình trạng dư nợ chuyển tháng sau `(C - D)`: `Nợ 500,000 VND`.
*   **Phần 4: Lịch sử đóng tiền:** Bảng mini log lại các lần quét mã/chuyển khoản trong tháng.

---

## 3. TỐI ƯU DATABASE & API (TRPC & NEON DB)

Để giải quyết triệt để bài toán Timeout, chúng ta không dùng query tính toán động (dynamic aggregation) cho View Table.

### 3.1. Database Schema Design (Lõi logic)
Tạo một bảng `StudentMonthlyFee` (Snapshot từng tháng của mỗi học sinh).

```prisma
model StudentMonthlyFee {
  id                String   @id @default(cuid())
  studentId         String
  monthId           String   // VD: "2023-10"
  
  // Thông tin học
  totalSessions     Int      // Tổng số buổi
  attendedSessions  Int      // Số buổi đã đi học
  
  // Logic tiền tệ (Snapshot)
  previousBalance   Decimal  // Dư nợ tháng trước (Âm = trả thừa, Dương = nợ)
  currentMonthFee   Decimal  // Tiền học gốc sinh ra trong tháng này
  totalAmountDue    Decimal  // Tổng cần thu = previousBalance + currentMonthFee
  totalPaid         Decimal  // Tổng tiền đã thanh toán trong tháng này
  
  status            String   // UNPAID, PARTIAL, PAID
  
  @@unique([studentId, monthId])
  @@index([monthId]) // Đánh index để query theo tháng cực nhanh
}