// ============================================================
// UTIL DÙNG CHUNG cho SỔ LIÊN LẠC ONLINE (Học viên + Phụ huynh)
// Gom logic tính chuyên cần / điểm số / lọc báo bài về MỘT chỗ
// để 2 cổng (student, parent) không lệch công thức.
// ============================================================

// classIds trong DB lúc là array, lúc là object (dữ liệu cũ) → luôn chuẩn hóa về mảng
export const normClassIds = (classIds) =>
  classIds ? (Array.isArray(classIds) ? classIds : Object.values(classIds)) : [];

// Giá trị điểm danh đa hình: string status HOẶC object {status, note}
const attStatusOf = (rec) => (typeof rec === 'object' && rec !== null ? rec.status : rec);
const attNoteOf = (rec) => (typeof rec === 'object' && rec !== null ? rec.note || '' : '');

// ------------------------------------------------------------
// CHUYÊN CẦN của 1 học viên trong 1 lớp.
// Công thức chuẩn (khớp Dashboard học viên + ClassList staff):
//   rate = (present + late) / total ; chưa có buổi nào → rate = null
// ------------------------------------------------------------
export const computeAttendance = (attendanceData, classId, studentId) => {
  const classDates = (attendanceData || {})[classId] || {};
  let present = 0, late = 0, excused = 0, absent = 0, total = 0;
  const history = [];
  Object.entries(classDates).forEach(([date, sessionData]) => {
    const rec = sessionData ? sessionData[studentId] : null;
    if (!rec) return;
    total++;
    const status = attStatusOf(rec);
    if (status === 'present') present++;
    else if (status === 'late') late++;
    else if (status === 'excused') excused++;
    else absent++;
    history.push({ date, status, note: attNoteOf(rec) });
  });
  history.sort((a, b) => new Date(b.date) - new Date(a.date));
  const rate = total > 0 ? Math.round(((present + late) / total) * 100) : null;
  return { rate, total, present, late, excused, absent, history };
};

// ------------------------------------------------------------
// ĐIỂM SỐ của 1 học viên trong 1 lớp, tách theo 4 loại.
// score trong DB là số HOẶC chuỗi → luôn Number() + guard NaN.
// ------------------------------------------------------------
export const SCORE_TYPES = ['bonus', 'assignment', 'formative', 'summative'];

export const SCORE_META = {
  bonus:      { label: 'Điểm Bonus',  icon: '⭐', meaning: 'Tích cực, phát biểu & xây dựng bài', color: '#f59e0b', chip: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
  assignment: { label: 'Assignment',  icon: '📝', meaning: 'Bài tập về nhà', color: '#10b981', chip: 'bg-green-50 text-green-700 border-green-200' },
  formative:  { label: 'Formative',   icon: '📊', meaning: 'Kiểm tra trên lớp', color: '#3D8B47', chip: 'bg-primary-light text-green-800 border-green-200' },
  summative:  { label: 'Summative',   icon: '🎯', meaning: 'Thi giữa khóa (MMT) & cuối khóa (EOMT)', color: '#1E5225', chip: 'bg-primary-light text-green-900 border-green-300' },
};

const toNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export const computeClassScores = (scoresData, classId, studentId) => {
  const myTypes = ((scoresData || {})[classId] || {})[studentId] || {};
  const byType = {};
  SCORE_TYPES.forEach((type) => {
    const records = Object.entries(myTypes[type] || {})
      .map(([id, val]) => ({ id, ...val }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const total = records.reduce((s, r) => s + toNum(r.score), 0);
    const avg = records.length ? total / records.length : 0;
    byType[type] = { records, total, avg };
  });

  // Điểm tổng kết theo trọng số (khớp công thức MyGrades):
  // Assignment 10% + Formative 20% + MMT 30% + EOMT 40%
  const avgOf = (recs) => (recs.length ? recs.reduce((s, r) => s + toNum(r.score), 0) / recs.length : 0);
  const mmt = byType.summative.records.filter((r) => r.examType === 'MMT');
  const eomt = byType.summative.records.filter((r) => r.examType === 'EOMT');
  const gpa = byType.assignment.avg * 0.10 + byType.formative.avg * 0.20 + avgOf(mmt) * 0.30 + avgOf(eomt) * 0.40;
  const hasAnyGrade = byType.assignment.records.length || byType.formative.records.length || byType.summative.records.length;

  return { byType, gpa, hasAnyGrade };
};

// ------------------------------------------------------------
// LỌC THÔNG BÁO hiển thị được cho 1 học viên (dùng cho mục Báo bài
// của Sổ liên lạc và trang Thông báo phụ huynh). Áp cùng bộ lọc
// với trang Thông báo học viên: phạm vi lớp + khóa lockedAt + bảo lưu.
// student: { classIds, lockedAt, reserve }
// ------------------------------------------------------------
export const visibleNotifications = (notificationList, student) => {
  const myClassIds = normClassIds(student?.classIds);
  let list = (notificationList || []).filter(
    (n) => n.scope === 'all' || myClassIds.includes(n.scope)
  );
  if (student?.lockedAt) {
    const lockTime = new Date(student.lockedAt).getTime();
    list = list.filter((n) => new Date(n.date).getTime() <= lockTime);
  }
  const rsv = student?.reserve;
  if (rsv?.start && rsv?.end) {
    const now = Date.now();
    const startT = new Date(rsv.start + 'T00:00:00').getTime();
    const endT = new Date(rsv.end + 'T23:59:59').getTime();
    if (now >= startT && now <= endT) {
      list = list.filter((n) => new Date(n.date).getTime() < startT);
    }
  }
  return list.sort((a, b) => new Date(b.date) - new Date(a.date));
};

// Báo bài của 1 lớp = thông báo dạng content có nhãn 'báo bài' trong phạm vi lớp đó
export const homeworkOfClass = (visibleList, classId) =>
  (visibleList || []).filter((n) => n.type !== 'link' && n.label === 'báo bài' && n.scope === classId);

// Link điểm danh mới nhất của 1 lớp (GV đăng thông báo dạng link "Link điểm danh")
export const latestAttendanceLink = (visibleList, classId) =>
  (visibleList || []).find(
    (n) => n.type === 'link' && n.scope === classId && /điểm danh/i.test(n.title || '')
  ) || null;

// Màu chuyên cần theo ngưỡng (đồng bộ các trang hiện có)
export const attendanceColor = (rate) => {
  if (rate === null) return { bar: 'bg-slate-300', text: 'text-slate-400' };
  if (rate >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-600' };
  if (rate >= 60) return { bar: 'bg-amber-400', text: 'text-amber-600' };
  return { bar: 'bg-red-500', text: 'text-red-600' };
};
