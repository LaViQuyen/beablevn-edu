// ============================================================
// CLOUD FUNCTIONS — gửi PUSH NOTIFICATION (FCM) cho app 2SOL EDU
// Push đến được người dùng kể cả khi đã đóng trình duyệt.
// 4 luồng:
//  1. Thông báo/báo bài mới   → học viên đúng phạm vi lớp
//  2. Đơn đổi mới             → FF/FF+ (đơn món) hoặc BOD (đơn quà)
//  3. Đơn được duyệt/từ chối  → người đặt đơn
//  4. Nhắc lịch học (mỗi 5')  → học viên có lớp bắt đầu trong ~30 phút
// Deploy: firebase deploy --only functions
// ============================================================
const { onValueCreated, onValueUpdated, onValueDeleted, onValueWritten } = require('firebase-functions/v2/database');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

admin.initializeApp({
  databaseURL: 'https://bavn-learning-default-rtdb.asia-southeast1.firebasedatabase.app',
});
const db = admin.database();

// LƯU Ý 2 PROJECT: database nằm ở "bavn-learning" (nơi deploy Functions),
// nhưng app web + FCM token thuộc project "beablevn-learning" (Sender ID 929043730121).
// → Gửi FCM phải dùng credential của beablevn-learning: tải service account key
//   (Console beablevn-learning → Project settings → Service accounts → Generate new private key)
//   đặt tại functions/msg-service-account.json
let msgApp;
try {
  const sa = require('./msg-service-account.json');
  msgApp = admin.initializeApp({ credential: admin.credential.cert(sa) }, 'messaging');
  console.log('FCM: dùng service account của', sa.project_id);
} catch (e) {
  console.warn('FCM: chưa có msg-service-account.json — dùng credential mặc định (có thể SenderId mismatch).');
}
const messaging = () => admin.messaging(msgApp);

// Trigger RTDB phải đặt cùng region với database
const DB_OPTS = { instance: 'bavn-learning-default-rtdb', region: 'asia-southeast1' };

// --- Lấy token của danh sách user, kèm path để dọn token chết ---
const tokensOf = async (userIds) => {
  const out = [];
  await Promise.all([...new Set(userIds)].map(async (uid) => {
    const snap = await db.ref(`fcmTokens/${uid}`).get();
    const v = snap.val() || {};
    Object.entries(v).forEach(([key, t]) => {
      if (t?.token) out.push({ token: t.token, path: `fcmTokens/${uid}/${key}` });
    });
  }));
  return out;
};

// --- Gửi data-message (service worker tự vẽ notification) + dọn token hỏng ---
const sendTo = async (tokenRows, title, body, url = '/') => {
  if (!tokenRows.length) return;
  const res = await messaging().sendEachForMulticast({
    tokens: tokenRows.map(t => t.token),
    data: { title, body: String(body || '').slice(0, 500), url },
    webpush: { headers: { Urgency: 'high', TTL: '86400' } },
  });
  // Xóa token đã hết hạn để lần sau không gửi rác
  await Promise.all(res.responses.map((r, i) => {
    const code = r.error?.code || '';
    if (!r.success && /not-registered|invalid-registration|invalid-argument/.test(code)) {
      return db.ref(tokenRows[i].path).remove();
    }
    return null;
  }));
};

const itemsText = (items) => (items || []).map(i => `${i.name} ×${i.qty}`).join(', ');
const allUsers = async () => (await db.ref('users').get()).val() || {};
const classIdsOf = (u) => Array.isArray(u.classIds) ? u.classIds : Object.values(u.classIds || {});

// ============================================================
// 1. THÔNG BÁO MỚI → học viên đúng phạm vi
// ============================================================
exports.onNotificationCreated = onValueCreated({ ...DB_OPTS, ref: '/notifications/{id}' }, async (event) => {
  const n = event.data.val();
  if (!n) return;
  const users = await allUsers();
  const targets = Object.entries(users)
    .filter(([, u]) => u.role === 'student' && (n.scope === 'all' || classIdsOf(u).includes(n.scope)))
    .map(([id]) => id);
  const label = n.type === 'link' ? 'Liên kết' : (n.label ? n.label.charAt(0).toUpperCase() + n.label.slice(1) : 'Thông báo');
  await sendTo(await tokensOf(targets), `📢 ${label} mới`, n.title || 'Mở app để xem chi tiết.', '/student/notifications');
});

