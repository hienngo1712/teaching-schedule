# Sửa / Hủy ghi nhận thanh toán học phí — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giáo viên lỡ xác nhận đóng nhầm số tiền hoặc nhầm tháng có thể sửa hoặc hủy ghi nhận ngay trên màn Học phí, và trạng thái (badge) không bao giờ hiển thị sai sau khi sửa.

**Architecture:** KHÔNG đổi schema DB. Vẫn dùng `tuition.updatePayment` (ghi đè `MonthlyTuition`); "Hủy thanh toán" = gọi đúng mutation đó với `paidAmount = 0, isFullPaid = false`. Bổ sung: (1) helper thuần `buildPaymentAuditNote` ghi vết mọi lần sửa/hủy vào `notes`, gọi ở service để timestamp không phụ thuộc client; (2) tách badge "Đã tất toán (miễn giảm)" khỏi "Đã đóng đủ" để danh sách không nói dối; (3) `TuitionDetailSheet` có chế độ sửa rõ ràng, nút hủy có xác nhận, cảnh báo khi tất toán mà còn thiếu tiền, toast nêu rõ tháng + Hoàn tác.

**Tech Stack:** Next.js App Router, tRPC, Prisma, react-hook-form + zod, shadcn/ui (AlertDialog), sonner, vitest (unit + integration).

---

## Bối cảnh: 3 lỗi gốc đã xác định

| # | Lỗi | Vị trí | Hệ quả |
|---|-----|--------|--------|
| 1 | `quickPayAdjusted()` bật `isFullPaid = true`; sửa số tiền xuống (kể cả về 0) **không** tắt nó. Badge đọc `isFullPaid` trước tiên. | `TuitionDetailSheet.tsx:100-104`, `page.tsx:51` | Badge xanh "Đã đóng đủ" dù đã sửa về 0. Backend `Math.min(0, residual)` (`tuition.service.ts:46`) **nuốt luôn nợ** sang tháng sau. |
| 2 | Auto-note trả dư dùng `!currentNotes.includes(prefix)` → chèn 1 lần, không bao giờ gỡ/cập nhật. | `TuitionDetailSheet.tsx:77-93` | Ghi chú nói "Đóng thừa 500.000 đ" dù đã sửa lại đúng. Helper đã fix `mergeOverpaidNote` (`src/lib/payment-notes.ts`) chỉ được dùng ở `PaymentDialog.tsx` — **file chết, không ai import** (không xóa trong plan này; báo để quyết định riêng). |
| 3 | Không có affordance Sửa/Hủy; nút chỉ ghi "Xác nhận đóng tiền". Toast không nêu tháng. | `TuitionDetailSheet.tsx:247-253` | GV không biết có thể sửa; nhầm tháng không phát hiện được. |

**Quyết định thiết kế (đã chốt với chủ dự án):**
- "Hủy" = reset `paidAmount = 0, isFullPaid = false`, **giữ** dòng `MonthlyTuition` (giữ `previousBalance`/`currentMonthFee` để carry-over tháng sau tự đúng lại).
- **Không** tự động bỏ tick `isFullPaid` khi giảm tiền — đó là tính năng miễn/giảm có chủ đích (xem comment `tuition.service.ts:41-42`). Thay vào đó **hiện rõ** trạng thái đó bằng badge riêng + cảnh báo trong form.
- Audit: ghi 1 dòng vào `notes`, không thêm bảng mới.

## File Structure

| File | Trách nhiệm | Thao tác |
|---|---|---|
| `src/lib/payment-notes.ts` | Helper thuần cho ghi chú thanh toán. Thêm `formatVnDate` + `buildPaymentAuditNote`. | Modify |
| `tests/unit/lib/payment-notes.test.ts` | Unit test helper. | Modify |
| `src/server/services/tuition.service.ts` | `updateTuitionPayment` đọc snapshot cũ, ghép dòng audit vào `notes`. | Modify (`:311-357`) |
| `tests/integration/tuition-payment-cancel.test.ts` | Hủy thanh toán → nợ quay lại đúng, carry-over tháng sau đúng, có dòng audit. | Create |
| `src/language/vi.json`, `src/language/en.json` | Key i18n mới. | Modify |
| `src/app/(app)/tuition/page.tsx` | Badge "Tất toán (miễn giảm)" tách khỏi "Đã đóng đủ". | Modify (`getStatusBadge`) |
| `src/components/tuition/TuitionDetailSheet.tsx` | Chế độ sửa, nút Hủy + AlertDialog, cảnh báo miễn giảm, wire `mergeOverpaidNote`, toast nêu tháng + Hoàn tác. | Modify |

**Không đụng tới:** `prisma/schema.prisma`, `src/lib/schemas/tuition.ts`, router tRPC, dashboard/report. `PaymentDialog.tsx` để nguyên (dead code, xử lý riêng).

---

