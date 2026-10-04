# Z — Dọn lỗi nhỏ còn hoãn của Y và X Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa 8 lỗi nhỏ còn hoãn sau Y (thu học phí) và X (chính sách mật khẩu). Version `0.11.1` (patch).

**Architecture:** Toàn sửa nhỏ tại chỗ, không migration, không router mới. Mỗi task 1 khu vực: lịch/tháng mặc định, ô số tiền, file sao lưu, hộp Miễn, form đăng ký, khung tóm tắt chính sách, rồi version + kiểm toàn bộ.

**Tech Stack:** Next.js 15, React 19, react-hook-form + zod 3.25, tRPC v11, ExcelJS, Vitest + Testing Library, Playwright.

**Spec:** Không có file spec riêng. Nguồn là các dòng `Final: minor (deferred)` trong ledger Y (`.superpowers/sdd/2026-10-03-y-thu-hoc-phi/progress.md`) và X (`.superpowers/sdd/2026-10-02-x-o3-chinh-sach-mat-khau/progress.md`), cùng 2 quyết định của người dùng ngày 2026-10-04 ghi dưới đây. Plan này là nguồn duy nhất.

## Quyết định của người dùng (2026-10-04)

- Hộp **Miễn phần còn thiếu** có thêm ô **Lý do** không bắt buộc. Có lý do thì nối vào ghi chú tháng đó dạng `Miễn: <lý do>` (dòng mới nếu ghi chú đã có chữ). Không đổi DB.
- **Bỏ** mục "sửa đợt thu thì tiền dư dồn vào tháng muộn nhất của đợt": giữ nguyên hành vi.
- **Ngoài phạm vi** (không làm): `tuition.ledgers` là query có ghi DB; câu báo lỗi server tiếng Anh; backlog #2 #3 #4 #6 #7.

## Global Constraints

- Nhánh `fix/z-don-loi-nho` từ `main` **sau khi W (0.11.0) đã merge**. Task 7 cần `src/lib/releases.ts` của W.
- **Không migration, không đổi `prisma/schema.prisma`.** Không chạy lệnh prisma nào ngoài những gì `pnpm test` tự chạy.
- An toàn DB: chỉ `.env.test` (localhost:5433). Cấm `db:reset` / `migrate reset` / `db push` trên mọi DB.
- Không `pnpm build` / `pnpm dev`. e2e: RAM ≥ 3000 MB, foreground, chia 2 nửa (`.superpowers/sdd/2026-10-03-y-thu-hoc-phi/half1.txt`, `half2.txt` + file e2e mới nếu có), chỉ dừng đúng PID mình tạo (LENH.md).
- **Không xoá / nới test cũ để qua.** Test cũ đỏ vì đổi hành vi có chủ đích thì sửa kỳ vọng đúng hành vi mới và ghi `Ruling:` trong ledger.
- Chuỗi giao diện mới qua i18n, thêm cùng key vào `vi.json` và `en.json`. Không dùng gạch dài (—, –) trong chuỗi mới.
- Màu: không indigo/violet/purple. Vùng chạm ≥ 44px trên mobile.
- Commit 1 dòng, không body, không Co-Authored-By. Ghi chú code tiếng Việt có dấu, 1–2 dòng.
- Mỗi task: test của task xanh + `pnpm exec tsc --noEmit` + `pnpm lint` sạch → commit → ledger `.superpowers/sdd/2026-10-04-z-don-loi-nho/progress.md` 1 dòng `Task N: complete (...)`.

## Review Focus

1. **Máy giáo viên để múi giờ khác (UTC) lúc 0h–7h sáng ngày 1**: Học phí phải mở tháng trước theo giờ VN, không lùi 2 tháng. Pin: Task 1 test `TZ=UTC`.
2. **Ghi chú đang gõ dở + Miễn có lý do**: lý do nối vào chữ đang có trong ô (kể cả chưa lưu), không mất chữ, không gửi 2 lần ghi đè nhau. Pin: Task 4 test "nối vào ghi chú đang gõ".
3. **Miễn không nhập lý do**: payload giữ đúng `{studentId, year, month, isFullPaid: true}` như trước, không đụng ghi chú. Pin: test cũ ReviewFix "xác nhận miễn chỉ gửi isFullPaid" phải còn xanh nguyên văn.
4. **Đăng ký: tên đăng nhập sai + mật khẩu không khớp cùng lúc**: bấm Đăng ký 1 lần thấy cả 2 lỗi. Pin: Task 5 test schema + test form.
5. **Học sinh còn nợ cũ, tháng này học phí 0đ** (nghỉ cả tháng): ô số tiền vẫn ghi rõ số đó là nợ tháng nào. Pin: Task 2.