// ============================================================
// 2. ĐƠN ĐỔI MỚI → FF (đơn món) hoặc BOD (đơn quà)
// ============================================================
exports.onRedemptionCreated = onValueCreated({ ...DB_OPTS, ref: '/redemptions/{id}' }, async (event) => {
  const r = event.data.val();
  if (!r || r.status !== 'pending') return;
  const isGift = r.channel === 'gift';
  const users = await allUsers();
  const targets = Object.entries(users)
    .filter(([, u]) => u.role === 'admin' || (u.role === 'staff' && (isGift ? u.bodAccess : (u.ffAccess || u.ffPlusAccess))))
    .map(([id]) => id)
    .filter(id => id !== r.studentId); // không tự báo cho người vừa đặt
  const title = isGift ? '🎁 Đơn đổi quà mới (BOD duyệt)' : '🛎️ Yêu cầu đổi món mới';
  const body = `${r.studentName}: ${itemsText(r.items)} — ${r.totalCredits}⭐${r.note ? ` · 📝 ${r.note}` : ''}`;
  await sendTo(await tokensOf(targets), title, body, isGift ? '/staff/bavn' : '/staff/freshfit');
});

// ============================================================
// 3. ĐƠN ĐƯỢC DUYỆT / TỪ CHỐI → người đặt
// ============================================================
exports.onRedemptionStatusChanged = onValueUpdated({ ...DB_OPTS, ref: '/redemptions/{id}' }, async (event) => {
  const before = event.data.before.val() || {};
  const after = event.data.after.val() || {};
  if (before.status !== 'pending' || after.status === 'pending') return; // chỉ bắt pending → kết quả
  const kind = after.channel === 'gift' ? 'đổi quà' : 'đổi món';
  const url = after.userType === 'staff' ? '/staff/credits' : '/student/credits';
  let title, body;
  if (after.status === 'confirmed') {
    title = `✅ Yêu cầu ${kind} đã được xác nhận`;
    body = `${itemsText(after.items)} — ${after.channel === 'gift' ? 'nhận quà từ BOD' : 'nhận tại quầy Fresh Fit'} nhé!`;
  } else if (after.status === 'rejected') {
    title = `❌ Yêu cầu ${kind} bị từ chối`;
    body = `${itemsText(after.items)}${after.rejectReason ? ` — Lý do: ${after.rejectReason}` : ''}. Credits đã được hoàn lại.`;
  } else return;
  await sendTo(await tokensOf([after.studentId]), title, body, url);
});

// ============================================================
// 4. NHẮC LỊCH HỌC — chạy mỗi 5 phút (giờ Việt Nam), báo trước ~30 phút
// ============================================================
const parseDays = (schedule) => {
  const s = String(schedule || '').toLowerCase();
  const days = new Set();
  if (/(^|[^a-zà-ỹ])cn|chủ\s*nhật/.test(s)) days.add(0);
  const re = /(?:t|thứ)\s*([2-7])/g;
  let m;
  while ((m = re.exec(s)) !== null) days.add(Number(m[1]) - 1);
  return days;
};

exports.classReminder = onSchedule(
  { schedule: 'every 5 minutes', timeZone: 'Asia/Ho_Chi_Minh', region: 'asia-southeast1' },
  async () => {
    // Giờ hiện tại theo VN
    const nowVN = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const todayKey = `${nowVN.getFullYear()}-${String(nowVN.getMonth() + 1).padStart(2, '0')}-${String(nowVN.getDate()).padStart(2, '0')}`;
    const nowMin = nowVN.getHours() * 60 + nowVN.getMinutes();

    const classes = (await db.ref('classes').get()).val() || {};
    const dueClasses = [];
    for (const [cid, c] of Object.entries(classes)) {
      if (!c.startTime) continue;
      const days = parseDays(c.schedule);
      if (days.size > 0 && !days.has(nowVN.getDay())) continue;
      const [hh, mm] = String(c.startTime).split(':').map(Number);
      if (isNaN(hh)) continue;
      const diff = (hh * 60 + (mm || 0)) - nowMin;
      if (diff > 25 && diff <= 35) dueClasses.push({ cid, c, diff }); // cửa sổ ~30 phút, chạy 5'/lần nên không sót
    }
    if (!dueClasses.length) return;

    const users = await allUsers();
    for (const { cid, c, diff } of dueClasses) {
      // Mỗi lớp chỉ nhắc 1 lần / ngày
      const flagRef = db.ref(`classReminders/${cid}/${todayKey}`);
      if ((await flagRef.get()).val()) continue;
      await flagRef.set(true);

      const targets = Object.entries(users)
        .filter(([, u]) => u.role === 'student' && classIdsOf(u).includes(cid))
        .map(([id]) => id);
      await sendTo(
        await tokensOf(targets),
        `⏰ Sắp đến giờ học lớp ${c.name}`,
        `Bắt đầu lúc ${c.startTime} (còn khoảng ${diff} phút). Chuẩn bị sẵn sàng nhé!`,
        '/student/dashboard'
      );
    }
  }
);

