# A2 — Màn Quản lý môn học

> Phần A2 trong lộ trình ở `2026-09-25-a1-ui-mobile-first-design.md` mục 0. Phụ thuộc A1 (dùng `PageHeader`, kiểu thẻ, thanh tab đáy).

## 1. Bối cảnh

Người dùng: 1 giáo viên dạy kèm, dùng chủ yếu trên điện thoại. Backend `subject.*` (list / create / update / delete) đã có, nhưng chưa có màn nào để quản lý môn. Môn chỉ xuất hiện trong ô chọn môn khi tạo ca.

Ba chỗ vướng nếu chỉ làm UI trên backend hiện tại:

1. `subject.update` không nhận `isActive` → môn đã ẩn không bật lại được. Tài khoản mới có sẵn Vật Lý, Hóa Học ở trạng thái ẩn (`subject-defaults.ts`) nên hiện không dùng được.
2. `subject.delete` (ẩn mềm) bị chặn nếu môn đã từng có ca, kể cả ca cũ → gần như không ẩn được môn nào đã dạy.
3. Tạo môn trùng tên với môn đã ẩn → báo "Tên môn học đã tồn tại" dù môn đó không hiện ở đâu.

## 2. Mục tiêu và tiêu chí hoàn thành

Trên điện thoại (390px), giáo viên làm được:

- Thêm môn (tên + màu), đổi tên, đổi màu.
- Chọn môn mặc định (tự chọn sẵn khi tạo ca mới).
- Ẩn môn không dạy nữa, kể cả môn đã có ca; hiện lại môn đã ẩn.

Môn ẩn không có trong ô chọn môn khi tạo ca mới; ca cũ vẫn hiện đúng tên và màu môn.

## 3. Quyết định đã chốt

| # | Câu hỏi | Chốt |
|---|---|---|
| Q1 | Môn không dạy nữa | Chỉ **Ẩn / Hiện lại**. Không có xóa hẳn. |
| Q2 | Sắp xếp thứ tự môn | Không có UI sắp xếp. Môn mới xếp cuối. |
| Q3 | Chọn màu | Bảng 10 màu cố định, không có ô màu tự do. |
| Q4 | Đặt màn ở đâu | Trang riêng `/subjects`, vào từ menu avatar. Thanh tab đáy giữ 5 mục. |

## 4. Phạm vi

### Trong phạm vi
- Trang `/subjects` + mục "Môn học" trong menu avatar.
- Dialog thêm/sửa môn.
- Sửa backend `subject.update` / `subject.create` theo mục 6.
- `SessionFormDialog`: khi sửa ca có môn đã ẩn, ô chọn môn vẫn hiện môn đó.
- i18n vi/en cho mọi chuỗi mới.

### Ngoài phạm vi (YAGNI)
- Xóa hẳn môn, sắp xếp thứ tự, ô màu tự do, tìm kiếm/phân trang (danh sách < 10 môn).
- Đổi `subject.delete` (giữ nguyên để không phá hành vi cũ; UI mới không dùng nó).
- Migration DB: không cần, schema `Subject` đã đủ trường.

## 5. Giao diện

### 5.1 Lối vào
`AppHeader`: menu avatar thêm mục **"Môn học"** (icon `BookOpen`), đặt trên "Đổi mật khẩu", là link tới `/subjects`. Có ở cả mobile và desktop.

### 5.2 Trang `/subjects`
- `PageHeader`: tiêu đề "Môn học", mô tả ngắn "Màu môn hiện ở danh sách ca dạy", nút **"Thêm môn"** (`h-11 md:h-10`).
- Hai nhóm, mỗi nhóm có tiêu đề nhỏ:
  - **Đang dạy**: môn `isActive = true`.
  - **Đã ẩn**: môn `isActive = false`, chữ mờ hơn (`text-slate-500`). Nhóm này không hiện nếu rỗng.
- Thứ tự trong nhóm: như `subject.list` trả (`sortOrder`, rồi `id`).
- Mỗi môn là 1 thẻ (`rounded-lg border bg-white p-4`), cùng markup cho mobile và desktop (danh sách ngắn, không cần bảng):
  - Chấm màu `size-4 rounded-full`, tên môn (`truncate`), huy hiệu **"Mặc định"** nếu `isDefault`.
  - Nút ⋯ (`size-11 md:size-9`, `aria-label` = "Menu hành động") mở menu:
    - Môn đang dạy: **Sửa**, **Đặt làm mặc định** (ẩn nếu đã là mặc định), **Ẩn**.
    - Môn đã ẩn: **Sửa**, **Hiện lại**.