### Task 1: Helper ghi vết sửa/hủy thanh toán

**Files:**
- Modify: `src/lib/payment-notes.ts`
- Test: `tests/unit/lib/payment-notes.test.ts`

- [ ] **Step 1: Viết test thất bại**

Thêm vào cuối `tests/unit/lib/payment-notes.test.ts`:

```ts
import { buildPaymentAuditNote, formatVnDate } from "@/lib/payment-notes"

describe("formatVnDate", () => {
  it("đổi sang ngày theo giờ VN (UTC+7), không dùng giờ server", () => {
    // 2026-08-01T18:30:00Z = 01:30 ngày 02/08 giờ VN
    expect(formatVnDate(new Date("2026-08-01T18:30:00Z"))).toBe("02/08/2026")
  })
})

describe("buildPaymentAuditNote", () => {
  const now = new Date("2026-08-02T03:00:00Z")

  it("KHÔNG ghi vết lần ghi nhận đầu tiên (0 → 500k)", () => {
    expect(
      buildPaymentAuditNote({
        notes: "Phụ huynh chuyển khoản",
        prevPaidAmount: 0,
        nextPaidAmount: 500000,
        prevIsFullPaid: false,
        nextIsFullPaid: false,
        now,
      })
    ).toBe("Phụ huynh chuyển khoản")
  })

  it("ghi vết khi HỦY (500k → 0)", () => {
    expect(
      buildPaymentAuditNote({
        notes: "",
        prevPaidAmount: 500000,
        nextPaidAmount: 0,
        prevIsFullPaid: false,
        nextIsFullPaid: false,
        now,
      })
    ).toBe("[02/08/2026] Hủy ghi nhận thanh toán: 500.000 đ → 0 đ")
  })

  it("ghi vết khi SỬA số tiền (500k → 300k), nối tiếp ghi chú cũ", () => {
    expect(
      buildPaymentAuditNote({
        notes: "Ghi chú cũ",
        prevPaidAmount: 500000,
        nextPaidAmount: 300000,
        prevIsFullPaid: false,
        nextIsFullPaid: false,
        now,
      })
    ).toBe("Ghi chú cũ\n[02/08/2026] Sửa số tiền đã đóng: 500.000 đ → 300.000 đ")
  })

  it("ghi vết khi bỏ đánh dấu tất toán dù số tiền không đổi", () => {
    expect(
      buildPaymentAuditNote({
        notes: "",
        prevPaidAmount: 300000,
        nextPaidAmount: 300000,
        prevIsFullPaid: true,
        nextIsFullPaid: false,
        now,
      })
    ).toBe("[02/08/2026] Bỏ đánh dấu tất toán")
  })

  it("gộp cả hai thay đổi vào MỘT dòng", () => {
    expect(
      buildPaymentAuditNote({
        notes: "",
        prevPaidAmount: 500000,
        nextPaidAmount: 0,
        prevIsFullPaid: true,
        nextIsFullPaid: false,
        now,
      })
    ).toBe("[02/08/2026] Hủy ghi nhận thanh toán: 500.000 đ → 0 đ; bỏ đánh dấu tất toán")
  })

  it("không ghi gì khi không có thay đổi", () => {
    expect(
      buildPaymentAuditNote({
        notes: "Giữ nguyên",
        prevPaidAmount: 300000,
        nextPaidAmount: 300000,
        prevIsFullPaid: true,
        nextIsFullPaid: true,
        now,
      })
    ).toBe("Giữ nguyên")
  })
})
```

- [ ] **Step 2: Chạy test để chắc chắn nó FAIL**

Run: `pnpm test:unit tests/unit/lib/payment-notes.test.ts`
Expected: FAIL — `buildPaymentAuditNote is not a function` / lỗi import.

- [ ] **Step 3: Cài đặt tối thiểu**

Thêm vào cuối `src/lib/payment-notes.ts`:

```ts
import { formatCurrency } from "./utils"

/**
 * Ngày theo giờ VN (UTC+7) dạng dd/mm/yyyy. Không dùng giờ local của process vì
 * server chạy UTC (Vercel) — sẽ lệch ngày với giáo viên trước 07:00 sáng.
 */
export function formatVnDate(now: Date): string {
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const day = String(vn.getUTCDate()).padStart(2, "0")
  const month = String(vn.getUTCMonth() + 1).padStart(2, "0")
  return `${day}/${month}/${vn.getUTCFullYear()}`
}

/**
 * Ghép một dòng ghi vết vào ghi chú khi thanh toán bị SỬA hoặc HỦY. Lần ghi nhận
 * đầu tiên (prevPaidAmount = 0, chưa tất toán) KHÔNG ghi vết — chỉ việc đính
 * chính mới cần dấu vết. Timestamp do server truyền vào để test tất định.
 */
export function buildPaymentAuditNote(params: {
  notes: string
  prevPaidAmount: number
  nextPaidAmount: number
  prevIsFullPaid: boolean
  nextIsFullPaid: boolean
  now: Date
}): string {
  const { notes, prevPaidAmount, nextPaidAmount, prevIsFullPaid, nextIsFullPaid, now } = params

  const parts: string[] = []

  if (prevPaidAmount > 0 && nextPaidAmount !== prevPaidAmount) {
    const label = nextPaidAmount === 0 ? "Hủy ghi nhận thanh toán" : "Sửa số tiền đã đóng"
    parts.push(`${label}: ${formatCurrency(prevPaidAmount)} → ${formatCurrency(nextPaidAmount)}`)
  }

  if (prevIsFullPaid && !nextIsFullPaid) {
    parts.push(parts.length > 0 ? "bỏ đánh dấu tất toán" : "Bỏ đánh dấu tất toán")
  }

  if (parts.length === 0) return notes

  const line = `[${formatVnDate(now)}] ${parts.join("; ")}`
  return notes ? `${notes}\n${line}` : line
}
```