// ============================================================
// AUTH BRIDGE — issueToken
// Cầu nối giữa custom auth (bcrypt + localStorage) và Firebase Auth THẬT.
// Vì sao cần: app dùng đăng nhập tự chế nên Firebase coi mọi kết nối là auth==null,
// buộc Rules phải mở toang. Function này xác thực mật khẩu PHÍA SERVER (admin SDK,
// bỏ qua Rules) rồi cấp Firebase custom token mang theo claim vai trò (role) + cờ quyền.
// Client signInWithCustomToken(token) → từ đó Rules có danh tính thật để phân quyền,
// đặc biệt KHÓA việc học viên tự đúc điểm Bonus.
//
// Callable công khai (gọi được khi CHƯA đăng nhập) — tự kiểm tra mật khẩu bên trong.
// uid của token = KEY của user trong node `users` (đúng bằng currentUser.id client đang dùng).
// ============================================================
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const bcrypt = require('bcryptjs');

exports.issueToken = onCall({ region: 'asia-southeast1' }, async (req) => {
  const loginId = String(req.data?.loginId || '').trim();
  const password = String(req.data?.password || '');
  if (!loginId || !password) {
    throw new HttpsError('invalid-argument', 'Thiếu tên đăng nhập hoặc mật khẩu.');
  }

  // 1) Tra user theo nhiều khóa đăng nhập (giống logic Login.jsx cũ) — nhưng PHÍA SERVER
  const snap = await db.ref('users').get();
  if (!snap.exists()) throw new HttpsError('failed-precondition', 'Hệ thống đang bảo trì.');
  const all = snap.val();
  let uid = null, user = null;
  for (const [key, u] of Object.entries(all)) {
    if (u && (u.username === loginId || u.loginId === loginId || u.email === loginId || u.studentCode === loginId)) {
      uid = key; user = u; break;
    }
  }
  // Thông báo lỗi gộp chung để không lộ "tồn tại tài khoản"
  if (!user) throw new HttpsError('unauthenticated', 'Sai tên đăng nhập hoặc mật khẩu.');

  // 2) Kiểm tra khóa tài khoản
  if (user.lockedAt && new Date() >= new Date(user.lockedAt)) {
    throw new HttpsError('permission-denied', 'Tài khoản đã bị khóa. Liên hệ trung tâm.');
  }

  // 3) Xác thực mật khẩu. Mật khẩu lưu ở node RIÊNG `userAuth/{uid}/password` (không nằm trong
  //    `users`) để đọc node users không lộ credential. Fallback về user.password cho tài khoản
  //    chưa được backfill (giai đoạn chuyển tiếp).
  const authSnap = await db.ref(`userAuth/${uid}/password`).get();
  const stored = String(authSnap.val() || user.password || '');
  const ok = stored.startsWith('$2') ? bcrypt.compareSync(password, stored) : stored === password;
  if (!ok) throw new HttpsError('unauthenticated', 'Sai tên đăng nhập hoặc mật khẩu.');

  // 4) Claim đính vào token — Rules đọc qua auth.token.*
  const role = user.role || 'student';
  const claims = {
    role,
    bod: !!user.bodAccess,
    mod: !!user.modAccess,
    ff: !!user.ffAccess,
    ffPlus: !!user.ffPlusAccess,
  };
  const token = await admin.auth().createCustomToken(uid, claims);

  // 5) Trả token + hồ sơ an toàn (bỏ password) để client set currentUser
  const { password: _omit, ...safeUser } = user;
  return { token, user: { id: uid, ...safeUser } };
});

// ============================================================
// GAME "Hành Trình Trưởng Thành" — CHẤM ĐIỂM & TIẾN TRÌNH PHÍA SERVER.
// Vì sao: totalStars/beaten/rank/unlockedSkills từng do CLIENT tự ghi -> học viên mở DevTools
// grind điểm vô hạn hoặc tự set beaten để nhảy cấp không cần chơi. Nay các trường này CHỈ
// Function (Admin SDK) ghi được; RTDB rules chặn student ghi. Function validate: ải phải mở khóa
// TUẦN TỰ, điểm bị chặn TRẦN, sao chỉ cộng lần vượt ĐẦU mỗi ải.
// (Lượt chơi playsUsed/playLog vẫn do client trừ như cũ, rule append-only đã chặn reset.)
// ============================================================
const GAME_LEVELS = 25;        // config.js LEVELS.length
const STAGE_SCORE_CAP = 3000;  // trần điểm 1 lượt (1 lượt xuất sắc thực tế < ~2500)

