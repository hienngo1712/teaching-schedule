# 01 — Tổng quan dự án

## Nghiệp vụ cốt lõi

1. Quản lý danh sách học sinh (tên, lớp, SĐT phụ huynh, **mức học phí/buổi**)
2. Tạo lịch dạy theo tháng → tạo các **ca dạy** (ngày + giờ bắt đầu/kết thúc)
3. **Ghép học sinh** vào từng ca dạy
4. **Điểm danh** học sinh mỗi buổi (có mặt / vắng / muộn)
5. **Bộ lọc**: lọc theo lớp (1–9), theo tên HS → xem lịch riêng 1 học sinh
6. **Xuất lịch** thành ảnh PNG gửi phụ huynh + Excel (4 chế độ)
7. Xem tổng kết: số buổi học/vắng theo tuần/tháng
8. **Quản lý học phí**: tính toán doanh thu, số tiền học dựa trên điểm danh thực tế (Có mặt/Muộn = tính tiền, Vắng = không tính)
9. **Báo cáo tài chính**: xem tổng số tiền học theo từng học sinh, theo lớp hoặc theo tháng.
10. **Quản lý đóng phí**: đánh dấu học sinh đã đóng đủ tiền học hàng tháng, theo dõi công nợ.

---

## Tech Stack

| Layer | Công nghệ | Ghi chú |
|-------|----------|---------|
| Framework | Next.js 14 (App Router) | Fullstack FE + BE trong 1 project |
| Language | TypeScript | Strict mode bắt buộc |
| API | tRPC v11 | Type-safe, không cần REST riêng |
| ORM | Prisma | Schema-first, serverless-safe |
| Database | Neon PostgreSQL | Serverless, free tier |
| Auth | NextAuth.js v5 | Credentials provider, JWT |
| UI | shadcn/ui + Radix UI | Table, Dialog, Form, Badge... |
| CSS | TailwindCSS 4 | Utility-first |
| State | TanStack Query (via tRPC) | Server state |
| Form | React Hook Form + Zod | Type-safe validation |
| Date | Day.js | Xử lý ngày tháng |
| Export PNG | html2canvas | Screenshot DOM |
| Export Excel | ExcelJS + file-saver | Client-side |
| Testing | Vitest + Playwright | Unit + Integration + E2E |
| i18n | Custom Provider | Multi-language (VI/EN) |
| Package | pnpm | |
| Deploy | Vercel | Auto deploy từ GitHub |

---

## Cấu trúc thư mục dự án

```
teaching-schedule/
├── CLAUDE.md                        ← index file
├── docs/                            ← tài liệu (file này)
│   ├── 01-overview.md
│   ├── 02-database.md
│   ├── 03-api.md
│   ├── 04-frontend.md
│   ├── 05-deploy.md
│   ├── 06-testing.md
│   ├── 07-phases.md
│   ├── 08-review.md
│   ├── 09-bulk-session-management.md
│   ├── 10-tuition-payment-tracking.md
│   └── 11-multi-language.md
│
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
│
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── layout.tsx               # Root layout + Providers
│   │   ├── page.tsx                 # Redirect → /dashboard
│   │   ├── globals.css
│   │   ├── login/page.tsx
│   │   ├── calendar/page.tsx        ← TRANG CHÍNH
│   │   ├── students/page.tsx
│   │   ├── reports/page.tsx
│   │   ├── dashboard/page.tsx
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       └── trpc/[trpc]/route.ts
│   │
│   ├── server/                      # Backend (server-only)
│   │   ├── db.ts                    # Prisma singleton
│   │   ├── auth.ts                  # NextAuth config
│   │   ├── trpc/
│   │   │   ├── index.ts             # context, procedures
│   │   │   ├── root.ts              # root router
│   │   │   └── routers/
│   │   │       ├── auth.ts
│   │   │       ├── student.ts
│   │   │       ├── session.ts
│   │   │       ├── attendance.ts
│   │   │       ├── report.ts
│   │   │       └── tuition.ts
│   │   └── services/
│   │       ├── student.service.ts
│   │       ├── session.service.ts
│   │       ├── attendance.service.ts
│   │       ├── report.service.ts
│   │       └── tuition.service.ts
│   │
│   ├── lib/                         # Shared (client + server)
│   │   ├── schemas/
│   │   │   ├── student.ts
│   │   │   ├── session.ts
│   │   │   ├── attendance.ts
│   │   │   ├── report.ts
│   │   │   └── tuition.ts
│   │   ├── trpc.ts                  # tRPC client hooks
│   │   ├── utils.ts                 # cn(), getLevel(), date helpers
│   │   └── constants.ts             # GRADES, ATTENDANCE_STATUS, DAY_NAMES
│   │
│   ├── language/                    # Bản dịch (JSON)
│   │   ├── en.json
│   │   └── vi.json
│   │
│   ├── components/
│   │   ├── providers/
│   │   │   ├── TRPCProvider.tsx
│   │   │   ├── SessionProvider.tsx
│   │   │   ├── LanguageProvider.tsx
│   │   │   └── ThemeProvider.tsx
│   │   ├── ui/                      # shadcn/ui (auto-generated)
│   │   │   ├── ...
│   │   │   └── data-table-pagination.tsx
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx        # Sidebar 240px + main
│   │   │   ├── AppSidebar.tsx       # Nav: Dashboard/Lịch/HS/Báo cáo/Học phí
│   │   │   └── AppHeader.tsx        # Tên GV + Logout + Language Switcher
│   │   ├── calendar/
│   │   │   ├── MonthCalendar.tsx    # Grid 7 cột T2–CN
│   │   │   ├── CalendarDayCell.tsx  # 1 ô ngày
│   │   │   └── SessionCard.tsx      # Card ca dạy
│   │   ├── sessions/
│   │   │   ├── SessionFormDialog.tsx
│   │   │   ├── SessionDetailDialog.tsx
│   │   │   ├── StudentPicker.tsx
│   │   │   ├── AttendancePanel.tsx
│   │   │   └── BulkCreateDialog.tsx
│   │   ├── students/
│   │   │   ├── StudentList.tsx
│   │   │   ├── StudentFormDialog.tsx
│   │   │   └── StudentScheduleView.tsx
│   │   ├── filters/
│   │   │   └── FilterBar.tsx
│   │   ├── tuition/
│   │   │   └── PaymentDialog.tsx
│   │   └── reports/
│   │       ├── StudentReport.tsx
│   │       ├── ExportButton.tsx
│   │       └── ExportExcelButton.tsx
│   │
│   ├── hooks/
│   │   ├── useCalendar.ts
│   │   ├── useFilters.ts
│   │   ├── useExport.ts
│   │   ├── useExcelExport.ts
│   │   └── usePagination.ts
│   │
│   └── middleware.ts                # NextAuth route guard
│
├── tests/
│   ├── setup.ts
│   ├── helpers/
│   │   ├── db.ts
│   │   └── trpc.ts
│   ├── unit/
│   │   ├── schemas/
│   │   ├── utils/
│   │   └── hooks/
│   ├── integration/
│   └── e2e/
│
├── vitest.config.ts
├── playwright.config.ts
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── components.json
└── .gitignore
```