---

### Task 1: Tháng mặc định theo giờ VN (`useCalendar`)

Lỗi: `useCalendar` lấy tháng mặc định bằng `new Date()` giờ máy. Máy để UTC, lúc 0h–7h sáng ngày 1 giờ VN vẫn là tháng cũ → Học phí mở lùi 2 tháng, Lịch/Báo cáo mở tháng trước.

**Files:**
- Modify: `src/hooks/useCalendar.ts:132-148`
- Test: `tests/unit/hooks/useCalendar.test.tsx`

**Interfaces:**
- Consumes: `vnDateParts()` từ `@/lib/utils`, `monthKey(y, m)` từ `@/lib/billing`, `keyToYearMonth(key)` từ `@/lib/payment-allocation` (đều có sẵn).
- Produces: `useCalendar()` trả `year`, `month` như cũ, chỉ đổi cách tính mặc định.

- [ ] **Step 1: Viết test đỏ** — thêm vào cuối `describe` hiện có trong `tests/unit/hooks/useCalendar.test.tsx`:

```tsx
  it("máy để múi giờ UTC, 01:00 ngày 1/10 giờ VN → vẫn là tháng 10 (offset 0) và tháng 9 (offset -1)", () => {
    const oldTz = process.env.TZ
    process.env.TZ = "UTC"
    try {
      vi.setSystemTime(new Date("2026-09-30T18:00:00.000Z")) // 01:00 1/10 giờ VN, còn 30/9 giờ UTC
      const now = renderHook(() => useCalendar(), { wrapper })
      expect(now.result.current.month).toBe(10)
      const prev = renderHook(() => useCalendar({ defaultOffset: -1 }), { wrapper })
      expect(prev.result.current.year).toBe(2026)
      expect(prev.result.current.month).toBe(9)
    } finally {
      process.env.TZ = oldTz
    }
  })
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `pnpm exec vitest run tests/unit/hooks/useCalendar.test.tsx`
Expected: FAIL ở test mới (nhận 9 thay vì 10). Nếu test mới XANH ngay thì Node không áp `process.env.TZ` lúc chạy → STOP, ghi lý do vào kênh, không đoán.

- [ ] **Step 3: Sửa** — trong `src/hooks/useCalendar.ts`, thêm import:

```ts
import { vnDateParts } from "@/lib/utils"
import { monthKey } from "@/lib/billing"
import { keyToYearMonth } from "@/lib/payment-allocation"
```

Thay khối `defaultDate` + 2 `useMemo` `year`/`month` bằng:

```ts
  // Tháng mặc định theo giờ VN: máy để múi giờ khác thì sáng ngày 1 vẫn ra đúng tháng.
  const defaultYm = useMemo(() => {
    const now = vnDateParts()
    return keyToYearMonth(monthKey(now.year, now.month) + defaultOffset)
  }, [defaultOffset])

  const year = useMemo(() => {
    const y = searchParams.get("year")
    return y ? parseInt(y, 10) : defaultYm.year
  }, [searchParams, defaultYm])

  const month = useMemo(() => {
    const m = searchParams.get("month")
    return m ? parseInt(m, 10) : defaultYm.month
  }, [searchParams, defaultYm])
```

Nếu `keyToYearMonth` import từ `payment-allocation` kéo theo vòng import hoặc code server vào client (tsc/lint báo) → dùng phép tính tại chỗ `{ year: Math.floor((k - 1) / 12), month: ((k - 1) % 12) + 1 }` sau khi đọc `monthKey` trong `src/lib/billing.ts` để khớp công thức, ghi `Ruling:`.

- [ ] **Step 4: Chạy lại, xác nhận xanh**

Run: `pnpm exec vitest run tests/unit/hooks/useCalendar.test.tsx`
Expected: PASS toàn bộ (cả 3 test cũ).

- [ ] **Step 5: tsc + lint + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/hooks/useCalendar.ts tests/unit/hooks/useCalendar.test.tsx
git commit -m "fix: tháng mặc định theo giờ VN (useCalendar)"
```

---

### Task 2: Ô số tiền vẫn ghi nợ cũ khi học phí tháng này 0đ