- Desktop: thẻ xếp lưới `md:grid-cols-2`, trang rộng tối đa `max-w-3xl`.
- Loading: 3 skeleton thẻ. Lỗi tải: dòng `load_error` + nút `retry` (giống `ResponsiveList`).

### 5.3 Dialog thêm / sửa
- Tiêu đề: "Thêm môn" / "Sửa môn".
- Ô **Tên môn** (bắt buộc, tối đa 100 ký tự, tự trim).
- **Màu**: 10 chấm tròn `size-11`, chấm đang chọn có viền `ring-2 ring-offset-2`; mỗi chấm là `button` có `aria-label` là mã màu và `aria-pressed`.
- Ô tick **"Môn mặc định khi tạo ca"** (chỉ hiện khi thêm môn hoặc sửa môn đang dạy).
- Nút **Lưu** (`w-full sm:w-auto`), **Hủy**.
- Lỗi từ server (trùng tên, …) hiện dưới ô Tên môn; lưu thành công → toast, đóng dialog.

Bảng 10 màu (gồm đủ 5 màu của môn mặc định, đều đậm đủ để thấy rõ trên nền trắng):

| Màu | Hex |
|---|---|
| Indigo | `#4F46E5` |
| Cyan | `#0891B2` |
| Emerald | `#059669` |
| Amber | `#D97706` |
| Red | `#DC2626` |
| Violet | `#7C3AED` |
| Pink | `#DB2777` |
| Blue | `#2563EB` |
| Lime | `#65A30D` |
| Slate | `#475569` |

Môn mới mặc định chọn màu đầu tiên chưa có môn nào dùng (nếu dùng hết thì màu đầu bảng). Môn cũ có màu ngoài bảng vẫn hiển thị đúng; khi sửa, không chấm nào được chọn cho tới khi người dùng chọn, và nếu không chọn thì giữ màu cũ.

### 5.4 Xác nhận khi ẩn
Bấm **Ẩn** → hộp xác nhận: "Ẩn môn {name}? Môn sẽ không hiện khi tạo ca mới. Các ca đã có vẫn giữ nguyên." Nút **Ẩn** / **Hủy**. **Hiện lại** không cần xác nhận.

### 5.5 Sửa ca có môn đã ẩn (`SessionFormDialog`)
Ô chọn môn đang lấy `subject.list({ isActive: true })`. Khi đang sửa ca mà `subjectId` không nằm trong danh sách đó, thêm môn của ca vào cuối danh sách với nhãn "{name} (đã ẩn)" để ô không bị trống. Tạo ca mới không đổi.

## 6. Backend

Không đổi schema, không migration.

### 6.1 `subjectUpdateSchema`
`data` nhận thêm `isActive?: boolean`.

### 6.2 `updateSubject` — quy tắc
Thêm kiểm tra trước khi ghi:

| Tình huống | Kết quả |
|---|---|
| `isActive: false` và môn đang là mặc định | `BAD_REQUEST` "Không thể ẩn môn mặc định. Hãy chọn môn mặc định khác trước." |
| `isActive: false` và không còn môn đang dạy nào khác | `BAD_REQUEST` "Không thể ẩn môn cuối cùng" |
| `isDefault: true` cho môn đang ẩn (và không kèm `isActive: true`) | `BAD_REQUEST` "Không thể đặt môn đã ẩn làm mặc định" |
| `isActive: false` cho môn đã có ca | **Cho phép** (khác `delete`) |

Ghi `isActive` vào `data` của `tx.subject.update` như các trường khác.

### 6.3 `createSubject`
- `sortOrder`: nếu input không truyền, dùng `max(sortOrder của user) + 1` (0 nếu chưa có môn). Hiện schema để mặc định `0` → môn mới nhảy lên đầu; đổi `sortOrder` trong `subjectCreateSchema` thành optional không default, service tự tính.
- Trùng tên (P2002): tra môn trùng tên của user; nếu môn đó `isActive = false` → `BAD_REQUEST` "Môn này đang bị ẩn. Hãy bấm Hiện lại trong danh sách môn đã ẩn."; nếu không → giữ "Tên môn học đã tồn tại".
- `updateSubject` trùng tên: giữ nguyên thông báo hiện tại.