---

## package.json — scripts & dependencies

### Scripts
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "prisma generate && prisma migrate deploy && next build",
    "start": "next start",
    "postinstall": "prisma generate",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "playwright test",
    "test:all": "vitest run && playwright test",
    "db:push": "prisma db push",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio",
    "db:reset": "prisma migrate reset --force"
  }
}
```

### Dependencies chính
```json
{
  "dependencies": {
    "next": "^14.2",
    "react": "^18.3",
    "react-dom": "^18.3",
    "@trpc/server": "^11",
    "@trpc/client": "^11",
    "@trpc/react-query": "^11",
    "@tanstack/react-query": "^5",
    "@prisma/client": "^5.20",
    "next-auth": "5.0.0-beta.25",
    "zod": "^3.23",
    "react-hook-form": "^7.53",
    "@hookform/resolvers": "^3.9",
    "dayjs": "^1.11",
    "bcryptjs": "^2.4",
    "html2canvas": "^1.4",
    "exceljs": "^4.4",
    "file-saver": "^2.0",
    "lucide-react": "^0.460",
    "clsx": "^2.1",
    "tailwind-merge": "^2.5",
    "class-variance-authority": "^0.7"
  },
  "devDependencies": {
    "typescript": "^5.6",
    "prisma": "^5.20",
    "@types/node": "^22",
    "@types/react": "^18",
    "@types/bcryptjs": "^2.4",
    "@types/file-saver": "^2.0",
    "tailwindcss": "^4",
    "tsx": "^4",
    "vitest": "^2.1",
    "@testing-library/react": "^16",
    "@testing-library/jest-dom": "^6",
    "@testing-library/user-event": "^14",
    "@playwright/test": "^1.48",
    "jsdom": "^25"
  }
}
```

---

## Constants quan trọng (`src/lib/constants.ts`)

```typescript
export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export const LEVEL = {
  TIEU_HOC: "tieu_hoc",  // lớp 1–5
  THCS: "thcs",           // lớp 6–9
}

export const ATTENDANCE_STATUS = {
  PENDING: "pending",
  PRESENT: "present",
  ABSENT: "absent",
  LATE: "late",
} as const

export const ATTENDANCE_LABEL = {
  pending: "Chưa điểm danh",
  present: "Có mặt",
  absent: "Vắng",
  late: "Muộn",
}

export const DAY_NAMES = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]

export const SESSION_STATUS = {
  SCHEDULED: "scheduled",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
}

// Color palette
export const COLORS = {
  primary: "#4F46E5",     // indigo-600
  tieuHoc: "#3B82F6",    // blue-500
  thcs: "#10B981",        // emerald-500
  present: "#22C55E",     // green-500
  absent: "#EF4444",      // red-500
  late: "#F59E0B",        // amber-500
  pending: "#9CA3AF",     // gray-400
}
```

## Utility functions (`src/lib/utils.ts`)

```typescript
import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// shadcn/ui helper
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Tính cấp học từ lớp
export function getLevel(grade: number): "tieu_hoc" | "thcs" {
  return grade <= 5 ? "tieu_hoc" : "thcs"
}

// Format date: "02/04/2026"
export function formatDate(date: Date | string): string { ... }

// Format thứ từ Date: "T2", "T3"...
export function formatDayOfWeek(date: Date | string): string { ... }

// Parse "HH:mm" string thành { hours, minutes }
export function parseTime(time: string): { hours: number; minutes: number } { ... }

// So sánh 2 time string "HH:mm"
export function isTimeAfter(time1: string, time2: string): boolean { ... }

// Tính % điểm danh
export function calcAttendanceRate(present: number, total: number): number { ... }

// Remove dấu tiếng Việt (dùng cho tên file export)
export function removeVietnameseTones(str: string): string { ... }
```