// Mở khóa ải theo tiến trình (mirror MapScene): ải i mở khi beaten[i-1]; ải 4 & 5 cần beaten[3].
function isStageUnlocked(stage, beaten) {
  if (stage === 0) return true;
  if (stage === 4 || stage === 5) return !!beaten['3'];
  return !!beaten[String(stage - 1)];
}
// Cấp từ tiến trình (mirror rankFromProgress, bỏ ải 4 = Ải Ẩn).
function rankFromBeaten(beaten) {
  let maxBeaten = -1;
  Object.keys(beaten || {}).forEach((k) => {
    if (beaten[k] && parseInt(k, 10) !== 4) maxBeaten = Math.max(maxBeaten, parseInt(k, 10));
  });
  if (maxBeaten >= 19) return 5;
  if (maxBeaten >= 15) return 4;
  if (maxBeaten >= 10) return 3;
  if (maxBeaten >= 3) return 2;
  return 1;
}

exports.submitStageResult = onCall({ region: 'asia-southeast1' }, async (req) => {
  const uid = req.auth && req.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Cần đăng nhập.');
  const stage = Number(req.data && req.data.stage);
  const won = (req.data && req.data.won) === true;
  const score = Math.max(0, Math.min(STAGE_SCORE_CAP, Math.floor(Number(req.data && req.data.score) || 0)));
  if (!Number.isInteger(stage) || stage < 0 || stage >= GAME_LEVELS) {
    throw new HttpsError('invalid-argument', 'Ải không hợp lệ.');
  }
  if (!won) return { ok: true, ignored: true }; // thua: không đổi tiến trình

  const node = db.ref(`studentGames/${uid}/hanhTrinh`);
  const cur = (await node.get()).val() || {};
  const beaten = cur.beaten || {};

  // Chặn nhảy cóc: ải phải đang mở khóa theo tiến trình hiện tại
  if (!isStageUnlocked(stage, beaten)) {
    throw new HttpsError('permission-denied', 'Ải chưa mở khóa.');
  }

  const firstClear = !beaten[String(stage)];
  const newBeaten = Object.assign({}, beaten, { [String(stage)]: true });
  const newRank = Math.max(Number(cur.rank) || 1, rankFromBeaten(newBeaten));
  const updates = {
    [`beaten/${stage}`]: true,
    rank: newRank,
    updatedAt: new Date().toISOString(),
  };
  if (stage === 4) updates.unlockedSkills = true; // Ải Ẩn -> mở kỹ năng Lễ Nghĩa & Thái Độ
  if (firstClear && score > 0) {
    updates.totalStars = (Number(cur.totalStars) || 0) + score; // sao chỉ cộng lần vượt ĐẦU
  }
  await node.update(updates);
  return { ok: true, firstClear, rank: newRank };
});

exports.resetGameProgress = onCall({ region: 'asia-southeast1' }, async (req) => {
  const uid = req.auth && req.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Cần đăng nhập.');
  await db.ref(`studentGames/${uid}/hanhTrinh`).update({
    beaten: null, unlockedSkills: false, rank: 1, updatedAt: new Date().toISOString(),
  });
  return { ok: true };
});

// ============================================================
// DANH BẠ CÔNG KHAI usersPublic — tự MIRROR từ users.
// Vì sao: node `users` chứa PII (email, mã HV = ID đăng nhập, cờ quyền...). Trước đây mọi học viên
// đăng nhập đọc được trọn users. Nay users chỉ chính chủ + staff/admin đọc; các trang học viên (bảng
// vinh danh, liên hệ, phản ánh, game) chuyển sang đọc `usersPublic` chỉ gồm trường KHÔNG nhạy cảm.
// Trigger này giữ usersPublic luôn khớp users qua MỌI đường ghi (tạo/sửa/xóa), không cần vá tay.
// ============================================================
exports.mirrorUserPublic = onValueWritten(
  { ...DB_OPTS, ref: '/users/{uid}' },
  async (event) => {
    const uid = event.params.uid;
    const after = event.data && event.data.after ? event.data.after.val() : null;
    const pubRef = db.ref(`usersPublic/${uid}`);
    if (!after) { await pubRef.remove(); return null; } // user bị xóa -> gỡ khỏi danh bạ công khai
    const pub = {};
    if (after.name != null) pub.name = after.name;
    if (after.role != null) pub.role = after.role;
    if (after.isDemo != null) pub.isDemo = !!after.isDemo;
    if (after.classIds != null) pub.classIds = after.classIds;
    if (after.assignedClasses != null) pub.assignedClasses = after.assignedClasses;
    if (after.subRole != null) pub.subRole = after.subRole;
    await pubRef.set(pub);
    return null;
  }
);