- [ ] **Step 4: Chạy test để chắc chắn nó PASS**

Run: `pnpm test:unit tests/unit/lib/payment-notes.test.ts`
Expected: PASS — toàn bộ test cũ của `mergeOverpaidNote` + 6 test mới.

- [ ] **Step 5: Commit**

```bash
git add src/lib/payment-notes.ts tests/unit/lib/payment-notes.test.ts
git commit -m "feat(tuition): helper ghi vết khi sửa/hủy ghi nhận thanh toán"
```

---

### Task 2: Service ghi vết audit vào notes

**Files:**
- Modify: `src/server/services/tuition.service.ts:311-357`
- Test: `tests/integration/tuition-payment-cancel.test.ts` (Create)

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/integration/tuition-payment-cancel.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest"
import { db } from "@/server/db"
import { getAuthedCaller } from "../helpers/trpc"
import { ATTENDANCE_STATUS } from "@/lib/constants"

async function cleanup() {
  await db.monthlyTuition.deleteMany()
  await db.sessionStudent.deleteMany()
  await db.teachingSession.deleteMany()
  await db.student.deleteMany()
}

/**
 * Đóng nhầm tiền / nhầm tháng phải HỦY được: reset về 0 và bỏ tất toán thì nợ
 * phải hiện lại đúng ở tháng đó VÀ chuyển đúng sang tháng sau (không bị
 * Math.min(0, residual) của isFullPaid nuốt mất).
 */
