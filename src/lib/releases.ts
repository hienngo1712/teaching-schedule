export type ReleaseKind = "new" | "improve" | "fix"
export type ReleaseItem = { kind: ReleaseKind; title: string; body: string; guideId?: string }
export type Release = {
  version: string
  date: string // YYYY-MM-DD
  title: string
  summary: string
  // true = có thay đổi người dùng thấy → ô "Có gì mới" tự mở; bản sửa nhỏ để false, chỉ hiện ở /updates.
  notify: boolean
  items: ReleaseItem[]
}

// Mới nhất đầu tiên. Mỗi lần nâng version (kể cả patch) phải thêm 1 mục (test releases.test.ts canh).
export const RELEASES: Release[] = [
  {
    version: "0.11.5",
    date: "2026-10-05",
    title: "Gói của tôi gọn hơn",
    summary: "Đầu trang Gói của tôi hiện rõ gói đang dùng, hạn dùng và số học sinh.",
    notify: false,
    items: [
      { kind: "improve", title: "Gói hiện tại ở đầu trang", body: "Gói đang dùng, hạn dùng và số học sinh đang học hiện nổi bật ở đầu trang, thẻ gói bớt chữ.", guideId: "goi-dich-vu" },
    ],
  },
  {
    version: "0.11.4",
    date: "2026-10-05",
    title: "Ô Có gì mới gọn hơn",
    summary: "Ô Có gì mới nhỏ gọn, chỉ hiện 3 thay đổi chính.",
    notify: false,
    items: [
      { kind: "improve", title: "Ô Có gì mới gọn hơn", body: "Ô nhỏ lại, hiện 3 thay đổi chính. Bấm Tìm hiểu thêm để xem đủ." },
    ],
  },
  {
    version: "0.11.3",
    date: "2026-10-05",
    title: "Sửa hướng dẫn",
    summary: "Sửa mẹo về dùng thử gói Pro trong trang hướng dẫn cho đúng thực tế.",
    notify: false,
    items: [
      { kind: "fix", title: "Mẹo dùng thử", body: "Tài khoản mới dùng gói Standard; quản trị viên có thể cho dùng thử Pro một số ngày.", guideId: "bat-dau" },
    ],
  },
  {
    version: "0.11.2",
    date: "2026-10-05",
    title: "Tải bản Word",
    summary: "Sửa nút Tải Word ở trang hướng dẫn và thêm tải Word cho trang các bản cập nhật.",
    notify: false,
    items: [
      { kind: "fix", title: "Nút Tải Word", body: "Nút Tải Word (.docx) ở trang hướng dẫn đã tải được file.", guideId: "bat-dau" },
      { kind: "improve", title: "Các bản cập nhật bản Word", body: "Trang các bản cập nhật cũng có nút Tải Word thay cho in PDF." },
    ],
  },
  {
    version: "0.11.1",
    date: "2026-10-05",
    title: "Sửa lỗi nhỏ",
    summary: "Một số chỉnh sửa nhỏ ở Học phí, Sao lưu và trang Đăng ký.",
    notify: false,
    items: [
      { kind: "improve", title: "HD sử dụng ở thanh bên", body: "Hướng dẫn chuyển ra mục HD sử dụng ở thanh bên (điện thoại: tab Thêm).", guideId: "bat-dau" },
      { kind: "improve", title: "Tải hướng dẫn bản Word", body: "Trang hướng dẫn có nút Tải Word (.docx) để mở bằng Word, không cần in.", guideId: "bat-dau" },
      { kind: "improve", title: "Miễn có ghi lý do", body: "Khi miễn phần còn thiếu, bạn có thể ghi lý do. Lý do được lưu vào ghi chú tháng đó.", guideId: "hoc-phi" },
      { kind: "fix", title: "Số tiền ghi rõ nợ cũ", body: "Học sinh còn nợ tháng trước mà tháng này không học vẫn thấy rõ số tiền là nợ tháng nào.", guideId: "hoc-phi" },
      { kind: "fix", title: "Mở đúng tháng", body: "Học phí, Lịch dạy và Báo cáo mở đúng tháng theo giờ Việt Nam, kể cả khi máy để múi giờ khác." },
      { kind: "fix", title: "File sao lưu", body: "Bỏ cột Hình thức trong sheet Lần thu vì ứng dụng không còn ghi hình thức thu." },
      { kind: "fix", title: "Trang đăng ký", body: "Báo mật khẩu nhập lại không khớp ngay lần bấm đầu, không báo khi bạn còn đang gõ." },
    ],
  },
  {
    version: "0.11.0",
    date: "2026-10-04",
    title: "Hướng dẫn sử dụng và thông báo bản mới",
    summary: "Có trang hướng dẫn đầy đủ, thẻ Bắt đầu cho người mới, và ô này để bạn biết mỗi bản có gì.",
    notify: true,
    items: [
      { kind: "new", title: "Hướng dẫn sử dụng", body: "Mở mục HD sử dụng ở thanh bên (điện thoại: tab Thêm). Có nút Tải Word để lưu hoặc gửi cho đồng nghiệp.", guideId: "bat-dau" },
      { kind: "new", title: "Thẻ Bắt đầu trên Tổng quan", body: "5 bước làm quen, tự đánh dấu khi bạn làm xong, có thể ẩn đi.", guideId: "bat-dau" },
      { kind: "new", title: "Có gì mới", body: "Mỗi bản có tính năng mới, ô này tự mở 1 lần. Bấm nút Có gì mới để xem lại." },
      // Ô chỉ hiện bản notify mới nhất → nhắc lại thay đổi lớn của 0.10.0 để giáo viên chưa từng thấy ô vẫn biết.
      { kind: "improve", title: "Thu học phí 1 chạm", body: "Học phí mở sẵn tháng trước. Bấm Đã đóng đủ là xong; đóng thiếu thì bấm Đóng một phần, tiền tự trừ vào tháng cũ nhất trước.", guideId: "hoc-phi" },
      { kind: "improve", title: "Dữ liệu cá nhân được mã hoá", body: "Họ tên, số điện thoại, số tài khoản trong cơ sở dữ liệu đã được mã hoá toàn bộ.", guideId: "bao-mat" },
    ],
  },
  {
    version: "0.10.0",
    date: "2026-10-04",
    title: "Thu học phí nhanh hơn",
    summary: "Ghi tiền 1 chạm, tự trừ tháng cũ trước, số tiền tách rõ theo tháng; trang phụ huynh 2 cột trên máy tính.",
    notify: true,
    items: [
      { kind: "improve", title: "Mở sẵn tháng trước", body: "Màn Học phí mở sẵn tháng vừa học xong, đúng lúc thu tiền.", guideId: "hoc-phi" },
      { kind: "new", title: "Đã đóng đủ 1 chạm", body: "Bấm Đã đóng đủ trên dòng học sinh là ghi xong; bấm Hoàn tác nếu lỡ tay.", guideId: "hoc-phi" },
      { kind: "new", title: "Đóng một phần", body: "Nhập số tiền phụ huynh đưa, app tự trừ vào tháng cũ nhất trước và cho xem trước sẽ trừ tháng nào.", guideId: "hoc-phi" },
      { kind: "improve", title: "Tiền tách theo tháng", body: "Mọi chỗ hiện số còn thiếu đều ghi rõ bao nhiêu là tháng trước, bao nhiêu là tháng này. Tháng đang học chỉ tạm tính.", guideId: "hoc-phi" },
      { kind: "improve", title: "Nhắc phiếu báo quá hạn", body: "Phiếu đã gửi từ 7 ngày mà chưa đóng tiền sẽ có nhãn màu cam để bạn nhắc phụ huynh.", guideId: "hoc-phi" },
      { kind: "improve", title: "Trang phụ huynh 2 cột", body: "Trên máy tính, phụ huynh thấy điểm danh và phiếu học phí có mã QR trong 1 màn hình." },
    ],
  },
  {
    version: "0.9.5",
    date: "2026-10-03",
    title: "Đăng ký rõ ràng hơn",
    summary: "Tóm tắt chính sách bảo mật ngay khi đăng ký, thêm ô nhập lại mật khẩu.",
    notify: false,
    items: [
      { kind: "improve", title: "Tóm tắt chính sách bảo mật", body: "Trang Đăng ký hiện 4 ý chính trước khi bạn tick đồng ý.", guideId: "bao-mat" },
      { kind: "improve", title: "Nhập lại mật khẩu khi đăng ký", body: "Gõ mật khẩu 2 lần để tránh gõ nhầm.", guideId: "bat-dau" },
    ],
  },
]

export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number)
  const pb = b.split(".").map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

export function latestNotifyRelease(): Release | undefined {
  return RELEASES.find((r) => r.notify)
}

export function hasUnseenRelease(lastSeen: string | null): boolean {
  const latest = latestNotifyRelease()
  if (!latest) return false
  return lastSeen === null || compareVersions(latest.version, lastSeen) > 0
}

export function isKnownRelease(version: string): boolean {
  return RELEASES.some((r) => r.version === version)
}

export function shortVersion(version: string): string {
  return "v" + version.split(".").slice(0, 2).join(".")
}

export function formatReleaseDate(date: string): string {
  return date.split("-").reverse().join("/")
}
