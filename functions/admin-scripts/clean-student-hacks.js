// ============================================================
// DỌN HACK CHO MỘT HỌC VIÊN CỤ THỂ (bonus + attendance).
// Liệt kê toàn bộ bonus & điểm danh của 1 học viên, ĐÁNH DẤU bản ghi nghi vấn,
// xem trước (dry-run) rồi mới xóa. Không xóa mù.
//
// CHẠY (trong thư mục functions/, cần service-account.json như script kia):
//   Xem trước (KHÔNG xóa gì):
//     node admin-scripts/clean-student-hacks.js "Lê Nguyễn Nhật Minh"
//   Hoặc tra theo mã học viên cho chính xác:
//     node admin-scripts/clean-student-hacks.js --code 20230240
//
//   Xóa BONUS giả (điểm dương lớn bất thường):
//     node admin-scripts/clean-student-hacks.js "Lê Nguyễn Nhật Minh" --apply-bonus
//   Xóa ATTENDANCE bị đánh dấu nghi vấn (buổi tự chế / lớp không ghi danh):
//     node admin-scripts/clean-student-hacks.js "Lê Nguyễn Nhật Minh" --apply-attendance
//
// Ngưỡng bonus nghi vấn: điểm dương > CAP (mặc định 1000). Bonus thật chỉ 1..vài chục.
// Điểm danh nghi vấn = buổi mà CHỈ MÌNH em đó có mặt (không có bạn cùng lớp nào trong
//   buổi đó → nhiều khả năng do em tự tạo), HOẶC lớp em không hề ghi danh (classIds).
//   Điểm danh giả CHÈN vào buổi thật (có bạn cùng lớp) thì script KHÔNG tự đoán được,
//   phần đó nhờ giáo viên rà trên màn Điểm danh của app.
// ============================================================
const admin = require('firebase-admin');
const path = require('path');

const CAP = 1000;
// Từ khóa nhận diện bản ghi hack/POC (kể cả điểm dương KHÔNG quá lớn như 500, 1000)
const HACK_RE = /poc|hack|poggers|unlimited|triệu tỷ|tỷ bonus/i;
const NEG_CAP = -100;       // chi tiêu âm < -100 bonus (>50 credit) = bất thường, nghi tiêu bằng credit hack
const SKIN_CREDIT_CAP = 50; // skin mua > 50 credit = bất thường (skin thật chỉ 5-8 credit)
const args = process.argv.slice(2);
const APPLY_ALL = args.includes('--apply-all');
const APPLY_BONUS = APPLY_ALL || args.includes('--apply-bonus');
const APPLY_ATT = APPLY_ALL || args.includes('--apply-attendance');
const APPLY_SKINS = APPLY_ALL || args.includes('--apply-skins');
const codeIdx = args.indexOf('--code');
const byCode = codeIdx >= 0 ? String(args[codeIdx + 1] || '') : null;
const nameQuery = args.filter(a => !a.startsWith('--') && a !== byCode).join(' ').trim();

const sa = require(path.join(__dirname, 'service-account.json'));
admin.initializeApp({
  credential: admin.credential.cert(sa),
  databaseURL: 'https://bavn-learning-default-rtdb.asia-southeast1.firebasedatabase.app',
});
const db = admin.database();

const norm = (s) => String(s || '').toLowerCase().normalize('NFC');

