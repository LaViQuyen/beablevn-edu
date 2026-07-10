/**
 * Đếm lượt dùng IELTS Coach theo ngày, CỨNG trong Realtime DB (transaction chống race).
 * Giữ đúng semantics của suite Flask (authcore.check_and_count): đếm TRƯỚC khi gọi model,
 * không hoàn lượt khi lỗi. Chỉ role student bị giới hạn; staff/admin dùng tự do.
 * Trần lượt đọc từ coachConfig/limits/{tool}, Bak chỉnh trực tiếp trên DB không cần deploy.
 */
const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");

const DEFAULT_LIMITS = { speaking: 80, writing: 40, intro: 40, tts: 200 };

// Khoá ngày YYYY-MM-DD theo giờ Việt Nam (en-CA cho format ISO)
function vnDateKey(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

async function checkAndCount(uid, role, tool) {
  if (role !== "student") return; // staff/admin không giới hạn
  const db = admin.database();
  let limit = DEFAULT_LIMITS[tool] != null ? DEFAULT_LIMITS[tool] : 40;
  try {
    const snap = await db.ref(`coachConfig/limits/${tool}`).get();
    const v = Number(snap.val());
    if (snap.exists() && Number.isFinite(v) && v >= 0) limit = v;
  } catch (e) {
    // Đọc config lỗi thì dùng default, không chặn học viên vì lỗi hạ tầng
  }
  const ref = db.ref(`coachUsage/${uid}/${vnDateKey()}/${tool}`);
  const { committed } = await ref.transaction((cur) => {
    if ((cur || 0) >= limit) return; // abort: chạm trần
    return (cur || 0) + 1;
  });
  if (!committed) {
    throw new HttpsError(
      "resource-exhausted",
      "Em đã đạt giới hạn lượt luyện hôm nay của công cụ này. Mai luyện tiếp nhé."
    );
  }
}

module.exports = { checkAndCount, vnDateKey, DEFAULT_LIMITS };