const coach = require('./coach'); // IELTS COACH: dispatcher tại functions/coach/index.js
exports.coachSpeaking = coach.coachSpeaking;
exports.coachWriting = coach.coachWriting;
exports.coachIntro = coach.coachIntro;
exports.coachTts = coach.coachTts;

// ============================================================
// HỌC PHÍ: tự động đánh "Quá hạn" mỗi ngày 00:10 giờ VN.
// Cấu trúc node: tuitionRecords/{mã HV}/{recordId}.
// - 'Chờ' đã lố paymentDeadline → 'Quá hạn'.
// - 'Chờ duyệt gia hạn' được ân hạn đúng 7 ngày (cam kết trong popup Gia hạn
//   phía học viên), lố quá deadline + 7 ngày mà admin chưa xử lý → 'Quá hạn'.
// Client vẫn có autoUpdateOverdue + effectiveTuitionStatus làm lớp phòng thủ thứ 2,
// cron này bảo đảm DB đúng trạng thái kể cả khi không ai mở trang Học phí.
// ============================================================
exports.tuitionAutoOverdue = onSchedule(
  { schedule: '10 0 * * *', timeZone: 'Asia/Ho_Chi_Minh', region: 'asia-southeast1' },
  async () => {
    const data = (await db.ref('tuitionRecords').get()).val() || {};
    // Hôm nay theo giờ VN, dạng YYYY-MM-DD (so sánh chuỗi được vì cùng định dạng)
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const updates = {};
    for (const [code, recs] of Object.entries(data)) {
      for (const [id, r] of Object.entries(recs || {})) {
        if (!r || !r.paymentDeadline || typeof r.paymentDeadline !== 'string') continue;
        if (r.status === 'Chờ' && r.paymentDeadline < todayStr) {
          updates[`tuitionRecords/${code}/${id}/status`] = 'Quá hạn';
        }
        if (r.status === 'Chờ duyệt gia hạn') {
          const d = new Date(r.paymentDeadline + 'T00:00:00Z');
          if (isNaN(d.getTime())) continue;
          d.setUTCDate(d.getUTCDate() + 7);
          if (d.toISOString().slice(0, 10) < todayStr) {
            updates[`tuitionRecords/${code}/${id}/status`] = 'Quá hạn';
          }
        }
      }
    }
    if (Object.keys(updates).length) await db.ref().update(updates);
    console.log(`tuitionAutoOverdue: chuyển ${Object.keys(updates).length} record sang Quá hạn.`);
  }
);

// ============================================================
// HỌC PHÍ x ĐIỂM DANH (nghiệp vụ Bak chốt 12/07/2026):
// Ngày nào lớp CÓ điểm danh nghĩa là hôm đó CÓ DẠY → trừ 1 "buổi còn lại"
// cho TẤT CẢ học viên trong lớp (kể cả vắng). Vắng CÓ PHÉP không hoàn buổi
// trong hệ thống, thay vào đó báo Giáo vụ liên hệ sắp xếp hỗ trợ học bù
// (xem onAttendanceExcused bên dưới).
// - Guard tuitionDeductions/{lớp}/{ngày} chống trừ 2 lần (GV lưu lại nhiều
//   lần trong ngày, function bị retry).
// - Record học phí được khớp theo: học viên thuộc lớp (users.classIds) +
//   cột "Lớp" của record trùng TÊN lớp (không phân biệt hoa thường).
// - Xoá NGUYÊN node điểm danh của ngày đó (hôm đó không dạy nữa) → tự HOÀN buổi.
// ============================================================
const normName = (s) => String(s || '').trim().toUpperCase();

