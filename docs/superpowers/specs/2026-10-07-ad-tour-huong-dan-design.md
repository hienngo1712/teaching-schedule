# AD — Tour hướng dẫn "Chỉ cho tôi" (driver.js)

> Ngày: 2026-10-07 · Người yêu cầu: chủ ứng dụng · Phiên bản: **0.15.0** (minor, **không migration**, thêm thư viện `driver.js`, người dùng đã đồng ý).
> Hướng đã chọn: driver.js + danh sách tour khai báo bằng TypeScript. Tour chỉ chạy khi người dùng bấm "Chỉ cho tôi", không tự bật.

## 1. Mục tiêu

- Người mới làm được 6 việc đầu tiên mà không phải đọc hết `/guide`: app tô sáng đúng nút thật trên màn hình, chỉ từng bước.
- Bổ sung cho `/guide` (ảnh + chữ), thẻ **Bắt đầu** (`StartCard`) và **Có gì mới**, không thay thế.
- Chạy được trên điện thoại (390px) và máy tính (1280px).

Thành công khi: giáo viên bấm "Chỉ cho tôi" ở thẻ Bắt đầu → sang đúng trang → được dẫn qua các bước, kể cả bên trong hộp nhập, tới nút Lưu; tự làm từng thao tác, tour không tạo dữ liệu thay.

## 2. Vì sao chọn cách này

| Cách | Lý do |
|---|---|
| **driver.js** | ~5 KB gzip, không phụ thuộc, không gắn React (chạy với React 19), MIT. Tải động nên trang thường không nặng thêm. **Chọn.** |
| react-joyride | Nặng hơn nhiều, từng lỗi tương thích React 19. **Bỏ.** |
| Tự viết khung tô sáng | Phải tự lo vị trí, cuộn, đổi cỡ màn. **Bỏ.** |
| Tour chào mừng tự chạy lần đầu | Chồng với Có gì mới / Góp ý, phải xử lý chuyển trang giữa tour, người dùng hay bỏ qua. **Ngoài phạm vi** (người dùng chọn "Chỉ cho tôi" theo từng việc). |

## 3. Phạm vi: 6 tour

Ký hiệu 👆 = bước **chờ người dùng tự bấm** phần tử được tô sáng (không có nút Tiếp). Tên trong ngoặc là giá trị `data-tour`.

| id | Trang | Các bước |
|---|---|---|
| `student` | `/students` | 👆 nút **Thêm học sinh** (`student-add`) → hộp mở · Họ tên + Lớp (`student-form-basic`) · Phụ huynh, không bắt buộc (`student-form-parent`) · **Cách thu học phí** (`student-form-billing`) · ô đồng ý + nút **Thêm** (`student-form-submit`) |
| `import` | `/students` | 👆 nút ▾ cạnh Thêm học sinh (`student-add-more`) · 👆 mục **Nhập Excel** (`student-import-item`) → hộp mở · **Tải file mẫu** (`import-template`) · nút **Chọn file**, nội dung nói thêm "chọn file xong app hiện bảng xem trước, dòng lỗi tô đỏ; tick đồng ý rồi bấm nhập" (`import-file`) · khối **Google Form** (`import-google-form`). Bảng xem trước và nút nhập chỉ có sau khi chọn file thật nên không tô sáng. Gói chưa có tính năng nhập: bấm mục sẽ mở hộp nâng cấp, bước sau không thấy phần tử nên tour dừng theo §4.2. |
| `session` | `/calendar` | 👆 **+ Tạo ca dạy** (`session-add`) → hộp mở · Ngày + Môn (`session-form-date`) · Giờ bắt đầu/kết thúc (`session-form-time`) · Học sinh trong ca (`session-form-students`) · nút Tạo ca dạy (`session-form-submit`), nội dung nhắc "muốn ca lặp hằng tuần dùng nút **Lịch lặp**" (hộp Lịch lặp là luồng riêng, không tô sáng) |
| `attendance` | `/calendar` | 👆 một ca trên lịch (`session-card`, phần tử hiện đầu tiên) → hộp chi tiết mở · dấu tích / dấu X (`attendance-marks`) · **Tất cả có mặt** (`attendance-all-present`) · **Lưu điểm danh** (`attendance-save`) · mũi tên sang ca kế (`session-nav`) |
| `tuition` | `/tuition` | ô đổi tháng, "app mở sẵn tháng vừa học xong" (`tuition-month`) · dòng học sinh đầu: số cần đóng (`tuition-row`) · **Đã đóng đủ** (`tuition-pay-full`) · **Phiếu báo** (`tuition-notice`) · 👆 bấm vào học sinh (`tuition-row`) → sheet mở · **Đóng một phần** (`tuition-pay-partial`) |
| `bank` | `/settings` | ô tìm ngân hàng (`bank-select`) · số tài khoản (`bank-number`) · tên chủ tài khoản (`bank-name`) · ô đồng ý + nút Lưu (`bank-submit`) |

