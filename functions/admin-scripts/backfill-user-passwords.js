// ============================================================
// BACKFILL MẬT KHẨU LEGACY: users/{uid}/password → userAuth/{uid}/password
// Vì sao: bản vá bảo mật 12/07 chuyển mật khẩu sang node riêng userAuth,
// nhưng tài khoản cũ có thể còn field password nằm trong users. Nâng cấp
// Cổng Phụ huynh mở quyền đọc users/{childId} cho phụ huynh được liên kết,
// nên phải dọn sạch field này trước khi deploy rules (chống lộ hash/plaintext).
//
// Chạy:  node backfill-user-passwords.js          (dry-run, chỉ liệt kê)
//        node backfill-user-passwords.js --apply  (chạy thật, có snapshot backup)
// An toàn: snapshot toàn bộ node users ra file JSON trước khi sửa;
//          chỉ XÓA users/{uid}/password sau khi xác nhận userAuth đã có hash đọc lại được.
// ============================================================
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const sa = require('./service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(sa),
  databaseURL: 'https://bavn-learning-default-rtdb.asia-southeast1.firebasedatabase.app',
});
const db = admin.database();

const APPLY = process.argv.includes('--apply');

(async () => {
  const usersSnap = await db.ref('users').get();
  const users = usersSnap.val() || {};

  // 1. Snapshot backup (đường lui)
  if (APPLY) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(__dirname, `_backup-users-${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify(users, null, 2));
    console.log('Đã snapshot node users →', file);
  }

  const affected = Object.entries(users).filter(([, u]) => u && u.password != null);
  console.log(`Tổng user: ${Object.keys(users).length} · còn field password trong users: ${affected.length}`);

  let moved = 0, hashed = 0, cleaned = 0, skippedExisting = 0;
  for (const [uid, u] of affected) {
    const authSnap = await db.ref(`userAuth/${uid}/password`).get();
    const existing = authSnap.val();
    let action;
    if (existing) {
      // userAuth đã có hash → chỉ cần xóa bản trong users
      action = 'xóa (userAuth đã có)';
      skippedExisting++;
    } else {
      const stored = String(u.password);
      // Plaintext cũ (không phải hash bcrypt) → hash trước khi chuyển
      const value = stored.startsWith('$2') ? stored : bcrypt.hashSync(stored, bcrypt.genSaltSync(10));
      if (!stored.startsWith('$2')) hashed++;
      action = stored.startsWith('$2') ? 'chuyển hash sang userAuth' : 'HASH plaintext rồi chuyển';
      if (APPLY) {
        await db.ref(`userAuth/${uid}/password`).set(value);
        // Xác nhận đọc lại được rồi mới xóa nguồn
        const check = (await db.ref(`userAuth/${uid}/password`).get()).val();
        if (check !== value) { console.error(`  !! ${uid}: ghi userAuth THẤT BẠI, GIỮ NGUYÊN users.password`); continue; }
      }
      moved++;
    }
    if (APPLY) {
      await db.ref(`users/${uid}/password`).remove();
      cleaned++;
    }
    console.log(`  - ${uid} (${u.name || '?'} · role ${u.role || '?'}): ${action}${APPLY ? ' ✓' : ' [dry-run]'}`);
  }

  console.log(`\nKẾT QUẢ${APPLY ? '' : ' (DRY-RUN, chưa sửa gì)'}: chuyển ${moved} (trong đó hash mới ${hashed}), userAuth có sẵn ${skippedExisting}, đã xóa khỏi users ${cleaned}.`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
