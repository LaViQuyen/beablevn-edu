// ============================================================
// Tiện ích BẢO LƯU dùng chung (admin / GV / học viên)
// user.reserve = { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD', createdBy, createdAt, weekReminderSent }
// ============================================================

// Trả về trạng thái bảo lưu HIỆN TẠI của 1 học viên:
//  - 'active'  : đang trong thời gian bảo lưu
//  - 'ending'  : đang bảo lưu và còn <= 7 ngày là hết
//  - null      : không bảo lưu (chưa tới ngày, hoặc đã hết -> tự bỏ)
export const getReserveStatus = (user) => {
  const r = user?.reserve;
  if (!r || !r.start || !r.end) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(r.start + 'T00:00:00');
  const end = new Date(r.end + 'T23:59:59');
  if (isNaN(start) || isNaN(end)) return null;

  if (today < start || today > end) return null; // ngoài khoảng bảo lưu -> coi như không bảo lưu

  const weekBefore = new Date(r.end + 'T00:00:00');
  weekBefore.setDate(weekBefore.getDate() - 7);
  return today >= weekBefore ? 'ending' : 'active';
};

// Nhãn + màu badge (khác màu đỏ của "Vắng nhiều")
export const RESERVE_LABEL = {
  active: 'Đang bảo lưu',
  ending: 'Sắp hết bảo lưu',
};

// dùng cho badge nền nhạt, màu VÀNG (khác màu đỏ "Vắng nhiều")
export const RESERVE_BADGE = {
  active: 'text-yellow-700 bg-yellow-100 border-yellow-300',
  ending: 'text-amber-700 bg-amber-100 border-amber-400',
};

// Tô viền + nền thẻ học viên khi đang bảo lưu (giống "Vắng nhiều" nhưng vàng)
export const RESERVE_CARD = 'border-yellow-300 bg-yellow-50/40';

// Định dạng ngày dd/mm/yyyy từ chuỗi YYYY-MM-DD
export const fmtReserveDate = (s) => {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return d && m && y ? `${d}/${m}/${y}` : s;
};
