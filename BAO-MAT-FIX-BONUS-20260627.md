# Vá lỗ hổng đúc điểm Bonus, App EDU (27/06/2026)

## Lỗ hổng (gốc rễ)

App EDU dùng đăng nhập tự chế (bcrypt + localStorage), KHÔNG bật Firebase Auth.
Với Firebase, mọi kết nối là `auth == null`, nên Rules trên Console buộc phải mở toang.
Hệ quả: bất kỳ ai mở Console trình duyệt (hoặc gọi REST API, vì `databaseURL` công khai)
đều ghi giá trị tùy ý vào mọi node, gồm `scores/<lop>/<id>/bonus`. Vì 2 Bonus = 1 Credit
= đồ Fresh Fit / quà, đây là đúc tiền vô hạn (và về lý thuyết sửa được cả điểm thi, hồ sơ).
Con số "1000000001001779" trên Bảng Vinh Danh chỉ là triệu chứng.

## Cách vá (server-authoritative + phân vai bằng Rules)

1. Cầu nối danh tính, Cloud Function `issueToken` (functions/index.js):
   xác thực mật khẩu PHÍA SERVER (admin SDK, bcrypt), cấp Firebase custom token mang
   claim `role` + cờ `bod/mod/ff/ffPlus`. uid token = key user trong node `users`.

2. Client mở phiên Firebase thật: `Login.jsx` gọi `issueToken` rồi `signInWithCustomToken`.
   Không còn đọc cả node `users` phía client (hết lộ hash), không còn so mật khẩu ở client.
   `AuthContext.jsx` theo dõi phiên Firebase; tài khoản đăng nhập từ TRƯỚC bản vá sẽ bị
   đăng xuất 1 lần để đăng nhập lại qua luồng mới.

3. Rules phân vai (`database.rules.json`): mọi node mặc định CẤM, mở theo vai trò.
   Điểm mấu chốt, node `scores/$cid/$sid/bonus/$rid`:
   - staff/admin: ghi đầy đủ (cộng/trừ Bonus như nghiệp vụ).
   - HỌC VIÊN: chỉ được TẠO bản ghi điểm ÂM của CHÍNH MÌNH (tiêu điểm mua skin),
     không sửa/xóa bản ghi cũ → KHÔNG thể tự cộng điểm. Cùng cơ chế cho `staffBonus`.
   Token ký bởi server nên học viên không giả mạo được claim; nếu không đăng nhập thì
   `auth == null` và bị cấm ghi mọi thứ.

## File đã đổi

- `functions/index.js` (thêm `issueToken`), `functions/package.json` (thêm `bcryptjs`)
- `src/firebase.js` (export `functions`), `src/context/AuthContext.jsx`, `src/pages/Login.jsx`
- `database.rules.json` (MỚI), `firebase.json` (đăng ký rules)
- `functions/admin-scripts/clean-abused-bonus.js` (MỚI, dọn record giả)
- Backup bản cũ: `_backup-20260627/`

## Lỗ hổng này KHÔNG chỉ là điểm Bonus

Vì DB mở toang nên MỌI bảng đều bị sửa được, không riêng Bonus:
- `attendance` (chuyên cần): học viên ghi buổi "present" giả để thổi chuỗi đi học.
- `scores` (điểm thi/assignment), `tuitionRecords` (số buổi/trạng thái học phí), v.v.

Một lần deploy Rules (Bước 5) khóa TẤT CẢ: attendance/scores/tuition chỉ staff/admin ghi;
học viên chỉ được trừ Bonus của chính mình (mua skin) và gửi yêu cầu gia hạn học phí
(không sửa được số buổi/trạng thái thanh toán). Không cần sửa thêm code cho từng trò hack.

## QUAN TRỌNG: phải COMMIT bản vá lên git (nếu không sẽ mất lại)

Bản vá nằm ở các file đã được git theo dõi (firebase.js, Login.jsx, AuthContext.jsx,
functions/index.js, functions/package.json, firebase.json). Nếu chỉ sửa local mà KHÔNG
commit/đẩy lên git, thì mỗi lần pull/clone code của đồng nghiệp sẽ GHI ĐÈ và xóa sạch bản vá
(đã xảy ra 2 lần). Sau khi deploy xong và test ổn, hãy commit toàn bộ thay đổi này và merge
vào nhánh chính, dặn đồng nghiệp pull về để không ai vô tình lùi lại.

## THỨ TỰ TRIỂN KHAI (bắt buộc đúng để KHÔNG khóa nhầm người dùng)

Lý do thứ tự: nếu deploy Rules siết TRƯỚC khi client mới (có token) lên sóng, người đang
dùng bản cũ (auth==null) sẽ bị chặn ngay. Vì vậy bật danh tính TRƯỚC, siết Rules SAU.

1. Bật Authentication cho project `bavn-learning`: Console → Authentication → Get started
   (không cần provider nào; custom token chỉ cần dịch vụ Auth được bật).
2. Cài deps functions rồi deploy function:
   ```
   cd functions && npm install
   firebase deploy --only functions:issueToken
   ```
3. Build + deploy client MỚI (đã có signInWithCustomToken):
   ```
   npm install      # nếu cần
   npm run build
   firebase deploy --only hosting
   ```
   Báo người dùng Ctrl+Shift+R (service worker cache dai). Lúc này Rules vẫn đang mở,
   app chạy bình thường, nhưng mỗi phiên giờ đã có danh tính Firebase + claim vai trò.
4. Test với cả 2 vai (1 tài khoản học viên + 1 staff): đăng nhập, mua skin (trừ Bonus),
   giáo viên cộng Bonus + điểm danh + nhập điểm, học viên xem Bảng Vinh Danh, đổi mật khẩu
   (Hồ sơ), gửi yêu cầu gia hạn học phí. Tất cả phải chạy đúng.
5. KHI đã chắc client mới phủ hết: deploy Rules siết:
   ```
   firebase deploy --only database
   ```
6. Thử khai thác để xác nhận đã chặn: đăng nhập bằng tài khoản học viên, mở Console chạy thử
   cả 2 lệnh, cả hai phải báo PERMISSION_DENIED:
   ```
   firebase.database().ref('scores/<lop>/<id>/bonus').push({score: 999999})
   firebase.database().ref('attendance/<lop>/2026-01-01/<id>').set('present')
   ```
7. Dọn dữ liệu giả: chạy `functions/admin-scripts/clean-abused-bonus.js` (xem hướng dẫn
   trong file), dry-run trước, `--apply` sau khi xem danh sách.

## Còn lại (khuyến nghị Phase sau, KHÔNG nằm trong bản vá này)

- Hash mật khẩu hiện vẫn nằm trong node `users` (đọc được bởi tài khoản đã đăng nhập, vì
  Bảng Vinh Danh/Cửa hàng cần đọc tên mọi user). Nên tách hash sang node `userAuth/$uid`
  chỉ admin đọc, và chuyển đổi/đổi mật khẩu qua function. (Đã chặn người NGOÀI đọc hash,
  nhưng chưa giấu khỏi tài khoản nội bộ.)
- Siết quyền field-level cho staff trên node `users` (hiện staff được tin cậy, ghi rộng).
