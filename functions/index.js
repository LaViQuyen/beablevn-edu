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
const { onValueCreated, onValueUpdated } = require('firebase-functions/v2/database');
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
