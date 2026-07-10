/**
 * Lưu lịch sử phiên luyện IELTS Coach vào coachHistory/{uid}/{tool}/{pushId}.
 * CHỈ server ghi (admin SDK bypass rules); client chỉ đọc của mình.
 * Giữ tối đa MAX_RECORDS bản ghi mới nhất mỗi tool mỗi học viên,
 * transcript dài bị cắt để record không phình DB.
 */
const admin = require("firebase-admin");

const MAX_RECORDS = 50;
const TRANSCRIPT_CAP = 600;

function truncateText(s, cap = TRANSCRIPT_CAP) {
  return typeof s === "string" && s.length > cap ? s.slice(0, cap) + "…" : s;
}

// Cắt gọn các field text dài trong record (đệ quy nông, đủ cho schema coach)
function slimRecord(value) {
  if (typeof value === "string") return truncateText(value);
  if (Array.isArray(value)) return value.map(slimRecord);
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) out[k] = slimRecord(value[k]);
    return out;
  }
  return value;
}

async function saveHistory(uid, tool, record) {
  const db = admin.database();
  const ref = db.ref(`coachHistory/${uid}/${tool}`);
  await ref.push({
    ...slimRecord(record),
    // Wire-format server timestamp: tương đương ServerValue.TIMESTAMP nhưng
    // không phụ thuộc static prop (proxy của emulator không forward prop này)
    at: { ".sv": "timestamp" },
  });
  // Prune: push key tăng dần theo thời gian nên sort key = sort thời gian
  const snap = await ref.orderByKey().get();
  const keys = Object.keys(snap.val() || {}).sort();
  if (keys.length > MAX_RECORDS) {
    const updates = {};
    keys.slice(0, keys.length - MAX_RECORDS).forEach((k) => {
      updates[k] = null;
    });
    await ref.update(updates);
  }
}

module.exports = { saveHistory, MAX_RECORDS };
