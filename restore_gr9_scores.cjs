/**
 * KHÔI PHỤC ĐIỂM CÁC LỚP ĐÃ XÓA (vd GR9-1, GR9-2) — Be Able VN EDU
 * Khi xóa lớp, app chỉ xóa nhánh "classes/{id}", còn điểm ở "scores/{id}" vẫn còn.
 * Script này đọc DB bằng quyền admin, tìm các lớp "mồ côi" (có điểm nhưng lớp đã xóa),
 * ghép tên học viên và xuất ra 1 file Excel để lưu trữ.
 *
 * CÁCH CHẠY (mở CMD trong thư mục dự án EDU - nơi có serviceAccountKey.json):
 *   npm i firebase-admin xlsx
 *   node restore_gr9_scores.js
 *
 * Nếu muốn chỉ lấy đúng vài lớp đã biết classId, điền vào TARGET dưới đây.
 */
const admin = require('firebase-admin');
const XLSX = require('xlsx');
const path = require('path');

const serviceAccount = require('./serviceAccountKey.json');
const DATABASE_URL = 'https://bavn-learning-default-rtdb.asia-southeast1.firebasedatabase.app';

// Để rỗng = tự dò tất cả lớp đã xóa. Hoặc điền classId cụ thể: ['-NabC...', '-NxYz...']
const TARGET = [];

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: DATABASE_URL,
});

(async () => {
  const db = admin.database();
  console.log('Đang đọc dữ liệu từ Firebase...');
  const [classesSnap, scoresSnap, usersSnap] = await Promise.all([
    db.ref('classes').once('value'),
    db.ref('scores').once('value'),
    db.ref('users').once('value'),
  ]);
  const classes = classesSnap.val() || {};
  const scores  = scoresSnap.val()  || {};
  const users   = usersSnap.val()   || {};

  // Lớp "mồ côi" = có điểm nhưng không còn trong classes
  let orphanIds = Object.keys(scores).filter(cid => !classes[cid]);
  if (TARGET.length) orphanIds = TARGET;

  if (orphanIds.length === 0) {
    console.log('Không tìm thấy lớp đã xóa nào còn điểm. (Có thể điểm chưa từng được nhập, hoặc đã bị xóa thủ công.)');
    process.exit(0);
  }

  const stuName = (sid) => {
    const u = users[sid] || {};
    const en = (u.englishName || '').trim();
    const vn = (u.name || sid).trim();
    return en ? `${vn} - ${en}` : vn;
  };
  const studentClassIds = (u) => Array.isArray(u.classIds) ? u.classIds : (u.classId ? [u.classId] : []);

  const wb = XLSX.utils.book_new();
  const summary = [['classId (lớp đã xóa)', 'Số học viên có điểm', 'Số bản ghi điểm', 'Học viên (gợi ý nhận diện lớp)']];

  orphanIds.forEach((cid, idx) => {
    const classScores = scores[cid] || {};
    const rows = [['Họ tên (Việt - Anh)', 'Mã học viên', 'Loại điểm', 'Điểm', 'Nội dung', 'Ngày', 'examType', 'Thời điểm ghi', 'classId']];
    let recCount = 0;
    const studentSet = new Set();

    Object.entries(classScores).forEach(([sid, byType]) => {
      Object.entries(byType || {}).forEach(([type, records]) => {
        Object.values(records || {}).forEach(rec => {
          studentSet.add(sid);
          recCount++;
          rows.push([
            stuName(sid),
            (users[sid] && users[sid].studentCode) || '',
            type,
            rec.score,
            rec.content || '',
            rec.date || '',
            rec.examType || '',
            rec.timestamp || '',
            cid,
          ]);
        });
      });
    });

    // Gợi ý roster: học viên còn tham chiếu classId này
    const roster = Object.entries(users)
      .filter(([sid, u]) => u.role === 'student' && studentClassIds(u).includes(cid))
      .map(([sid, u]) => u.name).filter(Boolean);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, `LOP_${idx + 1}_${cid.slice(-6)}`.slice(0, 31));
    summary.push([cid, studentSet.size, recCount, roster.join(', ')]);
    console.log(`- Lớp ${cid}: ${studentSet.size} học viên, ${recCount} bản ghi điểm.`);
  });

  const wsSum = XLSX.utils.aoa_to_sheet(summary);
  XLSX.utils.book_append_sheet(wb, wsSum, 'TONG_HOP');
  // đưa TỔNG HỢP lên đầu
  wb.SheetNames.unshift(wb.SheetNames.pop());

  const stamp = new Date().toISOString().slice(0, 10);
  const out = path.join(process.cwd(), `BACKUP-DIEM-LOP-DA-XOA-${stamp}.xlsx`);
  XLSX.writeFile(wb, out);
  console.log('\\n✅ Đã xuất:', out);
  console.log('Mở sheet TONG_HOP để xem classId nào ứng với GR9-1 / GR9-2 (dựa cột "Học viên").');
  process.exit(0);
})().catch(e => { console.error('Lỗi:', e.message); process.exit(1); });