Lỗi: `TuitionAmountCell` chỉ hiện dòng nhỏ "T8 còn …" khi `totalExpected > 0`. Học sinh nghỉ cả tháng (học phí 0đ) mà còn nợ cũ thì chỉ thấy số to, không biết là nợ tháng nào.

Hành vi mới: còn nợ cũ thì luôn có phần nợ cũ. Phần "T9 …" chỉ thêm khi tiền tháng này > 0.

**Files:**
- Modify: `src/components/tuition/TuitionAmountCell.tsx:12-24`
- Test: `tests/unit/components/TuitionAmountCell.test.tsx`

**Interfaces:** không đổi props.

- [ ] **Step 1: Viết test đỏ** — thêm vào cuối `describe` chính trong `tests/unit/components/TuitionAmountCell.test.tsx`:

```tsx
  it("nợ cũ 1 tháng, học phí tháng này 0đ: dòng nhỏ chỉ 'T8 còn 200.000 đ', không có 'T9 0 đ'", () => {
    const item: Item = { ...baseItem, previousBalance: 200_000, totalExpected: 0, totalAmountDue: 200_000, debtMonths: 1 }
    render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionAmountCell item={item} month={9} />
      </LanguageProvider>
    )
    expect(screen.getByText("200.000 đ")).toBeDefined()
    expect(screen.getByText("T8 còn 200.000 đ")).toBeDefined()
    expect(screen.queryByText(/T9/)).toBeNull()
  })

  it("tháng đang học chưa có buổi (0đ) còn nợ 3 tháng: dòng nhỏ 'Nợ 3 tháng trước …', không có tạm tính", () => {
    const item: Item = { ...baseItem, inProgress: true, previousBalance: 500_000, totalExpected: 0, totalAmountDue: 500_000, debtMonths: 3 }
    const { container } = render(
      <LanguageProvider forcedLanguage="vi">
        <TuitionAmountCell item={item} month={10} />
      </LanguageProvider>
    )
    expect(container.textContent).toContain("500.000 đ")
    expect(container.textContent).not.toContain("tạm tính")
    expect(container.querySelector("span.text-xs")?.textContent).toMatch(/3 tháng/)
  })
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `pnpm exec vitest run tests/unit/components/TuitionAmountCell.test.tsx`
Expected: FAIL cả 2 test mới (không tìm thấy dòng nhỏ).

- [ ] **Step 3: Sửa** — trong `TuitionAmountCell.tsx` thay khối tạo `parts`:

```tsx
  const parts: string[] = []
  if (item.previousBalance > 0) {
    parts.push(
      item.debtMonths > 1
        ? t("debt_n_months").replace("{n}", String(item.debtMonths)).replace("{amount}", formatCurrency(item.previousBalance))
        : t("debt_prev_month").replace("{m}", String(prevM)).replace("{amount}", formatCurrency(item.previousBalance))
    )
  }
  // Tháng này 0đ (nghỉ cả tháng) thì chỉ ghi phần nợ cũ để biết số to là nợ tháng nào.
  if (item.totalExpected > 0) {
    if (isProvisional(item)) {
      parts.push(t("month_provisional").replace("{m}", String(month)).replace("{amount}", formatCurrency(item.totalExpected)))
    } else if (parts.length > 0) {
      parts.push(t("month_fee_short").replace("{m}", String(month)).replace("{amount}", formatCurrency(item.totalExpected)))
    }
  }
```

- [ ] **Step 4: Chạy lại test của ô + các màn dùng ô này**

Run: `pnpm exec vitest run tests/unit/components/TuitionAmountCell.test.tsx tests/unit/components/TuitionPageMobileCard.test.tsx tests/unit/components/TuitionDetailSheetPay.test.tsx`
Expected: PASS. Test cũ nào đỏ vì đúng hành vi mới (kỳ vọng không có dòng nhỏ khi 0đ) thì sửa kỳ vọng, ghi `Ruling:`.

- [ ] **Step 5: tsc + lint + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/components/tuition/TuitionAmountCell.tsx tests/unit/components/TuitionAmountCell.test.tsx
git commit -m "fix: ô số tiền ghi nợ cũ cả khi học phí tháng này 0đ"
```

---

### Task 3: File sao lưu bỏ cột "Hình thức"