exports.onAttendanceDayCreated = onValueCreated({ ...DB_OPTS, ref: '/attendance/{classId}/{date}' }, async (event) => {
  const { classId, date } = event.params;
  const guardRef = db.ref(`tuitionDeductions/${classId}/${date}`);
  if ((await guardRef.get()).val()) return; // ngày này đã trừ rồi

  const cls = (await db.ref(`classes/${classId}`).get()).val();
  if (!cls) return;
  const clsName = normName(cls.name);

  const [users, allTuition] = await Promise.all([
    allUsers(),
    db.ref('tuitionRecords').get().then((s) => s.val() || {}),
  ]);
  // Nhánh học phí tra theo mã KHÔNG phân biệt hoa thường (dữ liệu cũ có thể lệch case)
  const branchOf = {};
  Object.keys(allTuition).forEach((code) => { branchOf[normName(code)] = code; });

  const updates = {};
  const deducted = {};
  Object.values(users).forEach((u) => {
    if (!u || u.role !== 'student' || !classIdsOf(u).includes(classId)) return;
    const branch = branchOf[normName(u.studentCode)];
    if (!branch) return; // học viên chưa có record học phí
    Object.entries(allTuition[branch] || {}).forEach(([rid, r]) => {
      if (!r || normName(r.className) !== clsName) return;
      updates[`tuitionRecords/${branch}/${rid}/remainingSessions`] = (Number(r.remainingSessions) || 0) - 1;
      deducted[`${branch}|${rid}`] = true;
    });
  });

  if (Object.keys(deducted).length) {
    updates[`tuitionDeductions/${classId}/${date}`] = {
      deductedAt: new Date().toISOString(),
      className:  cls.name || '',
      records:    deducted,
    };
    await db.ref().update(updates);
  }
  console.log(`onAttendanceDayCreated ${cls.name || classId} ${date}: trừ buổi ${Object.keys(deducted).length} record học phí.`);
});

exports.onAttendanceDayDeleted = onValueDeleted({ ...DB_OPTS, ref: '/attendance/{classId}/{date}' }, async (event) => {
  const { classId, date } = event.params;
  const guardRef = db.ref(`tuitionDeductions/${classId}/${date}`);
  const guard = (await guardRef.get()).val();
  if (!guard) return; // ngày này chưa từng trừ
  const updates = {};
  await Promise.all(Object.keys(guard.records || {}).map(async (key) => {
    const [branch, rid] = key.split('|');
    const cur = (await db.ref(`tuitionRecords/${branch}/${rid}/remainingSessions`).get()).val();
    if (cur === null) return; // record đã bị xoá thì thôi
    updates[`tuitionRecords/${branch}/${rid}/remainingSessions`] = (Number(cur) || 0) + 1;
  }));
  updates[`tuitionDeductions/${classId}/${date}`] = null;
  await db.ref().update(updates);
  console.log(`onAttendanceDayDeleted ${classId} ${date}: hoàn buổi ${Object.keys(guard.records || {}).length} record.`);
});

// Học viên bị đánh "Có phép" (excused) → báo Giáo vụ (admin + staff phụ trách lớp)
// qua FCM để liên hệ sắp xếp hỗ trợ việc học vào ngày nghỉ có phép.
exports.onAttendanceExcused = onValueWritten({ ...DB_OPTS, ref: '/attendance/{classId}/{date}/{sid}' }, async (event) => {
  const before = event.data.before.val();
  const after = event.data.after.val();
  const stBefore = before ? (typeof before === 'object' ? before.status : before) : null;
  const stAfter = after ? (typeof after === 'object' ? after.status : after) : null;
  if (stAfter !== 'excused' || stBefore === 'excused') return; // chỉ bắt lúc CHUYỂN sang Có phép

  const { classId, date, sid } = event.params;
  const users = await allUsers();
  const student = users[sid] || {};
  const cls = (await db.ref(`classes/${classId}`).get()).val() || {};
  const note = typeof after === 'object' && after.note ? ` · Ghi chú: ${after.note}` : '';
  const dateDisp = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split('-').reverse().join('/') : date;

  const targets = Object.entries(users)
    .filter(([, u]) => u && (u.role === 'admin' || (u.role === 'staff' && (u.assignedClasses || []).includes(classId))))
    .map(([id]) => id);
  await sendTo(
    await tokensOf(targets),
    `📋 Vắng có phép: ${student.name || 'Học viên'}${student.studentCode ? ` (${student.studentCode})` : ''}`,
    `Lớp ${cls.name || classId} · buổi ${dateDisp}${note}. Giáo vụ liên hệ học viên để sắp xếp hỗ trợ học bù.`,
    '/staff/attendance'
  );
});
