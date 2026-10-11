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
    // Tính năng của quản trị viên (spec AQ §7): giáo viên không thấy thay đổi nên không tự mở ô Có gì mới.
    version: "0.25.0",
    date: "2026-10-11",
    title: "Quản trị: xoá vĩnh viễn tài khoản",
    summary: "Quản trị viên xoá vĩnh viễn được tài khoản đã nằm trong Đã xoá từ 30 ngày, dữ liệu dạy học và thông tin cá nhân bị xoá hẳn.",
    notify: false,
    items: [
      { kind: "new", title: "Xoá vĩnh viễn tài khoản (quản trị)", body: "Ở Tài khoản & gói, tab Đã xoá, tài khoản đã xoá từ 30 ngày có nút Xoá vĩnh viễn. Gõ đúng tên đăng nhập để xác nhận. Học sinh, lịch, học phí, nơi dạy, khoá payOS bị xoá hẳn; đơn mua gói giữ lại trong Doanh thu với tên TK đã xoá." },
    ],
  },
  {
    version: "0.24.0",
    date: "2026-10-11",
    title: "Hướng dẫn cho Nơi dạy, Bảng công, Chuyên cần",
    summary: "Hướng dẫn sử dụng có thêm mục cho Nơi dạy, Bảng công và Thu nhập, Phiếu báo nơi dạy, Chuyên cần; thêm nút Chỉ cho tôi cho Nơi dạy và Thu nhập.",
    notify: true,
    items: [
      { kind: "new", title: "Hướng dẫn Nơi dạy", body: "Cách khai báo nơi dạy, chọn tính tiền theo học sinh hay theo ca/giờ, có ảnh từng bước.", guideId: "noi-day" },
      { kind: "new", title: "Hướng dẫn Bảng công, Thu nhập và Phiếu báo", body: "Đặt đơn giá, đối chiếu số ca với trung tâm, ghi nhận tiền đã nhận và gửi phiếu báo kèm mã QR.", guideId: "bang-cong" },
      { kind: "new", title: "Hướng dẫn Chuyên cần", body: "Xem tỉ lệ đi học theo tháng và theo năm học, lọc theo nơi dạy, lớp.", guideId: "chuyen-can" },
      { kind: "improve", title: "Chỉ cho tôi: Nơi dạy và Thu nhập", body: "Bấm Chỉ cho tôi ở trang Hướng dẫn để app chỉ từng bước thêm nơi dạy và xem thu nhập.", guideId: "noi-day" },
      { kind: "improve", title: "Ảnh hướng dẫn mới", body: "Toàn bộ ảnh và file Word hướng dẫn được chụp lại theo giao diện hiện tại." },
    ],
  },
  {
    version: "0.23.0",
    date: "2026-10-11",
    title: "payOS cho phiếu nơi dạy",
    summary: "Gói Pro đã nối payOS: phiếu báo nơi dạy có QR payOS, tiền vào là app tự ghi Đã nhận và chuông báo ngay.",
    notify: true,
    items: [
      { kind: "new", title: "QR payOS trên phiếu nơi dạy", body: "Khi đã nối payOS ở Cài đặt, phiếu báo của nơi dạy dùng QR payOS. Trang xem phiếu của người trả có thêm nút Mở trang thanh toán." },
      { kind: "new", title: "Tự ghi Đã nhận", body: "Nơi dạy quét QR chuyển tiền xong, Thu nhập tháng đó tự ghi Đã nhận, không cần nhập tay." },
      { kind: "improve", title: "Chuông báo tiền có tiền nơi dạy", body: "Chuông hiện cả khoản nơi dạy trả qua payOS. Bấm vào mở đúng tháng và nơi dạy trong Thu nhập." },
    ],
  },
  {
    version: "0.22.0",
    date: "2026-10-11",
    title: "Phiếu báo cho nơi dạy và Chuyên cần",
    summary: "Gửi phiếu báo kèm mã QR cho nơi trả theo ca/giờ, xem chuyên cần theo tháng và năm học, biểu đồ thu nhập 12 tháng.",
    notify: true,
    items: [
      { kind: "new", title: "Phiếu báo theo nơi dạy", body: "Ở Thu nhập, mở Phiếu báo của từng nơi: số ca, số giờ, thành tiền, mã QR chuyển khoản. Sao chép link gửi cho nơi dạy hoặc tải ảnh phiếu." },
      { kind: "new", title: "Trang xem phiếu cho người trả", body: "Link phiếu mở được không cần đăng nhập, chỉ có ngày giờ ca dạy và số học sinh có mặt, không có tên học sinh." },
      { kind: "new", title: "Chuyên cần", body: "Tỉ lệ đi học của từng học sinh theo tháng; gói Pro xem cả năm học (tháng 9 đến tháng 5) và lọc theo lớp." },
      { kind: "improve", title: "Thu nhập 12 tháng và lọc Báo cáo theo nơi học", body: "Gói Pro có biểu đồ học phí đã thu và tiền nơi dạy đã trả 12 tháng gần nhất. Báo cáo lọc được theo nơi học." },
    ],
  },
  {
    version: "0.21.0",
    date: "2026-10-11",
    title: "Bảng công và thu nhập theo nơi dạy",
    summary: "Nơi trả theo ca/giờ có Bảng công (số ca, số giờ), Thu nhập dự kiến theo đơn giá và ghi nhận tiền đã nhận.",
    notify: true,
    items: [
      { kind: "new", title: "Bảng công", body: "Số ca, số giờ đã dạy từng tháng ở mỗi nơi trả theo ca/giờ (gồm ca bù, không tính ca huỷ); xuất Excel hoặc tải ảnh để đối chiếu với trung tâm." },
      { kind: "new", title: "Thu nhập theo nơi dạy", body: "Nhập đơn giá theo ca hoặc theo giờ ở Nơi dạy để xem thu nhập dự kiến mỗi tháng; Tổng quan có thẻ Thu nhập và Giờ dạy." },
      { kind: "new", title: "Đã nhận tiền", body: "Ghi lại từng lần nơi dạy trả tiền, xem còn thiếu bao nhiêu; Cần chú ý nhắc nơi còn thiếu tiền tháng trước." },
    ],
  },
  {
    version: "0.20.0",
    date: "2026-10-11",
    title: "Dạy nhiều nơi",
    summary: "Thêm Nơi dạy: lớp tại nhà, gia sư, trung tâm. Gói Standard 20 học sinh, Plus 50 học sinh.",
    notify: true,
    items: [
      { kind: "new", title: "Nơi dạy", body: "Quản lý riêng lớp tại nhà, gia sư và từng trung tâm; học sinh và ca dạy gắn nơi, lịch có bộ lọc theo nơi." },
      { kind: "new", title: "Học sinh ở trung tâm", body: "Nơi tính tiền theo ca/giờ (trung tâm trả) thì học sinh ở đó không tính học phí, không vào trang Học phí." },
      { kind: "improve", title: "Gói rộng hơn", body: "Gói Standard nâng lên 20 học sinh đang học, Plus lên 50 học sinh đang học." },
    ],
  },
  {
    version: "0.19.0",
    date: "2026-10-11",
    title: "Bộ lọc gọn, thẻ Còn nợ rõ hơn",
    summary: "Thanh lọc gọn trên mọi màn và thẻ Còn nợ tách nợ tháng này với nợ cũ.",
    notify: true,
    items: [
      { kind: "improve", title: "Thanh lọc gọn hơn", body: "Lọc ít dùng nằm trong nút Bộ lọc; đang lọc gì hiện thành chip ngay dưới thanh, bấm ✕ để bỏ." },
      { kind: "improve", title: "Thẻ Còn nợ", body: "Thẻ Còn nợ ghi riêng nợ tháng này và các tháng trước." },
    ],
  },
  {
    version: "0.18.0",
    date: "2026-10-09",
    title: "Chuông báo tiền payOS",
    summary: "Chuông báo khi phụ huynh chuyển tiền qua payOS, không cần tải lại trang.",
    notify: true,
    items: [
      { kind: "new", title: "Chuông tiền học", body: "Chuông trên cùng báo ngay khoản phụ huynh vừa chuyển qua payOS và của học sinh nào; bấm một dòng để mở học sinh đó.", guideId: "payos-hoc-phi" },
    ],
  },
  {
    version: "0.17.0",
    date: "2026-10-09",
    title: "Tự đánh dấu học phí bằng payOS",
    summary: "Giáo viên gói Pro nối payOS: phụ huynh quét QR trên phiếu, tiền vào app tự đánh dấu đã đóng.",
    notify: true,
    items: [
      { kind: "new", title: "Tự đánh dấu học phí", body: "Nối payOS trong Cài đặt: phiếu báo có QR payOS đúng số đang nợ, phụ huynh chuyển xong là app tự ghi khoản thu và đánh dấu Đã đóng đủ.", guideId: "payos-hoc-phi" },
      { kind: "new", title: "PH đã chuyển", body: "Danh sách học phí hiện ngay số tiền và giờ phụ huynh đã chuyển qua payOS." },
    ],
  },
  {
    version: "0.16.0",
    date: "2026-10-09",
    title: "Mua gói kích hoạt ngay",
    summary: "Chọn thanh toán qua payOS để gói bật ngay khi tiền vào, và liên hệ chủ app ngay trong ứng dụng.",
    notify: true,
    items: [
      { kind: "new", title: "Kích hoạt ngay", body: "Khi mua gói, chọn Kích hoạt ngay sau khi chuyển khoản: quét QR payOS, gói bật trong vài giây, không phải chờ duyệt." },
      { kind: "new", title: "Liên hệ chủ app", body: "Gọi, nhắn Zalo hoặc Facebook cho chủ app ngay ở trang Gói, Quyền riêng tư và Hướng dẫn." },
    ],
  },
  {
    version: "0.15.2",
    date: "2026-10-08",
    title: "Sửa lỗi nhỏ",
    summary: "Chỉ cho tôi: ở bước Sang ca khác, phím mũi tên đổi ca như bình thường.",
    notify: false,
    items: [
      { kind: "fix", title: "Chỉ cho tôi", body: "Bước Sang ca khác: bấm nút mũi tên hoặc phím ← → đều đổi ca, hướng dẫn vẫn đứng ở bước đó." },
      { kind: "fix", title: "Chỉ cho tôi", body: "Hộp hướng dẫn tự dời theo khi hộp chi tiết ca trượt vào hoặc đổi kích thước, không còn che nút." },
    ],
  },
  {
    version: "0.15.1",
    date: "2026-10-08",
    title: "Sửa lỗi nhỏ",
    summary: "Sửa một số lỗi nhỏ ở lịch, học phí, hướng dẫn và nút Chỉ cho tôi.",
    notify: false,
    items: [
      { kind: "fix", title: "Lịch", body: "Ô hôm nay luôn đúng theo giờ Việt Nam." },
      { kind: "fix", title: "Thẻ Bắt đầu", body: "Trên điện thoại tên từng bước hiện đủ, nút xuống dòng riêng." },
      { kind: "fix", title: "Học phí", body: "Miễn có lý do giữ nguyên ghi chú cũ và không lưu trùng khi đóng." },
      { kind: "fix", title: "Chỉ cho tôi", body: "Đi bằng phím mũi tên, hộp chi tiết ca cuộn được, không nhảy bước khi bấm nút trong dòng học phí." },
      { kind: "improve", title: "Hướng dẫn", body: "Ảnh hướng dẫn chụp lại theo giao diện mới; tài khoản quản trị mở được Hướng dẫn từ menu." },
    ],
  },
  {
    version: "0.15.0",
    date: "2026-10-07",
    title: "Nút Chỉ cho tôi",
    summary: "App chỉ từng bước ngay trên màn hình cho 6 việc đầu tiên: thêm học sinh, nhập Excel, tạo ca, điểm danh, thu học phí, tài khoản ngân hàng.",
    notify: true,
    items: [
      { kind: "new", title: "Chỉ cho tôi", body: "Bấm Chỉ cho tôi ở thẻ Bắt đầu hoặc trang Hướng dẫn, app tô sáng đúng nút cần bấm và hướng dẫn từng bước.", guideId: "bat-dau" },
    ],
  },
  {
    version: "0.14.1",
    date: "2026-10-07",
    title: "Tạm gỡ khung nhắn tin hỗ trợ",
    summary: "Khung nhắn tin với hỗ trợ được tạm gỡ để hoàn thiện thêm, sẽ quay lại ở bản sau.",
    notify: false,
    items: [
      { kind: "fix", title: "Tạm gỡ nhắn tin", body: "Nút nhắn hỗ trợ trên đầu trang tạm ẩn. Cần hỗ trợ, thầy cô dùng mục Góp ý trong menu tài khoản." },
    ],
  },
  {
    version: "0.13.1",
    date: "2026-10-06",
    title: "Sửa chữ tên câu hỏi Google Form",
    summary: "Tên câu hỏi gợi ý trong hộp Nhập Excel hiện đúng chữ có dấu.",
    notify: false,
    items: [
      { kind: "fix", title: "Tên câu hỏi hiện đúng", body: "Tên câu hỏi như Họ tên, Lớp không còn bị vẽ lệch thành chữ hoa.", guideId: "nhap-excel" },
    ],
  },
  {
    version: "0.13.0",
    date: "2026-10-06",
    title: "Phụ huynh tự điền danh sách, hòm thư góp ý",
    summary: "Gửi Google Form cho phụ huynh điền thông tin học sinh rồi nhập thẳng vào app. Thêm mục Góp ý để thầy cô chấm điểm và gửi ý kiến.",
    notify: true,
    items: [
      { kind: "new", title: "Nhờ phụ huynh điền qua Google Form", body: "Ở Nhập Excel, có hướng dẫn tạo Google Form 5 câu hỏi để phụ huynh điền. Tải câu trả lời về dạng .xlsx rồi nhập thẳng, không phải sửa file.", guideId: "nhap-excel" },
      { kind: "new", title: "Hòm thư góp ý", body: "Mở menu tài khoản, chọn Góp ý để chấm 1 đến 5 sao và ghi điều cần thêm, cần sửa." },
    ],
  },
  {
    version: "0.12.0",
    date: "2026-10-05",
    title: "Hướng dẫn có ảnh minh hoạ",
    summary: "Các bước chính trong Hướng dẫn sử dụng có ảnh chụp màn hình máy tính và điện thoại.",
    notify: true,
    items: [
      { kind: "new", title: "Ảnh minh hoạ từng bước", body: "Bước chính có ảnh chụp màn hình, chỗ cần bấm có viền đỏ. Chọn Máy tính hoặc Điện thoại, bấm ảnh để phóng to.", guideId: "bat-dau" },
      { kind: "improve", title: "File Word có ảnh", body: "File Word tải từ trang hướng dẫn có kèm ảnh minh hoạ." },
    ],
  },
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