Lỗi: từ Y, ghi tiền luôn lưu `method: "cash"` (`payment.service.ts:49`), giao diện không còn chọn hình thức. Cột "Hình thức" trong sheet "Lần thu" ghi "Tiền mặt" cho cả tiền chuyển khoản → sai lệch.

**Files:**
- Modify: `src/server/services/backup.service.ts:5,35-39,273`
- Test: `tests/integration/backup.test.ts:38-41,360-362`

- [ ] **Step 1: Sửa test cho đỏ** — trong `tests/integration/backup.test.ts`:
  - Mảng header `"Lần thu"` (dòng ~38-41) bỏ `"Hình thức",`:

```ts
  "Lần thu": [
    "ID", "ID học phí tháng", "ID học sinh", "Học sinh", "Năm", "Tháng", "Ngày thu", "Số tiền",
    "Ghi chú", "Ngày tạo", "Cập nhật lần cuối",
  ],
```

  - Test "Lần thu: nhãn Chuyển khoản…" (dòng ~360): đổi tên thành `"Lần thu: không còn cột Hình thức, ngày thu Date, số tiền nguyên, năm/tháng từ học phí tháng"` và thay dòng `expect(cellOf(ws, paymentId, "Hình thức").value).toBe("Chuyển khoản")` bằng:

```ts
    const headers = (ws.getRow(1).values as unknown[]).slice(1)
    expect(headers).not.toContain("Hình thức")
```

  Nếu `ws.getRow(1)` không phải dòng header (đọc helper `cellOf` / `sheet` ở đầu file để biết dòng header), dùng đúng dòng header mà `cellOf` dùng, ghi `Ruling:`.

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `pnpm exec vitest run tests/integration/backup.test.ts`
Expected: FAIL (header còn "Hình thức").

- [ ] **Step 3: Sửa** — trong `backup.service.ts`:
  - Xoá dòng `{ header: "Hình thức", width: 13, value: (p) => label(PAYMENT_METHOD_LABEL, p.method) },`.
  - Xoá hằng `PAYMENT_METHOD_LABEL` + ghi chú phía trên, xoá `import type { PAYMENT_METHODS } from "@/lib/schemas/payment"` (chỉ khi không còn chỗ dùng).
  - Trong `select` của payments (dòng ~152) bỏ `method: true,`.
  - Giữ hàm `label` (còn dùng cho trạng thái ca, cách lên lớp).

- [ ] **Step 4: Chạy lại**

Run: `pnpm exec vitest run tests/integration/backup.test.ts`
Expected: PASS.