- Giá trị `data-tour` ở bảng là **đề xuất**; plan chốt tên cuối sau khi đọc component thật. Một bước có thể gộp nhiều ô vào 1 vùng bao quanh nếu không có phần tử chung.
- Bước có phần tử chỉ hiện theo dữ liệu (vd **Đã đóng đủ** chỉ có khi tháng đã học xong và còn nợ; dòng học sinh khi tháng có học phí; ca trên lịch) không tìm thấy thì bị bỏ qua theo quy tắc 3 giây ở §4.2.
- Không làm tour cho Môn học và các mục còn lại của `/guide` (bản sau).

### 3.1 Thiếu dữ liệu trước
Dùng `trpc.onboarding.status` (đã có, trả `steps.student`, `steps.session`):
- `attendance` khi `steps.session = false` → tour 1 bước giữa màn: "Chưa có ca dạy nào. Tạo ca trước nhé." + nút **Chỉ cách tạo ca** (chạy tour `session`).
- `tuition` khi `steps.student = false` → "Chưa có học sinh nào. Thêm học sinh trước nhé." + nút **Chỉ cách thêm học sinh** (chạy tour `student`).
- Các tour khác không cần dữ liệu trước.

## 4. Kiến trúc

### 4.1 Danh sách tour — `src/lib/tours.ts`
```ts
export type TourId = "student" | "import" | "session" | "attendance" | "tuition" | "bank"
export type TourStep = {
  target: string | null        // giá trị data-tour; null = khung giữa màn, không tô sáng
  titleKey: keyof typeof vi    // i18n
  bodyKey: keyof typeof vi
  advanceOn?: "next" | "click" // mặc định "next"; "click" = chờ người dùng bấm target
}
export type Tour = { id: TourId; href: string; steps: TourStep[]; requires?: "student" | "session" }
export const TOURS: Record<TourId, Tour>
export const TOUR_PARAM = "tour"
export function tourHref(id: TourId): string   // vd "/students?tour=student"
export function parseTourParam(v: string | null): TourId | null
```
Thuần dữ liệu + hàm thuần, không import driver.js (test unit dễ).

### 4.2 Bộ chạy — `src/components/tour/TourRunner.tsx`
- Đặt trong `AppLayout` (khu giáo viên). Admin không có (admin bị chuyển khỏi khu giáo viên sẵn).
- Đọc `?tour=` bằng `useSearchParams`; hợp lệ thì **xoá tham số khỏi URL** (`router.replace`, giữ các tham số khác) rồi chạy. Không hợp lệ thì chỉ xoá.
- `import("driver.js")` + CSS **động**, chỉ khi có tour.
- **Tìm phần tử:** `target` → phần tử **đang hiển thị** đầu tiên khớp `[data-tour="<target>"]` (bỏ phần tử `display:none` / kích thước 0, vì mobile và desktop có thể cùng gắn 1 giá trị cho 2 nút khác nhau). Chờ tối đa **3 giây** (polling ngắn hoặc MutationObserver); không thấy thì **bỏ qua bước** đó; hết bước thì kết thúc.
- **Bước 👆 (`advanceOn: "click"`):** popover không có nút Tiếp, có dòng "Bấm vào nút được tô sáng". Gắn listener `click` một lần lên phần tử; bấm xong thì chờ phần tử của bước sau xuất hiện rồi `moveNext`. Phần tử được tô sáng phải bấm được (driver.js `disableActiveInteraction: false`).
- **Dừng tour:** bấm X, Esc, chuyển trang (đổi `pathname`), hoặc hộp chứa bước hiện tại bị đóng (phần tử target biến mất khỏi DOM khi đang ở bước trong hộp) → `destroy()` sạch, không để lại lớp phủ.
- **Không chồng popup:**
  - Có `[role="dialog"][data-state="open"]` đang mở lúc bắt đầu (vd Có gì mới, Góp ý) → không chạy tour, toast "Đóng hộp đang mở rồi bấm Chỉ cho tôi lại nhé".
  - Trong lúc tour chạy, `WhatsNew` không tự bật: dùng trạng thái chung `useTourActive()` (module store nhỏ, `useSyncExternalStore`). Bị chặn vì tour thì Có gì mới tự mở sau khi tour tắt. `FeedbackPrompt` chỉ gắn ở `/dashboard`, không tour nào chạy ở đó nên không cần sửa.
- **Bước 👆 không tìm thấy phần tử** (vd tháng đang xem chưa có ca nào để bấm): không đi tiếp được nên tắt tour, toast "Không tìm thấy mục cần chỉ trên trang này". Bước thường không thấy thì bỏ qua như trên.