### 6.4 Giữ nguyên
`subject.list`, `subject.delete` (vẫn chặn môn đang được dùng), `seedSubjectsForUser`.

## 7. i18n

Thêm vào cả `vi.json` và `en.json` (số key 2 file bằng nhau). Nhãn dự kiến:

| Key | vi | en |
|---|---|---|
| `subjects_page` | Môn học | Subjects |
| `subjects_desc` | Màu môn hiện ở danh sách ca dạy | Subject colors appear in the session list |
| `add_subject` | Thêm môn | Add subject |
| `edit_subject` | Sửa môn | Edit subject |
| `subject_name` | Tên môn | Subject name |
| `subject_color` | Màu | Color |
| `subject_default_hint` | Môn mặc định khi tạo ca | Default subject for new sessions |
| `subjects_active` | Đang dạy | Active |
| `subjects_hidden` | Đã ẩn | Hidden |
| `set_default` | Đặt làm mặc định | Set as default |
| `hide` | Ẩn | Hide |
| `unhide` | Hiện lại | Show again |
| `default_badge` | Mặc định | Default |
| `hide_subject_confirm` | Ẩn môn {name}? Môn sẽ không hiện khi tạo ca mới. Các ca đã có vẫn giữ nguyên. | Hide {name}? It won't appear when creating new sessions. Existing sessions stay unchanged. |
| `subject_saved` | Đã lưu môn học | Subject saved |
| `hidden_suffix` | (đã ẩn) | (hidden) |

Trước khi thêm, dò key sẵn có (`subject`, `edit`, `cancel`, `save`, …) để dùng lại, không tạo trùng. Chuỗi mới không dùng dấu gạch dài. Thông báo lỗi từ server giữ tiếng Việt như các service khác.

## 8. Kiểm thử

### Integration (`tests/integration/subject.test.ts`)
- Ẩn được môn đã có ca (`update isActive:false`), môn không còn trong `list({isActive:true})`, ca cũ vẫn trỏ đúng `subjectId`.
- Không ẩn được môn mặc định → `BAD_REQUEST`.
- Không ẩn được môn đang dạy cuối cùng → `BAD_REQUEST`.
- Hiện lại môn đã ẩn (`isActive:true`) → có lại trong list active.
- Không đặt môn đã ẩn làm mặc định → `BAD_REQUEST`.
- Môn mới tạo không truyền `sortOrder` → nằm cuối `list`.
- Tạo trùng tên với môn đã ẩn → thông báo "đang bị ẩn"; trùng tên môn đang dạy → "Tên môn học đã tồn tại".
- Các test cũ (kể cả `delete` môn đang dùng → `BAD_REQUEST`) vẫn pass.

### E2E (`tests/e2e/subjects.spec.ts`, 390×844)
Mở menu avatar → "Môn học" → thêm môn tên ngẫu nhiên, chọn màu → thấy thẻ → sửa đổi màu → Ẩn (xác nhận) → mở dialog tạo ca, ô chọn môn không có môn đó → quay lại Hiện lại → ô chọn môn có lại. Không để lại dữ liệu rác quá 1 môn (môn không xóa được, dùng tên ngẫu nhiên có tiền tố `E2E`).

### Chung
`pnpm lint`, `pnpm test`, `pnpm exec playwright test`, `pnpm exec next build` đều sạch. An toàn dữ liệu như A1: test chỉ chạy trên `.env.test`, không chạy `pnpm build` ở local.

## 9. Rủi ro

| Rủi ro | Xử lý |
|---|---|
| Ẩn nhầm môn đang dùng | Có hộp xác nhận; Hiện lại bằng 1 bấm; ca cũ không bị ảnh hưởng |
| E2E tạo môn không xóa được, tích tụ trên DB test | Tên có tiền tố `E2E` + số ngẫu nhiên; `tests/setup.ts` reset DB test mỗi lần `pnpm test` |
| Đổi `sortOrder` thành optional làm lệch chỗ đang truyền giá trị | Grep các chỗ gọi `subject.create` (seed dùng `upsert` trực tiếp, không qua schema) |