- [ ] **Step 5: tsc + lint + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/server/services/backup.service.ts tests/integration/backup.test.ts
git commit -m "fix: file sao lưu bỏ cột Hình thức (luôn là tiền mặt từ Y)"
```

---

### Task 4: Hộp Miễn có ô Lý do (không bắt buộc)

**Files:**
- Modify: `src/components/tuition/WaiveDialog.tsx`
- Modify: `src/components/tuition/TuitionDetailSheet.tsx:199-209` (`handleConfirmWaive`)
- Modify: `src/language/vi.json`, `src/language/en.json`
- Test: `tests/unit/components/TuitionDetailSheetReviewFix.test.tsx`

**Interfaces:**
- `WaiveDialog` prop `onConfirm: (reason: string) => void` (trước: `() => void`). `reason` đã `trim()`, rỗng = không nhập.
- i18n mới:
  - `"waive_reason_label"`: vi `"Lý do (không bắt buộc)"`, en `"Reason (optional)"`
  - `"waive_reason_placeholder"`: vi `"VD: hoàn cảnh khó khăn"`, en `"E.g. family hardship"`
  - `"waive_note"`: vi `"Miễn: {reason}"`, en `"Waived: {reason}"`

- [ ] **Step 1: Viết test đỏ** — thêm `describe` mới cuối `tests/unit/components/TuitionDetailSheetReviewFix.test.tsx` (fixture `rowData` có `notes: "ghi chú cũ"`, tháng 9/2026, cần đóng 800.000):

```tsx
describe("TuitionDetailSheet — Miễn có lý do", () => {
  beforeEach(() => {
    mockUpdateSettlementMutate.mockReset()
    currentRow = rowData
  })

  function openWaive() {
    renderSheet()
    openMenu()
    fireEvent.click(screen.getByText("Miễn phần còn thiếu"))
  }

  it("nhập lý do → gửi isFullPaid + notes nối 'Miễn: <lý do>' xuống dòng sau ghi chú cũ", () => {
    openWaive()
    fireEvent.change(screen.getByLabelText("Lý do (không bắt buộc)"), { target: { value: "  hoàn cảnh khó khăn  " } })
    fireEvent.click(screen.getByRole("button", { name: /^Miễn 800\.000/ }))
    expect(mockUpdateSettlementMutate.mock.calls[0][0]).toEqual({
      studentId: 1, year: 2026, month: 9, isFullPaid: true, notes: "ghi chú cũ\nMiễn: hoàn cảnh khó khăn",
    })
  })

  it("ghi chú trống → notes chỉ là 'Miễn: <lý do>'", () => {
    const empty = { ...rowData, notes: null }
    currentRow = empty
    renderSheet(empty)
    openMenu()
    fireEvent.click(screen.getByText("Miễn phần còn thiếu"))
    fireEvent.change(screen.getByLabelText("Lý do (không bắt buộc)"), { target: { value: "con thứ 2" } })
    fireEvent.click(screen.getByRole("button", { name: /^Miễn 800\.000/ }))
    expect(mockUpdateSettlementMutate.mock.calls[0][0]).toEqual({
      studentId: 1, year: 2026, month: 9, isFullPaid: true, notes: "Miễn: con thứ 2",
    })
  })

  it("nối vào ghi chú đang gõ dở (chưa lưu), không mất chữ", () => {
    renderSheet()
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "đang gõ" } })
    openMenu()
    fireEvent.click(screen.getByText("Miễn phần còn thiếu"))
    fireEvent.change(screen.getByLabelText("Lý do (không bắt buộc)"), { target: { value: "x" } })
    fireEvent.click(screen.getByRole("button", { name: /^Miễn 800\.000/ }))
    expect(mockUpdateSettlementMutate.mock.calls.at(-1)![0].notes).toBe("đang gõ\nMiễn: x")
  })
})
```

`screen.getByRole("textbox")` ở test 3: nếu sheet có nhiều hơn 1 ô chữ, lấy ô ghi chú theo nhãn/placeholder thật trong `TuitionDetailSheet.tsx:492` và ghi `Ruling:`. Test cũ "xác nhận miễn chỉ gửi isFullPaid, không gửi kèm notes cũ" giữ NGUYÊN VĂN (Miễn không lý do).

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `pnpm exec vitest run tests/unit/components/TuitionDetailSheetReviewFix.test.tsx`
Expected: FAIL 3 test mới (không có ô "Lý do (không bắt buộc)").

- [ ] **Step 3: Sửa `WaiveDialog.tsx`** — thêm state lý do, xoá khi mở lại:

```tsx
"use client"
import { useEffect, useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatCurrency } from "@/lib/utils"
import { useTranslation } from "@/components/providers/LanguageProvider"