### 4.3 Hộp Radix (rủi ro chính, thử trước)
Dialog/Sheet/DropdownMenu của Radix chặn tương tác ngoài nội dung (focus trap, `pointer-events` trên body, coi bấm ngoài là "bấm ra ngoài" → đóng hộp). Popover của driver.js mặc định gắn vào `body`, nằm ngoài hộp.
- **Task đầu của plan là thử nghiệm (spike):** chạy tour `student` vào trong hộp Thêm học sinh; kiểm bấm Tiếp / Quay lại trên popover **không đóng hộp**, nút bấm được, Tab không kẹt.
- Cách gỡ được phép thử (theo thứ tự): chặn `onPointerDownOutside` / `onInteractOutside` của hộp khi sự kiện đến từ `.driver-popover`; đặt `pointer-events: auto` cho popover; dời popover vào trong nội dung hộp qua hook `onPopoverRender`.
- **Không gỡ được:** các bước bên trong hộp đổi thành "chỉ tới cửa" — tour dừng ở bước 👆 mở hộp với lời nhắc "Điền các ô trong hộp, xem hướng dẫn chi tiết ở trang Hướng dẫn". Ghi Ruling, không cần hỏi lại người dùng.

### 4.4 Nút "Chỉ cho tôi" — `src/components/tour/TourButton.tsx`
- `Link` tới `tourHref(id)`, icon `MousePointerClick`, chữ "Chỉ cho tôi", `min-h-11 md:min-h-9`.
- Đang ở đúng trang rồi (vd bấm lại khi đã ở `/students`) vẫn chạy được: `TourRunner` phản ứng khi tham số `tour` đổi.
- **Thẻ Bắt đầu:** thêm nút cạnh link "Hướng dẫn" ở 5 bước (`student`, `session`, `attendance`, `tuition`, `bank`).
- **`/guide`:** thêm nút ở đầu 6 mục `hoc-sinh` → `student`, `nhap-excel` → `import`, `lich-day` → `session`, `diem-danh` → `attendance`, `hoc-phi` → `tuition`, `tai-khoan-ngan-hang` → `bank`. Mở ở tab hiện tại.
  - `/guide` công khai. `page.tsx` gọi `auth()` và truyền `canTour` (= có phiên, không phải admin, không bị bắt đổi mật khẩu) xuống `GuideContent`. Không có phiên thì không hiện nút.
  - Bản in và file Word (`guide-docx.ts`) không có nút.

## 5. Giao diện popover
- Màu A3: nút chính `primary` (teal), nền trắng, chữ slate-900/600, bo 10px. Không indigo/violet/purple.
- Bộ đếm "2/5", nút **Quay lại** / **Tiếp** / **Xong**, nút đóng X. Vùng chạm nút ≥ 44px trên mobile.
- Nền ngoài vùng tô sáng mờ 50% (`overlayOpacity: 0.5`), vùng tô sáng bo góc, cách mép 4px.
- Mobile: popover tự đặt trên/dưới phần tử, rộng tối đa `calc(100vw - 32px)`, không tràn ngang ở 375px.
- Nội dung: tiêu đề ngắn + tối đa 2 câu. Mọi chữ qua i18n `vi.json` + `en.json`, không dùng gạch dài (—, –).
- Tour **không tự điền, không tự bấm Lưu**.

## 6. Kiểm thử
- **Unit `tours.ts`:** 6 tour đủ id; `href` đúng; mỗi `titleKey`/`bodyKey` có ở cả vi và en; `parseTourParam` nhận đúng id, từ chối giá trị lạ; `tourHref`.
- **Test canh `data-tour`:** mọi `target` khác null trong `TOURS` phải xuất hiện dưới dạng `data-tour="<target>"` trong `src/**/*.tsx` (đọc file bằng `fs`), để đổi giao diện không làm gãy tour mà không ai biết.
- **Unit `TourRunner`** (mock driver.js): đọc và xoá `?tour=`; bỏ qua bước thiếu phần tử sau 3 giây (fake timers); không chạy khi đang có dialog mở; thiếu dữ liệu thì hiện bước báo + nút chuyển tour; `useTourActive` bật/tắt đúng.
- **Component:** `StartCard` có 5 nút "Chỉ cho tôi" đúng href; `GuideContent` có 6 nút khi `canTour`, không có khi `!canTour`; `WhatsNew` không tự bật khi tour đang chạy.
- **e2e** (`tests/e2e/ad-tour.spec.ts`, 390px và 1280px):
  - tour `student`: từ thẻ Bắt đầu → `/students` → bước 👆 → hộp mở → bấm Tiếp qua các bước trong hộp, **hộp vẫn mở**, tới bước nút Thêm; không tràn ngang;
  - tour `attendance` với tài khoản chưa có ca → bước báo → bấm "Chỉ cách tạo ca" → tour `session` chạy;
  - Esc tắt tour, không còn `.driver-overlay`;
  - `/guide` không đăng nhập không có nút "Chỉ cho tôi".
- `RELEASES` 0.15.0 (notify: true, item trỏ `guideId: "bat-dau"`), `package.json` 0.15.0.

## 7. Ngoài phạm vi
- Tour chào mừng tự chạy, tour cho Môn học, Báo cáo, Thùng rác, Sao lưu, Gói dịch vụ.
- Lưu ai đã xem tour (không cần: tour chỉ chạy khi bấm), không thêm cột DB.
- Tour trong khu admin.
