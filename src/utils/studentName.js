// Hiển thị tên học viên cho GV/CCO: "Tên tiếng Việt - English Name".
// Nếu chưa nhập English name thì chỉ hiện tên tiếng Việt.
export const fmtStudentName = (name, englishName) => {
  const vn = (name || '').trim();
  const en = (englishName || '').trim();
  if (!vn) return '(chưa có tên)';
  return en ? `${vn} - ${en}` : vn;
};

// Tra English name từ map theo mã học viên (dùng cho trang chỉ có studentCode như Hộp thư).
// enMap: { [studentCode]: englishName }
export const withEnByCode = (name, studentCode, enMap) => {
  const en = (enMap && studentCode) ? enMap[studentCode] : '';
  return fmtStudentName(name, en);
};

// Lấy tháng sinh (1-12) từ "dd/mm/yyyy" hoặc "yyyy-mm-dd"; null nếu không hợp lệ
const monthOf = (s) => {
  if (!s || typeof s !== 'string') return null;
  const t = s.trim();
  let m;
  if (t.includes('/')) { const p = t.split('/'); if (p.length !== 3) return null; m = +p[1]; }
  else if (t.includes('-')) { const p = t.split('-'); if (p.length !== 3) return null; m = +p[1]; }
  else return null;
  return (m >= 1 && m <= 12) ? m : null;
};

// Thông báo sinh nhật trong tháng cho học viên / phụ huynh.
// Trả { cake: bool, message: string|null } để hiển thị icon 🎂 + dòng thông báo.
export const getBirthdayNotice = (student) => {
  const cur = new Date().getMonth() + 1;
  const stB = monthOf(student?.birthDate) === cur;
  const phB = monthOf(student?.parent?.birthDate) === cur;
  if (!stB && !phB) return { cake: false, message: null };
  const stName = (student?.name || 'học viên').trim();
  const phName = (student?.parent?.name || 'phụ huynh').trim();
  let message;
  if (stB && phB) message = `Tháng này là sinh nhật của bạn ${stName} và ${phName}`;
  else if (stB) message = `Tháng này là sinh nhật của bạn ${stName}`;
  else message = `Tháng này là sinh nhật của ${phName}`;
  return { cake: true, message };
};