export function WaiveDialog({
  open,
  onOpenChange,
  amount,
  month,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  amount: number
  month: number
  onConfirm: (reason: string) => void
}) {
  const { t } = useTranslation()
  const formattedAmount = formatCurrency(amount)
  const [reason, setReason] = useState("")
  useEffect(() => {
    if (open) setReason("")
  }, [open])

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("waive_title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("waive_desc")
              .replace("{amount}", formattedAmount)
              .replace("{m}", String(month))}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="waive-reason">{t("waive_reason_label")}</Label>
          <Input
            id="waive-reason"
            value={reason}
            maxLength={200}
            placeholder={t("waive_reason_placeholder")}
            onChange={(e) => setReason(e.target.value)}
            className="h-11 sm:h-9"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
            onClick={() => onConfirm(reason.trim())}
          >
            {t("waive_confirm").replace("{amount}", formattedAmount)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

Trước khi dùng: kiểm `src/components/ui/label.tsx` có sẵn; không có thì dùng `<label htmlFor=… className="text-sm font-medium">`, ghi `Ruling:`.

- [ ] **Step 4: Sửa `handleConfirmWaive` trong `TuitionDetailSheet.tsx`**:

```tsx
  const handleConfirmWaive = (reason: string) => {
    // Lý do nối vào ghi chú đang có trong ô (kể cả chưa lưu); không nhập thì chỉ gửi isFullPaid như cũ.
    const nextNotes = reason ? [notes.trim(), t("waive_note").replace("{reason}", reason)].filter(Boolean).join("\n") : null
    if (nextNotes !== null) setNotes(nextNotes)
    updateSettlementMut.mutate(
      { studentId, year, month, isFullPaid: true, ...(nextNotes !== null && { notes: nextNotes }) },
      {
        onSuccess: () => {
          setWaiveOpen(false)
          toast.success(t("settlement_saved"))
        },
      }
    )
  }
```

`setNotes(nextNotes)` để ô ghi chú hiện đúng chữ mới và effect lưu-khi-đóng không gửi lại chữ cũ. Thêm 3 key i18n vào cả `vi.json` và `en.json` (đặt cạnh `"waive_confirm"`).

- [ ] **Step 5: Chạy lại**

Run: `pnpm exec vitest run tests/unit/components/TuitionDetailSheetReviewFix.test.tsx tests/unit/components/TuitionDetailSheetPay.test.tsx`
Expected: PASS. Repo chưa có test so khớp key vi/en → tự kiểm 3 key có ở cả 2 file: `grep -c "waive_reason_label\|waive_reason_placeholder\|waive_note\"" src/language/vi.json src/language/en.json` ra 3 mỗi file.

- [ ] **Step 6: tsc + lint + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/components/tuition/WaiveDialog.tsx src/components/tuition/TuitionDetailSheet.tsx src/language/vi.json src/language/en.json tests/unit/components/TuitionDetailSheetReviewFix.test.tsx
git commit -m "feat: hộp Miễn có ô lý do, nối vào ghi chú tháng"
```

---

### Task 5: Form đăng ký: lỗi "không khớp" hiện ngay lần bấm đầu, không báo sớm khi đang gõ

Lỗi 1: `.refine` trên object chỉ chạy khi mọi trường khác hợp lệ → tên đăng nhập sai + mật khẩu không khớp thì lần bấm đầu chỉ thấy lỗi tên, bấm lần 2 mới thấy "không khớp".
Lỗi 2: sửa ô Mật khẩu khi ô Nhập lại đã có chữ → báo "không khớp" ngay khi chưa bấm Đăng ký.

**Files:**
- Modify: `src/lib/schemas/auth.ts:37-41`
- Modify: `src/app/register/RegisterForm.tsx:43-47`
- Test: `tests/unit/schemas/register-form-schema.test.ts`, `tests/unit/components/RegisterForm.test.tsx`

**Interfaces:** `registerFormSchema(mismatchMessage)` và `RegisterFormValues` giữ tên. Payload gửi server không đổi.

- [ ] **Step 1: Viết test đỏ (schema)** — thêm vào `describe` trong `register-form-schema.test.ts`:

```ts
  it("tên đăng nhập sai + không khớp → có cả 2 lỗi trong 1 lần kiểm", () => {
    const r = registerFormSchema("Không khớp").safeParse({ ...base, username: "a", confirmPassword: "Khac123456" })
    expect(r.success).toBe(false)
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path.join("."))
      expect(paths).toContain("username")
      expect(paths).toContain("confirmPassword")
    }
  })
```

- [ ] **Step 2: Viết test đỏ (form)** — thêm vào `describe("RegisterForm: nhập lại mật khẩu (spec X §4)")`:

```tsx
  it("chưa bấm Đăng ký: sửa ô Mật khẩu khác ô Nhập lại → chưa báo lỗi", async () => {
    render(<LanguageProvider><RegisterForm /></LanguageProvider>)
    fill("MatKhau123456", "MatKhau123456")
    fireEvent.change(screen.getByLabelText(viText.password), { target: { value: "MatKhau999999" } })
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText(viText.register_password_mismatch)).toBeNull()
  })
```

- [ ] **Step 3: Chạy, xác nhận đỏ**

Run: `pnpm exec vitest run tests/unit/schemas/register-form-schema.test.ts tests/unit/components/RegisterForm.test.tsx`
Expected: FAIL 2 test mới (schema thiếu issue `confirmPassword`; form hiện lỗi sớm).

- [ ] **Step 4: Sửa schema** — `src/lib/schemas/auth.ts`:

```ts
export function registerFormSchema(mismatchMessage: string) {
  // .and(): phần so khớp chạy độc lập, không chờ các trường khác hợp lệ → bấm 1 lần thấy đủ lỗi.
  return registerSchema
    .extend({ confirmPassword: z.string().min(1, mismatchMessage) })
    .and(
      z
        .object({ password: z.string(), confirmPassword: z.string() })
        .refine((v) => v.password === v.confirmPassword, { message: mismatchMessage, path: ["confirmPassword"] })
    )
}
```

Test cũ "không khớp → lỗi ở confirmPassword" dùng `toEqual([...1 issue])` phải còn xanh (tên hợp lệ → chỉ 1 issue). Ô trống có thể ra 2 issue cùng path; test cũ chỉ kiểm `success === false` nên vẫn xanh.

- [ ] **Step 5: Sửa form** — `RegisterForm.tsx`, thay effect:

```tsx
  // Chỉ kiểm lại ô Nhập lại sau lần bấm Đăng ký đầu, để không báo lỗi khi người dùng còn đang gõ.
  const password = form.watch("password")
  useEffect(() => {
    if (form.formState.isSubmitted && form.getValues("confirmPassword")) void form.trigger("confirmPassword")
  }, [password, form])
