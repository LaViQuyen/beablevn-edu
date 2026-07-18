// ============================================================
// SCRIPT TEST TẠM: dựng + dọn dữ liệu test cho Cổng Phụ huynh / Sổ liên lạc
// node _test-parent-portal.js setup    → tạo lớp/HV/PH/staff test + điểm danh + điểm + báo bài
// node _test-parent-portal.js cleanup  → xóa sạch mọi thứ đã tạo
// Mọi bản ghi đều isDemo + tên có tiền tố [TEST] để không lẫn dữ liệu thật.
// ============================================================
const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');
const sa = require('./service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(sa),
  databaseURL: 'https://bavn-learning-default-rtdb.asia-southeast1.firebasedatabase.app',
});
const db = admin.database();

// Key cố định để setup/cleanup idempotent
const K = {
  cls: 'testsll-class',
  student: 'testsll-student',
  parent: 'testsll-parent',
  staff: 'testsll-staff',
};
const PASS = 'test123456';

async function setup() {
  const hash = bcrypt.hashSync(PASS, bcrypt.genSaltSync(10));
  const today = new Date();
  const d = (offset) => {
    const t = new Date(today); t.setDate(t.getDate() - offset);
    return t.toLocaleDateString('en-CA');
  };

  await db.ref(`classes/${K.cls}`).set({
    name: '[TEST] LỚP SỔ LIÊN LẠC', room: 'Test', teacherName: '[TEST] GV Sổ Liên Lạc',
    schedule: 'T2 - T4 - T6', startTime: '18:00', endTime: '19:30',
  });

  await db.ref(`users/${K.student}`).set({
    name: '[TEST] Học Viên SLL', role: 'student', studentCode: 'TESTSLL',
    username: 'TESTSLL', loginId: 'TESTSLL', email: 'TESTSLL@beable.vn',
    classIds: [K.cls], isDemo: true, createdAt: new Date().toISOString(),
  });
  await db.ref(`userAuth/${K.student}`).set({ password: hash });

  await db.ref(`users/${K.staff}`).set({
    name: '[TEST] GV Sổ Liên Lạc', role: 'staff', subRole: 'teacher',
    username: 'testsll-gv', loginId: 'testsll-gv', assignedClasses: [K.cls],
    isDemo: true, createdAt: new Date().toISOString(),
  });
  await db.ref(`userAuth/${K.staff}`).set({ password: hash });

  await db.ref(`users/${K.parent}`).set({
    name: '[TEST] Phụ Huynh SLL', role: 'parent', phone: '0900000000',
    username: 'testsll-ph', loginId: 'testsll-ph', createdAt: new Date().toISOString(),
  });
  await db.ref(`userAuth/${K.parent}`).set({ password: hash });
  await db.ref(`parentLinks/${K.parent}`).set({ [K.student]: true });

  // Điểm danh 4 buổi (test student KHÔNG có tuitionRecords → trigger trừ buổi không tác động gì)
  await db.ref(`attendance/${K.cls}/${d(7)}`).set({ [K.student]: { status: 'present' } });
  await db.ref(`attendance/${K.cls}/${d(5)}`).set({ [K.student]: { status: 'late', note: 'Kẹt xe' } });
  await db.ref(`attendance/${K.cls}/${d(3)}`).set({ [K.student]: { status: 'excused', note: 'Xin phép về quê' } });
  await db.ref(`attendance/${K.cls}/${d(1)}`).set({ [K.student]: 'present' }); // dạng string legacy

  // Điểm 4 loại (score chuỗi lẫn số như dữ liệu thật)
  const s = (score, date, content, extra = {}) => ({ score, date, content, timestamp: new Date().toISOString(), ...extra });
  await db.ref(`scores/${K.cls}/${K.student}`).set({
    bonus: { b1: s(4, d(7), 'Phát biểu tốt'), b2: s('2', d(3), 'Giúp bạn học'), b3: s(2, d(1), '🤖 Tự động: điểm danh đủ', { auto: true }) },
    assignment: { a1: s('8', d(6), 'Homework Unit 1'), a2: s(9, d(2), 'Homework Unit 2') },
    formative: { f1: s('7.5', d(5), 'Mini test Unit 1') },
    summative: { m1: s(8, d(4), 'Thi giữa khóa', { examType: 'MMT' }), m2: s('8.5', d(1), 'Thi cuối khóa', { examType: 'EOMT' }) },
  });

  // Báo bài + link điểm danh (trigger push chỉ nhắm HV lớp test + PH test → không phiền ai)
  await db.ref('notifications/testsll-noti-1').set({
    type: 'content', label: 'báo bài', scope: K.cls, author: '[TEST] GV Sổ Liên Lạc',
    title: '[TEST] Báo bài buổi 12: Unit 3 Reading', date: new Date(Date.now() - 86400000).toISOString(),
    content: '<p><b>Về nhà:</b> làm Workbook trang 24–26, học 10 từ vựng Unit 3.</p><ul><li>Đọc trước passage B</li><li>Nộp essay 150 chữ</li></ul>',
  });
  await db.ref('notifications/testsll-noti-2').set({
    type: 'link', scope: K.cls, author: '[TEST] GV Sổ Liên Lạc',
    title: 'Link điểm danh', linkUrl: 'https://beablevn-edu.web.app', date: new Date().toISOString(),
  });

  console.log('SETUP XONG. Đăng nhập test:');
  console.log('  Học viên : TESTSLL /', PASS);
  console.log('  Phụ huynh: testsll-ph /', PASS);
  console.log('  Giáo vụ  : testsll-gv /', PASS);
}

async function cleanup() {
  const attSnap = await db.ref(`attendance/${K.cls}`).get();
  const paths = [
    `classes/${K.cls}`,
    `users/${K.student}`, `users/${K.staff}`, `users/${K.parent}`,
    `userAuth/${K.student}`, `userAuth/${K.staff}`, `userAuth/${K.parent}`,
    `usersPublic/${K.student}`, `usersPublic/${K.staff}`, `usersPublic/${K.parent}`,
    `parentLinks/${K.parent}`,
    `scores/${K.cls}`,
    `appointments/${K.parent}`,
    'notifications/testsll-noti-1', 'notifications/testsll-noti-2',
    `attendance/${K.cls}`,
    `tuitionDeductions/${K.cls}`,
    `fcmTokens/${K.student}`, `fcmTokens/${K.staff}`, `fcmTokens/${K.parent}`,
  ];
  for (const p of paths) await db.ref(p).remove();
  // Dọn feedback + staffNotifications test (quét theo dấu vết test id)
  const fbSnap = await db.ref('feedback').get();
  for (const [id, fb] of Object.entries(fbSnap.val() || {})) {
    if (fb.studentId === K.parent || fb.studentId === K.student) await db.ref(`feedback/${id}`).remove();
  }
  const snSnap = await db.ref('staffNotifications').get();
  for (const [id, n] of Object.entries(snSnap.val() || {})) {
    if (n.toUserId === K.staff || (n.from || '').includes('[TEST]')) await db.ref(`staffNotifications/${id}`).remove();
  }
  console.log('CLEANUP XONG: đã xóa', paths.length, 'nhánh + feedback/staffNotifications test.');
}

(async () => {
  const cmd = process.argv[2];
  if (cmd === 'setup') await setup();
  else if (cmd === 'cleanup') await cleanup();
  else console.log('Dùng: node _test-parent-portal.js setup|cleanup');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
