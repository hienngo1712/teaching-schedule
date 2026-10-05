export type GuideSection = { id: string; title: string; intro?: string; steps: string[]; tips?: string[] }

// Nguồn duy nhất cho /guide (và file Word tải từ trang này). Chỉ tiếng Việt (spec W §3.1).
export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "bat-dau",
    title: "Bắt đầu",
    intro: "Mỗi giáo viên dùng 1 tài khoản riêng, chỉ bạn xem được dữ liệu của mình.",
    steps: [
      "Mở trang **Đăng ký**, nhập tên đăng nhập (chữ, số, dấu gạch dưới), mật khẩu ít nhất 10 ký tự và **Nhập lại mật khẩu**.",
      "Đọc khung tóm tắt chính sách bảo mật, tick ô đồng ý rồi bấm **Đăng ký**.",
      "Đăng nhập. Tick **Ghi nhớ đăng nhập** nếu dùng máy riêng để không phải đăng nhập lại mỗi ngày.",
      "Trên **Tổng quan** có thẻ **Bắt đầu sử dụng** gồm 5 bước. Làm lần lượt, bước xong tự được đánh dấu.",
      "Đổi mật khẩu: bấm vào avatar góc phải trên, chọn **Đổi mật khẩu**.",
    ],
    tips: ["Không nên dùng số điện thoại làm tên đăng nhập.", "Tài khoản mới được dùng thử gói Pro miễn phí một thời gian."],
  },
  {
    id: "mon-hoc",
    title: "Môn học",
    intro: "App đã tạo sẵn vài môn khi bạn đăng ký.",
    steps: [
      "Mở **Môn học** (trên điện thoại: tab **Thêm** rồi **Môn học**).",
      "Bấm **Thêm môn** để thêm môn mới, chọn màu để dễ nhìn trên lịch.",
      "Tắt các môn không dạy để danh sách chọn môn gọn hơn.",
      "Đặt 1 môn làm mặc định để khi tạo ca app chọn sẵn môn đó.",
    ],
  },
  {
    id: "hoc-sinh",
    title: "Học sinh",
    steps: [
      "Mở **Học sinh**, bấm **Thêm học sinh**.",
      "Nhập họ tên, lớp, tên và số điện thoại phụ huynh (không bắt buộc).",
      "Chọn **Cách thu học phí**: **Theo buổi** (nhập học phí mỗi buổi) hoặc **Trọn tháng** (nhập học phí cả tháng, không phụ thuộc số buổi).",
      "Tick ô đồng ý lưu dữ liệu rồi bấm **Thêm**.",
      "Học sinh nghỉ hẳn: mở học sinh, tắt **Đang học**. Học sinh vẫn còn trong lịch sử và học phí cũ.",
    ],
    tips: [
      "Đổi cách thu hoặc mức học phí chỉ áp dụng từ tháng bạn chọn, các tháng trước giữ nguyên.",
      "Số học sinh đang học tối đa phụ thuộc gói của bạn.",
    ],
  },
  {
    id: "nhap-excel",
    title: "Nhập học sinh từ Excel",
    steps: [
      "Ở **Học sinh**, bấm **Nhập Excel** rồi **Tải file mẫu**.",
      "Điền mỗi học sinh 1 dòng theo đúng cột trong file mẫu, lưu lại.",
      "Chọn file đã điền. App hiện bảng xem trước, dòng lỗi được tô đỏ kèm lý do.",
      "Sửa dòng lỗi trong file rồi chọn lại, hoặc bỏ qua dòng lỗi. Tick ô đồng ý và bấm nhập.",
    ],
  },
  {
    id: "lich-day",
    title: "Lịch dạy",
    steps: [
      "Mở **Lịch dạy**, bấm **+ Thêm ca dạy mới**.",
      "Chọn ngày, giờ bắt đầu, giờ kết thúc, môn và các học sinh trong ca.",
      "Muốn ca lặp hằng tuần: chọn **Lặp lại vào các thứ** và khoảng ngày.",
      "Bấm vào ca để xem chi tiết, sửa, chuyển sang ngày giờ khác, huỷ ca (ghi lý do) hoặc tạo **Ca bù**.",
      "Cuối tháng dùng **Chép lịch tháng** để chép lịch sang tháng sau.",
    ],
    tips: ["App báo khi ca mới trùng giờ với ca đã có."],
  },
  {
    id: "diem-danh",
    title: "Điểm danh",
    steps: [
      "Mở ca cần điểm danh trên **Lịch dạy**.",
      "Chọn trạng thái cho từng học sinh: có mặt, vắng có phép hoặc vắng không phép.",
      "Bấm **Lưu**. Học phí theo buổi được tính theo điểm danh này.",
      "Dùng nút mũi tên để sang ca trước / ca sau trong tháng mà không cần quay lại lịch.",
    ],
  },
  {
    id: "hoc-phi",
    title: "Học phí",
    steps: [
      "Mở **Học phí**: app mở sẵn **tháng trước** (tháng vừa học xong). Mỗi học sinh có số cần đóng, ghi rõ phần nợ tháng cũ và tiền tháng đó.",
      "Phụ huynh đóng đủ: bấm **Đã đóng đủ** trên dòng học sinh. Lỡ tay thì bấm **Hoàn tác** trên thông báo.",
      "Đóng thiếu hoặc đóng nhiều tháng: bấm vào học sinh → **Đóng một phần**, nhập số tiền. Tiền tự trừ vào tháng cũ nhất trước, có dòng xem trước trừ tháng nào.",
      "Tháng đang học (chưa học xong) chỉ **tạm tính** và **không ghi được tiền**, kể cả học sinh đóng trọn tháng. Phụ huynh đóng trước thì ghi ở tháng trước, phần dư tự trừ sang tháng sau.",
      "Muốn miễn phần còn thiếu: mở học sinh ở tháng đã học xong → menu ⋮ → **Miễn phần còn thiếu**.",
      "Bấm **Phiếu báo** để tạo phiếu học phí có mã QR, rồi lưu ảnh hoặc chia sẻ cho phụ huynh.",
      "Gửi xong, bấm **Đánh dấu đã gửi** để lọc được học sinh chưa gửi phiếu. Số tiền đổi sau khi gửi sẽ có nhãn báo; phiếu gửi từ 7 ngày mà chưa đóng có nhãn màu cam.",
      "**Link phụ huynh**: phụ huynh mở link là xem được học phí, điểm danh và lịch học của con, không cần đăng nhập.",
    ],
    tips: ["Không chia sẻ công khai link phụ huynh."],
  },
  {
    id: "bao-cao",
    title: "Báo cáo tháng",
    steps: [
      "Mở **Báo cáo** (gói có tính năng báo cáo tháng).",
      "Chọn tháng để xem doanh thu, số đã thu, còn nợ và điểm danh.",
      "Học sinh đã xoá vẫn được tính trong số liệu các tháng cũ.",
    ],
  },
  {
    id: "tai-khoan-ngan-hang",
    title: "Tài khoản nhận học phí",
    steps: [
      "Mở **Cài đặt**, phần **Tài khoản nhận học phí**.",
      "Gõ tên để tìm ngân hàng, nhập số tài khoản và tên chủ tài khoản.",
      "Tick ô đồng ý rồi bấm **Lưu**. Phiếu báo học phí sẽ có mã QR chuyển khoản đúng số tiền.",
    ],
  },
  {
    id: "goi-dich-vu",
    title: "Gói dịch vụ",
    steps: [
      "Mở **Gói của tôi** để xem gói đang dùng, hạn dùng và tính năng của từng gói Standard, Plus, Pro.",
      "Bấm mua hoặc gia hạn, chọn thời hạn. App hiện mã đơn và số tiền cần chuyển khoản.",
      "Chuyển khoản đúng nội dung mã đơn. Gói được kích hoạt sau khi quản trị viên xác nhận.",
    ],
    tips: ["Gia hạn sớm trước khi hết hạn được tặng thêm tháng."],
  },
  {
    id: "thung-rac",
    title: "Thùng rác",
    steps: [
      "Học sinh, môn, ca dạy, lần thu đã xoá đều vào **Thùng rác**.",
      "Mở **Thùng rác**, chọn loại, bấm **Khôi phục** để lấy lại.",
      "Khôi phục ca hoặc lần thu cần học sinh và môn của nó còn tồn tại.",
    ],
  },
  {
    id: "sao-luu",
    title: "Sao lưu Excel",
    steps: [
      "Bấm avatar góc phải trên, chọn **Sao lưu dữ liệu**.",
      "Đọc cảnh báo: file sao lưu không mã hoá, chỉ lưu ở nơi an toàn.",
      "Bấm **Tôi hiểu, tải xuống** để tải file Excel chứa toàn bộ dữ liệu của bạn.",
    ],
  },
  {
    id: "bao-mat",
    title: "Bảo mật dữ liệu",
    steps: [
      "Họ tên, số điện thoại, ghi chú, số tài khoản được mã hoá trong cơ sở dữ liệu.",
      "Chỉ bạn xem được dữ liệu của mình. Quản trị viên chỉ thấy thông tin gói.",
      "Đọc đầy đủ ở trang **Chính sách bảo mật** (link ở trang đăng nhập).",
    ],
    tips: ["Chỉ nhập dữ liệu học sinh khi phụ huynh đã cho phép."],
  },
]

export const GUIDE_IDS: ReadonlySet<string> = new Set(GUIDE_SECTIONS.map((s) => s.id))