```

- [ ] **Step 6: Chạy lại**

Run: `pnpm exec vitest run tests/unit/schemas/register-form-schema.test.ts tests/unit/components/RegisterForm.test.tsx`
Expected: PASS toàn bộ, gồm test cũ "sửa ô Mật khẩu cho khớp → lỗi biến mất, gửi được".

- [ ] **Step 7: tsc + lint + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/lib/schemas/auth.ts src/app/register/RegisterForm.tsx tests/unit/schemas/register-form-schema.test.ts tests/unit/components/RegisterForm.test.tsx
git commit -m "fix: đăng ký báo không khớp ngay lần bấm đầu, không báo sớm khi đang gõ"
```

---

### Task 6: Khung tóm tắt chính sách: chữ "mở tab mới" cho trình đọc màn hình + tiêu đề riêng ở /privacy

Lỗi 1: link "Đọc đầy đủ" mở tab mới nhưng trình đọc màn hình không báo.
Lỗi 2: `/privacy` (người đã có tài khoản cũng đọc) vẫn ghi "Trước khi đăng ký, bạn nên biết".

**Files:**
- Modify: `src/components/privacy/PrivacySummary.tsx`
- Modify: `src/language/vi.json`, `src/language/en.json`
- Test: `tests/unit/components/PrivacySummary.test.tsx`

**Interfaces:**
- i18n mới: `"opens_new_tab"`: vi `"(mở tab mới)"`, en `"(opens in a new tab)"`; `"privacy_summary_title_page"`: vi `"Tóm tắt nhanh"`, en `"Quick summary"`.
- `PrivacySummary` giữ prop `showFullLink`. Có `showFullLink` (trang đăng ký) → tiêu đề `privacy_summary_title`; không có (trang `/privacy`) → `privacy_summary_title_page`.

- [ ] **Step 1: Viết test đỏ** — trong `PrivacySummary.test.tsx`:
  - Test đầu "hiện tiêu đề + 4 ý…": đổi `viText.privacy_summary_title` thành `viText.privacy_summary_title_page` và thêm `expect(screen.queryByText(viText.privacy_summary_title)).toBeNull()`.
  - Thêm test:

```tsx
  it("showFullLink (trang đăng ký): tiêu đề Trước khi đăng ký, link có chữ ẩn báo mở tab mới", () => {
    renderVi(<PrivacySummary showFullLink />)
    expect(screen.getByText(viText.privacy_summary_title)).toBeTruthy()
    const link = screen.getByRole("link", { name: new RegExp(viText.privacy_read_full) })
    const hint = link.querySelector(".sr-only")
    expect(hint?.textContent).toBe(viText.opens_new_tab)
  })
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `pnpm exec vitest run tests/unit/components/PrivacySummary.test.tsx`
Expected: FAIL (thiếu key / tiêu đề cũ / không có `.sr-only`).

- [ ] **Step 3: Sửa** — `PrivacySummary.tsx`:
  - Dòng tiêu đề:

```tsx
        {/* Trang đăng ký có link Đọc đầy đủ; /privacy cho cả người đã có tài khoản nên không ghi "Trước khi đăng ký". */}
        {t(showFullLink ? "privacy_summary_title" : "privacy_summary_title_page")}