describe("Hủy / sửa ghi nhận thanh toán học phí", () => {
  beforeEach(async () => {
    await cleanup()
  })

  async function seedJulyDebt(fee: number) {
    const caller = await getAuthedCaller()
    const subjects = await caller.subject.list({})
    const student = await caller.student.create({
      fullName: "HS Đóng Nhầm",
      grade: 5,
      tuitionFee: fee,
    })
    const s = await caller.session.create({
      sessionDate: "2026-07-10",
      startTime: "08:00",
      endTime: "09:30",
      subjectId: subjects[0].id,
    })
    await caller.session.addStudents({ sessionId: s.id, studentIds: [student.id] })
    await caller.attendance.update({
      sessionId: s.id,
      attendances: [{ studentId: student.id, attendance: ATTENDANCE_STATUS.PRESENT, fee }],
    })
    return { caller, student }
  }

  it("hủy thanh toán (về 0, bỏ tất toán) làm nợ hiện lại trong chính tháng đó", async () => {
    const { caller, student } = await seedJulyDebt(500000)

    await caller.tuition.updatePayment({
      studentId: student.id, year: 2026, month: 7, paidAmount: 500000, isFullPaid: true,
    })
    await caller.tuition.updatePayment({
      studentId: student.id, year: 2026, month: 7, paidAmount: 0, isFullPaid: false,
    })

    const july = await caller.tuition.getMonthlyStatus({ year: 2026, month: 7, studentId: student.id })
    expect(july.items[0].paidAmount).toBe(0)
    expect(july.items[0].isFullPaid).toBe(false)
    expect(july.items[0].totalAmountDue).toBe(500000)
  })

  it("hủy thanh toán trả lại nợ cho tháng sau (không bị tất toán nuốt mất)", async () => {
    const { caller, student } = await seedJulyDebt(500000)

    await caller.tuition.updatePayment({
      studentId: student.id, year: 2026, month: 7, paidAmount: 500000, isFullPaid: true,
    })
    await caller.tuition.updatePayment({
      studentId: student.id, year: 2026, month: 7, paidAmount: 0, isFullPaid: false,
    })

    const aug = await caller.tuition.getMonthlyStatus({ year: 2026, month: 8, studentId: student.id })
    expect(aug.items[0].previousBalance).toBe(500000)
  })

  it("ghi vết dòng audit vào notes khi hủy, giữ nguyên ghi chú của user", async () => {
    const { caller, student } = await seedJulyDebt(500000)

    await caller.tuition.updatePayment({
      studentId: student.id, year: 2026, month: 7, paidAmount: 500000, isFullPaid: false,
      notes: "Mẹ chuyển khoản",
    })
    await caller.tuition.updatePayment({
      studentId: student.id, year: 2026, month: 7, paidAmount: 0, isFullPaid: false,
      notes: "Mẹ chuyển khoản",
    })

    const july = await caller.tuition.getMonthlyStatus({ year: 2026, month: 7, studentId: student.id })
    expect(july.items[0].notes).toContain("Mẹ chuyển khoản")
    expect(july.items[0].notes).toContain("Hủy ghi nhận thanh toán: 500.000 đ → 0 đ")
  })

  it("KHÔNG ghi vết ở lần ghi nhận đầu tiên", async () => {
    const { caller, student } = await seedJulyDebt(500000)

    await caller.tuition.updatePayment({
      studentId: student.id, year: 2026, month: 7, paidAmount: 500000, isFullPaid: false,
      notes: "Tiền mặt",
    })

    const july = await caller.tuition.getMonthlyStatus({ year: 2026, month: 7, studentId: student.id })
    expect(july.items[0].notes).toBe("Tiền mặt")
  })

  it("chuyển tiền đóng nhầm từ tháng 7 sang tháng 8 cho ra số dư đúng ở cả hai tháng", async () => {
    const { caller, student } = await seedJulyDebt(500000)
    const subjects = await caller.subject.list({})
    const aug = await caller.session.create({
      sessionDate: "2026-08-10", startTime: "08:00", endTime: "09:30", subjectId: subjects[0].id,
    })
    await caller.session.addStudents({ sessionId: aug.id, studentIds: [student.id] })
    await caller.attendance.update({
      sessionId: aug.id,
      attendances: [{ studentId: student.id, attendance: ATTENDANCE_STATUS.PRESENT, fee: 400000 }],
    })

    // Đóng nhầm vào tháng 7
    await caller.tuition.updatePayment({
      studentId: student.id, year: 2026, month: 7, paidAmount: 400000, isFullPaid: false,
    })
    // Hủy ở tháng 7, ghi lại vào tháng 8
    await caller.tuition.updatePayment({
      studentId: student.id, year: 2026, month: 7, paidAmount: 0, isFullPaid: false,
    })
    await caller.tuition.updatePayment({
      studentId: student.id, year: 2026, month: 8, paidAmount: 400000, isFullPaid: false,
    })

    const julyView = await caller.tuition.getMonthlyStatus({ year: 2026, month: 7, studentId: student.id })
    const augView = await caller.tuition.getMonthlyStatus({ year: 2026, month: 8, studentId: student.id })

    expect(julyView.items[0].paidAmount).toBe(0)
    expect(augView.items[0].previousBalance).toBe(500000) // nợ tháng 7 vẫn còn nguyên
    expect(augView.items[0].totalAmountDue).toBe(900000)  // 500k nợ + 400k tháng 8
    expect(augView.items[0].paidAmount).toBe(400000)
  })
})
```

- [ ] **Step 2: Chạy test để chắc chắn nó FAIL**

Run: `pnpm test:integration tests/integration/tuition-payment-cancel.test.ts`
Expected: FAIL ở test "ghi vết dòng audit" — `notes` chỉ bằng `"Mẹ chuyển khoản"`, không chứa dòng audit. Các test carry-over còn lại có thể PASS sẵn (logic backend đã đúng) — đó là test hồi quy, giữ lại.

- [ ] **Step 3: Cài đặt tối thiểu**

Trong `src/server/services/tuition.service.ts`, thêm import ở đầu file:

```ts
import { buildPaymentAuditNote } from "@/lib/payment-notes"
```

Sửa `updateTuitionPayment` (`:311-357`) thành:

```ts
export async function updateTuitionPayment(
  db: PrismaClient,
  userId: number,
  input: UpdatePaymentInput
) {
  const { studentId, year, month, paidAmount, isFullPaid, notes } = input

  const student = await db.student.findUnique({ where: { id: studentId } })
  await assertOwnership(student, userId)

  // Snapshot TRƯỚC khi ghi đè — dùng để so sánh và ghi vết lần sửa/hủy.
  const existing = await db.monthlyTuition.findUnique({
    where: { studentId_year_month: { studentId, year, month } },
  })

  // Ensure the month's snapshot exists with correct computed fields
  // (previousBalance carry-over, currentMonthFee, totalAmountDue) BEFORE
  // recording payment. Otherwise paying for a not-yet-viewed month would
  // create a bare snapshot with previousBalance=0 and silently drop the
  // student's prior-month debt.
  await getMonthlyTuitionStatus(db, userId, {
    studentId,
    year,
    month,
    status: "all",
    page: 1,
    limit: 1,
  })

  const finalNotes = buildPaymentAuditNote({
    notes: notes ?? existing?.notes ?? "",
    prevPaidAmount: existing?.paidAmount ?? 0,
    nextPaidAmount: paidAmount,
    prevIsFullPaid: existing?.isFullPaid ?? false,
    nextIsFullPaid: isFullPaid,
    now: new Date(),
  })

  return await db.monthlyTuition.upsert({
    where: {
      studentId_year_month: {
        studentId,
        year,
        month,
      },
    },
    update: {
      paidAmount,
      isFullPaid,
      notes: finalNotes,
    },
    create: {
      studentId,
      year,
      month,
      paidAmount,
      isFullPaid,
      notes: finalNotes,
    },
  })
}
```

- [ ] **Step 4: Chạy test để chắc chắn nó PASS**

Run: `pnpm test:integration tests/integration/tuition-payment-cancel.test.ts`
Expected: PASS 5/5.

Run hồi quy: `pnpm test:integration tests/integration/tuition.test.ts tests/integration/tuition-fullpaid-settlement.test.ts tests/integration/tuition-payment-snapshot.test.ts tests/integration/tuition-report-consistency.test.ts tests/integration/group-b-financial.test.ts`
Expected: PASS toàn bộ. Nếu có test nào assert `notes` bằng chính xác một chuỗi sau khi gọi `updatePayment` **hai lần**, sửa assertion sang `toContain` — dòng audit là hành vi mới có chủ đích.

- [ ] **Step 5: Commit**

```bash
git add src/server/services/tuition.service.ts tests/integration/tuition-payment-cancel.test.ts
git commit -m "feat(tuition): ghi vết vào notes khi sửa/hủy ghi nhận thanh toán"
```

---

### Task 3: Key i18n cho luồng sửa/hủy

**Files:**
- Modify: `src/language/vi.json`
- Modify: `src/language/en.json`

- [ ] **Step 1: Thêm key vào `vi.json`**

Chèn ngay sau dòng `"confirm_payment": "Xác nhận đóng tiền",`:

```json
  "update_payment": "Cập nhật thanh toán",
  "cancel_payment": "Hủy thanh toán",
  "cancel_payment_confirm_title": "Hủy ghi nhận thanh toán?",
  "cancel_payment_confirm_desc": "Số tiền đã ghi nhận của tháng này sẽ về 0 và bỏ đánh dấu tất toán. Khoản nợ sẽ hiện lại và chuyển sang tháng sau. Thao tác được ghi vết vào ghi chú.",
  "cancel_payment_success": "Đã hủy ghi nhận thanh toán",
  "keep": "Giữ nguyên",
  "recorded_amount": "Đang ghi nhận",
  "settled_waived": "Tất toán (miễn giảm)",
  "settled_waived_warning": "Đang đánh dấu TẤT TOÁN dù còn thiếu",
  "settled_waived_warning_suffix": "Phần thiếu sẽ được miễn và KHÔNG chuyển sang tháng sau.",
  "undo": "Hoàn tác",
  "undo_success": "Đã hoàn tác về giá trị trước đó",
  "payment_saved_for_month": "Đã lưu học phí tháng",
