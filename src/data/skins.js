// ============================================================
// DANH MỤC SKIN (AVATAR) — Cửa hàng đổi skin bằng BAVN Credits
// ------------------------------------------------------------
// Thiết kế CHỦ ĐÍCH (behavioral econ + sư phạm của Bak):
//  - KHÔNG hộp ngẫu nhiên / loot box (tránh cơ chế cờ bạc với trẻ).
//  - Giá CỐ ĐỊNH, thấy rõ trước khi mua.
//  - 2 cách mở khóa skin:
//      'purchase'  → đổi bằng Credit (thưởng nỗ lực, học viên chủ động tiêu).
//      'milestone' → MIỄN PHÍ, tự mở khi đạt mốc Bonus tích lũy (thưởng kiên trì,
//                    công bằng với học viên yếu, giảm overjustification).
//  - Avatar dạng emoji + gradient + viền → không cần host ảnh, chạy ngay local.
//
// Catalog có thể quản lý trong DB (node `skins/`) qua khu Admin.
// File này là BỘ MẶC ĐỊNH (seed) khi DB chưa có skin nào.
// ============================================================

export const RARITY_META = {
  common:    { label: 'Phổ thông',   cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  rare:      { label: 'Hiếm',        cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  epic:      { label: 'Cực hiếm',    cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  legendary: { label: 'Huyền thoại', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export const RARITY_ORDER = { common: 0, rare: 1, epic: 2, legendary: 3 };

// Bộ skin mặc định (seed). gradient: [từ, đến]. unlock mặc định = 'purchase'.
export const SKINS = [
  // ----- MẶC ĐỊNH (miễn phí, ai cũng có) -----
  { id: 'default', name: 'Mầm Xanh', rarity: 'common', cost: 0, order: 0,
    emoji: '🌱', gradient: ['#2B6830', '#3D8B47'], ring: '#2B6830' },

  // ----- PHỔ THÔNG (mua, giá thấp) -----
  { id: 'book',    name: 'Mọt Sách',     rarity: 'common', cost: 5,  order: 1,
    emoji: '📚', gradient: ['#0EA5E9', '#0369A1'], ring: '#0EA5E9' },
  { id: 'pencil',  name: 'Bút Chì Vàng', rarity: 'common', cost: 5,  order: 2,
    emoji: '✏️', gradient: ['#F59E0B', '#D97706'], ring: '#F59E0B' },
  { id: 'leaf',    name: 'Lá Bốn Cánh',  rarity: 'common', cost: 8,  order: 3,
    emoji: '🍀', gradient: ['#22C55E', '#15803D'], ring: '#22C55E' },

  // ----- HIẾM (mua, giá vừa) -----
  { id: 'rocket',  name: 'Tên Lửa',      rarity: 'rare', cost: 15, order: 4,
    emoji: '🚀', gradient: ['#6366F1', '#4338CA'], ring: '#6366F1' },
  { id: 'brain',   name: 'Siêu Trí Tuệ', rarity: 'rare', cost: 18, order: 5,
    emoji: '🧠', gradient: ['#EC4899', '#BE185D'], ring: '#EC4899' },
  { id: 'owl',     name: 'Cú Đêm',       rarity: 'rare', cost: 20, order: 6,
    emoji: '🦉', gradient: ['#0D9488', '#0F766E'], ring: '#14B8A6' },

  // ----- CỰC HIẾM (mua, giá cao) -----
  { id: 'fire',    name: 'Ngọn Lửa',     rarity: 'epic', cost: 40, order: 7,
    emoji: '🔥', gradient: ['#EF4444', '#B91C1C'], ring: '#F97316' },
  { id: 'diamond', name: 'Kim Cương',    rarity: 'epic', cost: 50, order: 8,
    emoji: '💎', gradient: ['#06B6D4', '#0E7490'], ring: '#22D3EE' },
  { id: 'crown',   name: 'Vương Miện',   rarity: 'epic', cost: 60, order: 9,
    emoji: '👑', gradient: ['#A855F7', '#7E22CE'], ring: '#C084FC' },

  // ----- HUYỀN THOẠI (mua, giá rất cao) -----
  { id: 'dragon',  name: 'Rồng Lửa',     rarity: 'legendary', cost: 100, order: 10,
    emoji: '🐉', gradient: ['#DC2626', '#7C2D12'], ring: '#FBBF24' },
  { id: 'galaxy',  name: 'Thiên Hà',     rarity: 'legendary', cost: 120, order: 11,
    emoji: '🌌', gradient: ['#4F46E5', '#1E1B4B'], ring: '#818CF8' },
  { id: 'trophy',  name: 'Quán Quân',    rarity: 'legendary', cost: 150, order: 12,
    emoji: '🏆', gradient: ['#F59E0B', '#92400E'], ring: '#FCD34D' },

  // ----- CỘT MỐC (miễn phí — tự mở khi đạt Bonus tích lũy) -----
  { id: 'sprout_star', name: 'Khởi Đầu Vững', rarity: 'rare', cost: 0, order: 13,
    emoji: '🌟', gradient: ['#10B981', '#047857'], ring: '#34D399',
    unlock: 'milestone', threshold: 50 },
  { id: 'medal',       name: 'Huy Chương Bền Bỉ', rarity: 'epic', cost: 0, order: 14,
    emoji: '🎖️', gradient: ['#F97316', '#9A3412'], ring: '#FDBA74',
    unlock: 'milestone', threshold: 150 },
  { id: 'master',      name: 'Bậc Thầy Học Tập', rarity: 'legendary', cost: 0, order: 15,
    emoji: '🧙', gradient: ['#7C3AED', '#4C1D95'], ring: '#C4B5FD',
    unlock: 'milestone', threshold: 400 },
];

export const DEFAULT_SKINS = SKINS;
export const DEFAULT_SKIN_ID = 'default';

// Chuẩn hoá 1 skin (từ DB hoặc default) về CÙNG shape để render & xử lý logic.
// Hỗ trợ cả gradient:[from,to] (default) lẫn gradFrom/gradTo (DB nhập tay).
export const normalizeSkin = (s = {}, id) => ({
  id: id ?? s.id,
  name: s.name || 'Skin',
  rarity: s.rarity || 'common',
  cost: Number(s.cost) || 0,
  emoji: s.emoji || '',
  gradFrom: s.gradFrom || (Array.isArray(s.gradient) ? s.gradient[0] : '#2B6830'),
  gradTo:   s.gradTo   || (Array.isArray(s.gradient) ? s.gradient[1] : '#3D8B47'),
  ring: s.ring || '#2B6830',
  available: s.available !== false,
  unlock: s.unlock === 'milestone' ? 'milestone' : 'purchase',
  threshold: Number(s.threshold) || 0,
  order: Number(s.order) || 0,
  // Skin có được cấp cho NHÂN SỰ (staff/giáo viên) dùng không — do Admin bật/tắt.
  // Mặc định FALSE: nhân sự KHÔNG tự có skin, phải được Admin cho phép.
  staffAllowed: !!s.staffAllowed,
});

// Lookup skin mặc định theo id (fallback khi không truyền object).
export const getSkin = (id) =>
  normalizeSkin(SKINS.find(s => s.id === id) || SKINS[0]);

// Sắp xếp danh mục: theo order → hạng → giá.
export const sortSkins = (list) =>
  [...list].sort((a, b) =>
    (a.order - b.order) ||
    (RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]) ||
    (a.cost - b.cost));

// DANH HIỆU học viên = tên skin MỐC có threshold cao nhất mà học viên ĐÃ sở hữu.
// ownedObj: { skinId: true }; catalog: danh mục skin (default hoặc DB đã normalize hoặc raw).
// Trả null nếu chưa mở mốc nào → hiển thị nơi gọi tự quyết (vd "Tân Binh").
export const getTitle = (ownedObj = {}, catalog = SKINS) => {
  const earned = catalog
    .map(x => normalizeSkin(x))
    .filter(x => x.unlock === 'milestone' && ownedObj[x.id]);
  if (!earned.length) return null;
  earned.sort((a, b) => b.threshold - a.threshold);
  return earned[0].name;
};