```

  - Trong thẻ `<a>`, sau `<ExternalLink … />` thêm `<span className="sr-only">{t("opens_new_tab")}</span>`.
  - Thêm 2 key vào `vi.json` và `en.json` (cạnh `"privacy_summary_title"`).

- [ ] **Step 4: Chạy lại test liên quan**

Run: `pnpm exec vitest run tests/unit/components/PrivacySummary.test.tsx tests/unit/components/PrivacyContent.test.tsx tests/unit/components/RegisterForm.test.tsx`
Expected: PASS. `PrivacyContent.test.tsx` nếu kỳ vọng tiêu đề cũ trên `/privacy` thì đổi sang `privacy_summary_title_page`, ghi `Ruling:`. Tìm e2e kỳ vọng chữ "Trước khi đăng ký" trên `/privacy`: `grep -rn "Trước khi đăng ký" tests/e2e`; có thì sửa theo hành vi mới, ghi `Ruling:`.

- [ ] **Step 5: tsc + lint + commit**

```bash
pnpm exec tsc --noEmit && pnpm lint
git add src/components/privacy/PrivacySummary.tsx src/language/vi.json src/language/en.json tests/unit/components/PrivacySummary.test.tsx
git commit -m "fix: tóm tắt chính sách báo mở tab mới cho trình đọc màn hình, tiêu đề riêng ở /privacy"
```

---

### Task 7: Version 0.11.1 + mục cập nhật + kiểm toàn bộ

**Files:**
- Modify: `package.json` (`"version": "0.11.1"`)
- Modify: `src/lib/releases.ts` (thêm mục đầu mảng `RELEASES`)

- [ ] **Step 1: Thêm mục** vào ĐẦU mảng `RELEASES` trong `src/lib/releases.ts` (đọc kiểu `Release` trong file trước; `notify: false` vì là bản sửa nhỏ):

```ts
  {
    version: "0.11.1",
    date: "2026-10-07",
    title: "Sửa lỗi nhỏ",
    summary: "Một số chỉnh sửa nhỏ ở Học phí, Sao lưu và trang Đăng ký.",
    notify: false,
    items: [
      { kind: "improve", title: "Miễn có ghi lý do", body: "Khi miễn phần còn thiếu, bạn có thể ghi lý do. Lý do được lưu vào ghi chú tháng đó.", guideId: "hoc-phi" },
      { kind: "fix", title: "Số tiền ghi rõ nợ cũ", body: "Học sinh còn nợ tháng trước mà tháng này không học vẫn thấy rõ số tiền là nợ tháng nào.", guideId: "hoc-phi" },
      { kind: "fix", title: "Mở đúng tháng", body: "Học phí, Lịch dạy và Báo cáo mở đúng tháng theo giờ Việt Nam, kể cả khi máy để múi giờ khác." },
      { kind: "fix", title: "File sao lưu", body: "Bỏ cột Hình thức trong sheet Lần thu vì ứng dụng không còn ghi hình thức thu." },
      { kind: "fix", title: "Trang đăng ký", body: "Báo mật khẩu nhập lại không khớp ngay lần bấm đầu, không báo khi bạn còn đang gõ." },
    ],
  },
```

Nếu `guideId` "hoc-phi" không có trong `guide-content.ts` (test của W canh) thì bỏ `guideId`, ghi `Ruling:`. Ngày `date`: Claude sửa thành ngày merge thật khi merge.

- [ ] **Step 2: Version** — `package.json` → `"version": "0.11.1"`.

- [ ] **Step 3: Kiểm toàn bộ**

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm test > .superpowers/sdd/2026-10-04-z-don-loi-nho/test.log 2>&1; tail -n 30 .superpowers/sdd/2026-10-04-z-don-loi-nho/test.log
```

Expected: tsc/lint sạch, vitest PASS toàn bộ (số test = trước Z + số test mới).

- [ ] **Step 4: e2e đủ 2 nửa** (RAM ≥ 3000 MB trước mỗi nửa, foreground, dọn đúng PID mình tạo sau mỗi nửa). Thêm file e2e mới của W vào nửa ít file hơn. Expected: tất cả PASS (skipped giữ như trước). Đỏ → đọc lỗi, sửa code (không nới test), chạy lại file đó rồi chạy lại nửa đó.

- [ ] **Step 5: Commit + báo cáo**

```bash
git add package.json src/lib/releases.ts
git commit -m "chore: v0.11.1 + mục cập nhật dọn lỗi nhỏ"
```

Ghi `.superpowers/gehihi/bao-cao-Z.md`: HEAD, số vitest, số e2e từng nửa, mọi `Ruling:`, test cũ nào đã sửa kỳ vọng và vì sao. Ghi kênh `DONE Z`.