(async () => {
  const [uSnap, sSnap, aSnap, cSnap] = await Promise.all([
    db.ref('users').get(), db.ref('scores').get(),
    db.ref('attendance').get(), db.ref('classes').get(),
  ]);
  const users = uSnap.val() || {};
  const scores = sSnap.val() || {};
  const attendance = aSnap.val() || {};
  const classes = cSnap.val() || {};

  // 1) Tìm học viên
  let matches = Object.entries(users).filter(([id, u]) => u && u.role === 'student' && (
    byCode ? (u.studentCode === byCode || u.username === byCode || u.loginId === byCode)
           : norm(u.name).includes(norm(nameQuery))
  ));
  if (matches.length === 0) { console.log('Không tìm thấy học viên khớp:', byCode || nameQuery); process.exit(0); }
  if (matches.length > 1) {
    console.log('Khớp NHIỀU học viên, hãy chạy lại với --code <mã> để chọn đúng người:');
    matches.forEach(([id, u]) => console.log(`  - ${u.name} | mã: ${u.studentCode || '?'} | id: ${id}`));
    process.exit(0);
  }
  const [sid, stu] = matches[0];
  const classIds = stu.classIds || [];
  console.log(`\n=== HỌC VIÊN: ${stu.name} | mã: ${stu.studentCode || '?'} | id: ${sid} ===`);
  console.log(`Lớp ghi danh: ${classIds.map(c => classes[c]?.name || c).join(', ') || '(không có)'}\n`);

  // 2) BONUS
  const bonusFlagged = [];
  let bonusTotal = 0;
  console.log('--- BONUS (mọi lớp) ---');
  for (const [cid, classNode] of Object.entries(scores)) {
    const recs = classNode?.[sid]?.bonus || {};
    for (const [rid, r] of Object.entries(recs)) {
      const score = Number(r?.score) || 0;
      bonusTotal += score;
      // Nghi vấn = điểm dương lớn bất thường, nội dung chứa từ khóa hack/POC,
      // HOẶC chi tiêu âm lớn bất thường (mua skin bằng credit hack).
      const suspect = score > CAP || (score > 0 && HACK_RE.test(r?.content || '')) || score < NEG_CAP;
      if (suspect) bonusFlagged.push(`scores/${cid}/${sid}/bonus/${rid}`);
      console.log(`  ${suspect ? '⚠️ ' : '   '}[${score}] ${classes[cid]?.name || cid} | ${r?.date || ''} | ${r?.content || ''}`);
    }
  }
  console.log(`  Tổng bonus hiện tại: ${bonusTotal}. Bản ghi nghi vấn (hack/POC + chi tiêu bằng credit hack): ${bonusFlagged.length}.\n`);

  // 3) ATTENDANCE
  const attFlagged = [];
  let attTotal = 0, attKept = 0;
  console.log('--- ĐIỂM DANH ---');
  for (const [cid, dates] of Object.entries(attendance)) {
    for (const [date, session] of Object.entries(dates || {})) {
      if (!session || session[sid] === undefined) continue;
      attTotal++;
      const status = typeof session[sid] === 'object' ? session[sid].status : session[sid];
      const classmates = Object.keys(session).filter(k => k !== sid).length;
      const notEnrolled = !classIds.includes(cid);
      // CHỈ coi là giả khi buổi đó CHỈ MÌNH em (không bạn cùng lớp) → tự chèn.
      // KHÔNG dựa vào "không ghi danh lớp": học viên CHUYỂN LỚP vẫn còn lịch sử điểm danh THẬT ở lớp cũ.
      const suspect = classmates === 0;
      if (['present', 'late', 'excused'].includes(status)) attKept++;
      if (suspect) attFlagged.push(`attendance/${cid}/${date}/${sid}`);
      console.log(`  ${suspect ? '⚠️ ' : '   '}${classes[cid]?.name || cid} | ${date} | ${status} | bạn cùng buổi: ${classmates}${notEnrolled ? ' | KHÔNG ghi danh lớp này' : ''}`);
    }
  }
  console.log(`  Tổng buổi có mặt (giữ chuỗi): ${attKept}/${attTotal}. Nghi vấn: ${attFlagged.length} buổi.\n`);

  // 3b) SKIN mua bằng Credit (thu hồi skin mua bằng credit hack)
  const skinsFlagged = []; // {skinId, pKey, name, credits}
  const skSnap = await db.ref(`studentSkins/${sid}`).get();
  const sk = skSnap.val() || {};
  const equipped = sk.equipped;
  console.log('--- SKIN mua bằng Credit ---');
  for (const [pKey, p] of Object.entries(sk.purchases || {})) {
    const credits = Number(p?.credits) || 0;
    const suspect = credits > SKIN_CREDIT_CAP; // skin thật chỉ 5-8 credit → >50 là mua bằng hack
    if (suspect) skinsFlagged.push({ skinId: p.skinId, pKey, name: p.name, credits });
    console.log(`  ${suspect ? '⚠️ ' : '   '}${p?.name || p?.skinId} | ${credits} credit | ${p?.kind || ''} | ${p?.date || ''}`);
  }
  console.log(`  Skin mua bằng credit hack (> ${SKIN_CREDIT_CAP} credit): ${skinsFlagged.length}.\n`);

  // 4) XÓA (nếu có cờ)
  const updates = {};
  if (APPLY_BONUS) bonusFlagged.forEach(p => { updates[p] = null; });
  if (APPLY_ATT) attFlagged.forEach(p => { updates[p] = null; });
  if (APPLY_SKINS) skinsFlagged.forEach(s => {
    updates[`studentSkins/${sid}/owned/${s.skinId}`] = null;
    updates[`studentSkins/${sid}/purchases/${s.pKey}`] = null;
    if (equipped && equipped === s.skinId) updates[`studentSkins/${sid}/equipped`] = null; // bỏ trang bị skin bị thu hồi
  });
  if (Object.keys(updates).length === 0) {
    console.log('DRY-RUN: chưa xóa gì. Thêm --apply-all (hoặc --apply-bonus / --apply-attendance / --apply-skins) để xóa các dòng có ⚠️.');
    process.exit(0);
  }
  await db.ref().update(updates);
  console.log(`Đã xóa: ${APPLY_BONUS ? bonusFlagged.length + ' bonus, ' : ''}${APPLY_ATT ? attFlagged.length + ' buổi điểm danh, ' : ''}${APPLY_SKINS ? skinsFlagged.length + ' skin' : ''}.`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