```

- [ ] **Step 2: Thêm key tương ứng vào `en.json`**

Chèn ngay sau dòng `"confirm_payment": "Confirm Payment",`:

```json
  "update_payment": "Update payment",
  "cancel_payment": "Cancel payment",
  "cancel_payment_confirm_title": "Cancel this payment record?",
  "cancel_payment_confirm_desc": "The recorded amount for this month will be reset to 0 and the settled flag cleared. The debt reappears and carries over to next month. The action is logged in the notes.",
  "cancel_payment_success": "Payment record cancelled",
  "keep": "Keep",
  "recorded_amount": "Recorded",
  "settled_waived": "Settled (waived)",
  "settled_waived_warning": "Marked as SETTLED while still short by",
  "settled_waived_warning_suffix": "The shortfall is waived and will NOT carry over to next month.",
  "undo": "Undo",
  "undo_success": "Reverted to the previous values",
  "payment_saved_for_month": "Tuition saved for month",
```

- [ ] **Step 3: Kiểm tra hai file cùng bộ key**

Run:
```bash
node -e "const vi=require('./src/language/vi.json'),en=require('./src/language/en.json');const a=Object.keys(vi),b=Object.keys(en);console.log('vi only:',a.filter(k=>!b.includes(k)));console.log('en only:',b.filter(k=>!a.includes(k)))"
```
Expected: `vi only: []` và `en only: []`.

- [ ] **Step 4: Commit**

```bash
git add src/language/vi.json src/language/en.json
git commit -m "feat(i18n): key cho luồng sửa/hủy ghi nhận thanh toán"
```

---

### Task 4: Badge tách "Tất toán (miễn giảm)" khỏi "Đã đóng đủ"

**Files:**
- Modify: `src/app/(app)/tuition/page.tsx:38-96`

Lý do: hôm nay `isFullPaid` được ưu tiên tuyệt đối (`:51`) nên một HS trả 0 đ mà bị tick tất toán vẫn hiện "Đã đóng đủ" — chính là "status hiển thị ko đúng". Không bỏ nhánh này (miễn/giảm là tính năng thật), mà hiển thị khác đi để nhìn là biết.

- [ ] **Step 1: Sửa `getStatusBadge`**

Thêm import icon:

```tsx
import { ChevronLeft, ChevronRight, Search, Wallet, CheckCircle2, AlertCircle, Clock, CircleDollarSign, BadgeCheck } from "lucide-react"
```

Chèn nhánh mới NGAY TRƯỚC khối `if (item.isFullPaid) {` (`:51`):

```tsx
  // Tất toán nhưng số tiền thực đóng chưa đủ → là MIỄN/GIẢM, không phải "đóng đủ".
  // Hiển thị riêng để danh sách không nói dối khi GV lỡ tick rồi sửa tiền xuống.
  if (item.isFullPaid && item.paidAmount < adjustedAmount) {
    return (
      <Badge className="bg-teal-100 text-teal-700 hover:bg-teal-100 border-none">
        <BadgeCheck className="size-3 mr-1" /> {t("settled_waived")}
      </Badge>
    )
  }
```

Giữ nguyên toàn bộ các nhánh còn lại. Bộ lọc backend (`tuition.service.ts:263`) vẫn xếp cả hai vào nhóm `fully_paid` — đúng, vì cả hai đều "đã chốt".

- [ ] **Step 2: Kiểm tra bằng type-check**

Run: `pnpm exec tsc --noEmit`
Expected: không lỗi.

- [ ] **Step 3: Kiểm tra thủ công**

Run: `pnpm dev`, mở `/tuition`. Chọn một HS còn nợ → mở chi tiết → tick "Đánh dấu đã đóng đủ", để số tiền 0 → Xác nhận.
Expected: dòng đó hiện badge **xanh ngọc "Tất toán (miễn giảm)"**, KHÔNG phải xanh lá "Đã đóng đủ".

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/tuition/page.tsx
git commit -m "fix(tuition): tách badge tất toán miễn giảm khỏi đã đóng đủ"
```

---

### Task 5: Sheet chi tiết — chế độ sửa, nút Hủy, cảnh báo, note idempotent

**Files:**
- Modify: `src/components/tuition/TuitionDetailSheet.tsx`

- [ ] **Step 1: Thay effect auto-note lỗi bằng `mergeOverpaidNote`**

Sửa import ở đầu file:

```tsx
import { useEffect, useRef, useState } from "react"
```

Thêm:

```tsx
import { mergeOverpaidNote } from "@/lib/payment-notes"
import { AlertTriangle } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
```

Thêm ref ngay sau khai báo `form` (`:56`):

```tsx
  // Auto-note "trả dư" đã chèn lần gần nhất — để gỡ/thay idempotent khi GV sửa
  // lại số tiền hoặc đổi ngôn ngữ.
  const autoNoteRef = useRef<string>("")
```

Trong `useEffect` reset form (`:58-69`), thêm dòng cuối trong nhánh `if`:

```tsx
      autoNoteRef.current = ""
```

XÓA toàn bộ effect `// Auto-fill note when overpaid` (`:75-93`, gồm cả `const watchedPaidAmount = form.watch("paidAmount")`) và thay bằng:

```tsx
  // Auto-fill note khi trả dư — luôn gỡ auto-note cũ trước khi chèn cái mới, nên
  // sửa lại số tiền sẽ cập nhật/gỡ đúng thay vì để lại ghi chú sai.
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name !== "paidAmount" || !data) return

      const paidAmount = value.paidAmount || 0
      const excess = paidAmount - Math.max(0, data.totalAmountDue)
      const autoNote =
        excess > 0
          ? `${t("overpaid_note_prefix")} ${formatCurrency(excess)}, ${t("overpaid_note_suffix")} ${formatCurrency(excess)}`
          : ""

      if (autoNote === autoNoteRef.current) return

      form.setValue(
        "notes",
        mergeOverpaidNote({
          rawNotes: form.getValues("notes") || "",
          prevAutoNote: autoNoteRef.current,
          autoNote,
        })
      )
      autoNoteRef.current = autoNote
    })
    return () => subscription.unsubscribe()
  }, [form, data, t])
```

- [ ] **Step 2: Thêm state theo dõi để hiện cảnh báo + đổi nhãn nút**

Chèn ngay dưới effect vừa thêm:

```tsx
  const watchedPaidAmount = form.watch("paidAmount")
  const watchedIsFullPaid = form.watch("isFullPaid")

  // Đã có ghi nhận trên DB → form đang ở chế độ SỬA, không phải nhập mới.
  const hasRecordedPayment = !!data && (data.paidAmount > 0 || data.isFullPaid)
  const shortfall = data ? Math.max(0, data.totalAmountDue) - (watchedPaidAmount || 0) : 0
  const showWaivedWarning = watchedIsFullPaid && shortfall > 0
```

- [ ] **Step 3: Hiện trạng thái đang ghi nhận + cảnh báo miễn giảm**

Trong `mainContent`, ngay dưới khối tiêu đề `{t("student")}...` (sau `</div>` đóng ở `:120`), chèn:

```tsx
      {hasRecordedPayment && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm flex items-center justify-between">
          <span className="text-blue-700 font-medium">{t("recorded_amount")}</span>
          <span className="font-bold text-blue-900">{formatCurrency(data.paidAmount)}</span>
        </div>
      )}
```

Ngay SAU `FormField` của `isFullPaid` (sau `:214`), chèn cảnh báo:

```tsx
            {showWaivedWarning && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-2 items-start">
                <AlertTriangle className="size-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  {t("settled_waived_warning")} {formatCurrency(shortfall)}. {t("settled_waived_warning_suffix")}
                </p>
              </div>
            )}
```

- [ ] **Step 4: Nút "Hủy thanh toán" có xác nhận + nhãn nút submit động**

Thêm handler ngay dưới `quickPayAdjusted` (`:104`):

```tsx
  function handleCancelPayment() {
    if (!data) return
    mutation.mutate({
      studentId: data.studentId,
      year: data.year,
      month: data.month,
      paidAmount: 0,
      isFullPaid: false,
      // Gỡ auto-note trả dư, giữ lại ghi chú do GV nhập.
      notes: mergeOverpaidNote({
        rawNotes: form.getValues("notes") || "",
        prevAutoNote: autoNoteRef.current,
        autoNote: "",
      }),
    })
  }
```

Thay khối `footer` (`:240-255`) bằng:

```tsx
  const footer = (
    <div className="p-6 border-t bg-white space-y-4">
      <div className="bg-amber-50 rounded-xl p-3 flex gap-3 items-start border border-amber-100">
        <Info className="size-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-700 leading-relaxed">{t("payment_tip_snapshot")}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          className="w-full h-12 text-md font-bold bg-black hover:bg-slate-800 text-white shadow-lg transition-all active:scale-[0.98] rounded-xl"
          disabled={mutation.isPending}
        >
          {mutation.isPending
            ? t("saving")
            : hasRecordedPayment
            ? t("update_payment")
            : t("confirm_payment")}
        </Button>

        {hasRecordedPayment && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="w-full h-11 font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl"
                disabled={mutation.isPending}
              >
                {t("cancel_payment")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("cancel_payment_confirm_title")}</AlertDialogTitle>
                <AlertDialogDescription>{t("cancel_payment_confirm_desc")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("keep")}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-red-600 hover:bg-red-700"
                  onClick={handleCancelPayment}
                >
                  {t("cancel_payment")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  )
```

- [ ] **Step 5: Type-check + thử tay**

Run: `pnpm exec tsc --noEmit`
Expected: không lỗi.

Run: `pnpm dev`, mở `/tuition` → chọn HS còn nợ → "Đóng toàn bộ" → Xác nhận. Mở lại HS đó.
Expected:
1. Có ô xanh "Đang ghi nhận: <số tiền>".
2. Nút chính đổi thành "Cập nhật thanh toán", có thêm nút đỏ "Hủy thanh toán".
3. Bấm "Hủy thanh toán" → hộp xác nhận → đồng ý → badge quay về "Chưa đóng", số tiền cần đóng trở lại như cũ.
4. Mở lại → phần Ghi chú có dòng `[dd/mm/yyyy] Hủy ghi nhận thanh toán: ... → 0 đ`.
5. Nhập tiền vượt tổng nợ → note "Đóng thừa..." xuất hiện; giảm tiền xuống → note **tự biến mất** (trước đây bị kẹt lại).

- [ ] **Step 6: Commit**

```bash
git add src/components/tuition/TuitionDetailSheet.tsx
git commit -m "feat(tuition): chế độ sửa + nút hủy ghi nhận thanh toán, cảnh báo tất toán thiếu tiền"
```

---

### Task 6: Toast nêu rõ tháng + Hoàn tác (chống nhầm tháng)

**Files:**
- Modify: `src/components/tuition/TuitionDetailSheet.tsx`

Đây là lớp bảo vệ cho tình huống "nhầm tháng": toast nói rõ vừa lưu cho tháng nào, và cho hoàn tác ngay mà không phải đi tìm lại.

- [ ] **Step 1: Lưu giá trị trước khi ghi + cờ chống lặp**

Thêm ngay dưới `autoNoteRef`:

```tsx
  // Giá trị trên DB TRƯỚC lần ghi gần nhất — dùng cho nút Hoàn tác trên toast.
  const prevValuesRef = useRef<UpdatePaymentInput | null>(null)
  // Chặn hiện tiếp nút Hoàn tác trên toast của chính lần hoàn tác (1 cấp là đủ).
  const isUndoingRef = useRef(false)
```

- [ ] **Step 2: Thay `useMutation` (`:35-44`) bằng bản có toast chi tiết**

```tsx
  const mutation = trpc.tuition.updatePayment.useMutation({
    onSuccess: (_result, variables) => {
      onSuccess()
      onOpenChange(false)

      if (isUndoingRef.current) {
        isUndoingRef.current = false
        toast.success(t("undo_success"))
        return
      }

      const prev = prevValuesRef.current
      const title =
        variables.paidAmount === 0 && !variables.isFullPaid
          ? t("cancel_payment_success")
          : `${t("payment_saved_for_month")} ${variables.month}/${variables.year}: ${formatCurrency(variables.paidAmount)}`

      toast.success(title, {
        action: prev
          ? {
              label: t("undo"),
              onClick: () => {
                isUndoingRef.current = true
                mutation.mutate(prev)
              },
            }
          : undefined,
      })
    },
    onError: (error) => {
      isUndoingRef.current = false
      toast.error(error.message)
    },
  })
```

Bỏ key `payment_update_success` khỏi luồng này (key vẫn giữ trong `vi.json`/`en.json` vì `PaymentDialog.tsx` còn dùng).

- [ ] **Step 3: Ghi lại giá trị cũ ở mọi đường ghi**

Trong `onSubmit`:

```tsx
  function onSubmit(values: UpdatePaymentInput) {
    if (data) {
      prevValuesRef.current = {
        studentId: data.studentId,
        year: data.year,
        month: data.month,
        paidAmount: data.paidAmount,
        isFullPaid: data.isFullPaid,
        notes: data.notes || "",
      }
    }
    mutation.mutate(values)
  }
```

Trong `handleCancelPayment`, chèn TRƯỚC `mutation.mutate(...)`:

```tsx
    prevValuesRef.current = {
      studentId: data.studentId,
      year: data.year,
      month: data.month,
      paidAmount: data.paidAmount,
      isFullPaid: data.isFullPaid,
      notes: data.notes || "",
    }
```

- [ ] **Step 4: Type-check + thử tay**

Run: `pnpm exec tsc --noEmit`
Expected: không lỗi.

Run: `pnpm dev` → ghi nhận 500.000 đ cho một HS.
Expected: toast hiện `Đã lưu học phí tháng 8/2026: 500.000 đ` kèm nút **Hoàn tác**; bấm Hoàn tác → số tiền quay lại giá trị trước đó, toast báo "Đã hoàn tác về giá trị trước đó" và KHÔNG còn nút Hoàn tác nữa.

- [ ] **Step 5: Commit**

```bash
git add src/components/tuition/TuitionDetailSheet.tsx
git commit -m "feat(tuition): toast nêu rõ tháng đã lưu và cho hoàn tác ngay"
```

---

### Task 7: Kiểm tra toàn bộ trước khi merge

- [ ] **Step 1: Lint**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 2: Build (bao gồm type-check)**

Run: `pnpm build`
Expected: build thành công. **Lưu ý:** script build có `prisma migrate deploy` — chỉ chạy khi `.env` trỏ đúng DB dev/test, KHÔNG chạy khi đang trỏ production (theo `docs/coding-rule.md` §6.1).

- [ ] **Step 3: Toàn bộ test**

Run: `pnpm test`
Expected: PASS toàn bộ, gồm 5 test mới ở `tuition-payment-cancel.test.ts` và 6 test mới ở `payment-notes.test.ts`.

- [ ] **Step 4: Merge**

```bash
git checkout main && git merge --no-ff fix/tuition-payment-edit-cancel
```

---

## Ngoài phạm vi (ghi nhận, không làm trong plan này)

1. **`src/components/tuition/PaymentDialog.tsx` là dead code** — không file nào import. Trùng chức năng với `TuitionDetailSheet`. Đề xuất xóa ở một commit `chore:` riêng sau khi chủ dự án xác nhận.
2. **Logic badge bị nhân đôi** giữa `page.tsx:getStatusBadge` và bộ lọc `status` trong `tuition.service.ts:256-285`. Hai nơi phải sửa song song mỗi lần đổi quy tắc. Nên tách ra `src/lib/tuition-status.ts` dùng chung — refactor riêng, có test riêng.
3. **Không có khóa lạc quan (optimistic locking)** trên `MonthlyTuition`: hai tab cùng sửa thì tab lưu sau thắng. Chấp nhận được với mô hình 1 giáo viên/tenant hiện tại.
4. **Chuyển thanh toán sang tháng khác bằng 1 thao tác** (phương án B) và **sổ cái thanh toán có lịch sử** (phương án C) đã được cân nhắc và gác lại.
