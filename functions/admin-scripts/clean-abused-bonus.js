// ============================================================
// DỌN RECORD BONUS GIẢ (do khai thác lỗ hổng đúc điểm trước khi vá).
// Quét toàn bộ scores/*/*/bonus và staffBonus/*, liệt kê các bản ghi điểm DƯƠNG
// lớn bất thường (vượt ngưỡng CAP) để Bak xem trước, rồi mới xóa.
//
// CHẠY (trên máy có quyền admin Firebase, trong thư mục functions/):
//   1) Tải service account key của project bavn-learning:
//      Console → Project settings → Service accounts → Generate new private key
//      Lưu thành functions/admin-scripts/service-account.json (ĐỪNG commit).
//   2) Dry-run (chỉ liệt kê, KHÔNG xóa):
//        node admin-scripts/clean-abused-bonus.js
//   3) Sau khi xem danh sách thấy đúng, mới xóa thật:
//        node admin-scripts/clean-abused-bonus.js --apply
//
// Ngưỡng: một bản ghi bonus hợp lệ thường chỉ 1..5 điểm (tối đa vài chục khi MOD thưởng).
// Mặc định coi MỌI bản ghi điểm DƯƠNG > CAP là nghi vấn. Chỉnh CAP nếu cần.
// ============================================================
const admin = require('firebase-admin');
const path = require('path');

const CAP = 1000;                 // điểm dương vượt mức này = nghi vấn khai thác
const APPLY = process.argv.includes('--apply');

const sa = require(path.join(__dirname, 'service-account.json'));
admin.initializeApp({
  credential: admin.credential.cert(sa),
  databaseURL: 'https://bavn-learning-default-rtdb.asia-southeast1.firebasedatabase.app',
});
const db = admin.database();

(async () => {
  const suspects = []; // { path, score, content }

  // 1) scores/{classId}/{studentId}/bonus/{recId}
  const scoresSnap = await db.ref('scores').get();
  const scores = scoresSnap.val() || {};
  for (const [cid, classNode] of Object.entries(scores)) {
    for (const [sid, rec] of Object.entries(classNode || {})) {
      const bonus = (rec && rec.bonus) || {};
      for (const [rid, r] of Object.entries(bonus)) {
        const score = Number(r && r.score) || 0;
        if (score > CAP) {
          suspects.push({ path: `scores/${cid}/${sid}/bonus/${rid}`, score, content: (r && r.content) || '' });
        }
      }
    }
  }

  // 2) staffBonus/{uid}/{recId}
  const sbSnap = await db.ref('staffBonus').get();
  const sb = sbSnap.val() || {};
  for (const [uid, recs] of Object.entries(sb)) {
    for (const [rid, r] of Object.entries(recs || {})) {
      const score = Number(r && r.score) || 0;
      if (score > CAP) {
        suspects.push({ path: `staffBonus/${uid}/${rid}`, score, content: (r && r.reason) || '' });
      }
    }
  }

  if (!suspects.length) {
    console.log('Không tìm thấy bản ghi bonus nghi vấn nào (điểm dương > ' + CAP + ').');
    process.exit(0);
  }

  console.log(`Tìm thấy ${suspects.length} bản ghi nghi vấn (điểm dương > ${CAP}):`);
  suspects.forEach((s, i) => console.log(`  ${i + 1}. [${s.score}] ${s.path}  ${s.content ? '— ' + s.content : ''}`));

  if (!APPLY) {
    console.log('\nĐây là DRY-RUN. Chưa xóa gì. Chạy lại với --apply để xóa các bản ghi trên.');
    process.exit(0);
  }

  const updates = {};
  suspects.forEach(s => { updates[s.path] = null; });
  await db.ref().update(updates);
  console.log(`\nĐã xóa ${suspects.length} bản ghi bonus giả.`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
