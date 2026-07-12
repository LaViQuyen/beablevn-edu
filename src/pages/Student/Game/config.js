// Cau hinh game: kich thuoc, danh sach 25 ai, dinh nghia quai, so tim moi cap
export const W = 960, H = 540;
export const RANKS = ['Mầm Non','Tiểu Học','THCS','THPT','Đại Học'];

// Font thương hiệu dùng cho MỌI chữ trong canvas (đồng bộ với UI React, tránh rơi về Courier mặc định của Phaser).
export const FONT = 'Be Vietnam Pro';
// Bảng màu thương hiệu (Forest Green). Dùng cho UI trung tính; màu phe địch/cốt truyện giữ nguyên theo Design System.
export const BRAND = { forest: '#2B6830', darkForest: '#1E5225', forestNum: 0x2B6830, darkForestNum: 0x1E5225 };

export const LEVELS = [
  { name: 'Lớp Mầm', rank: 1, gm: 'slippery' }, { name: 'Lớp Chồi', rank: 1, gm: 'stealth' }, { name: 'Lớp Lá', rank: 1, gm: 'thief' }, { name: 'Boss: Trùm Vòi Vĩnh', rank: 1, isBoss: true },
  { name: 'Ải Ẩn: Thử Thách Sưu Tầm', rank: 1, isCollectStage: true },
  { name: 'Lớp 1', rank: 2, gm: 'ink' }, { name: 'Lớp 2', rank: 2, gm: 'hideHud' }, { name: 'Lớp 3', rank: 2, gm: 'clones' }, { name: 'Lớp 4', rank: 2, gm: 'slowAura' }, { name: 'Lớp 5', rank: 2, gm: 'reverse' }, { name: 'Boss: Lỗi Chính Tả', rank: 2, isBoss: true },
  { name: 'Lớp 6', rank: 3, gm: 'armor' }, { name: 'Lớp 7', strokeThickness: 6, rank: 3 }, { name: 'Lớp 8', rank: 3, gm: 'invisible' }, { name: 'Lớp 9', rank: 3, gm: 'reflect' }, { name: 'Boss: Đề Thi Vào 10', rank: 3, isBoss: true },
  { name: 'Lớp 10', rank: 4, gm: 'stun' }, { name: 'Lớp 11', rank: 4, gm: 'mines' }, { name: 'Lớp 12', rank: 4, gm: 'stamina' }, { name: 'Boss: Đại Ma Vương', rank: 4, isBoss: true },
  { name: 'Năm 1', rank: 5, gm: 'lag' }, { name: 'Năm 2', rank: 5, gm: 'dark' }, { name: 'Năm 3', rank: 5, gm: 'summon' }, { name: 'Năm 4', rank: 5, gm: 'fireWall' }, { name: 'Boss: Tứ Đại Trưởng Lão', rank: 5, isBoss: true }
];

export const MONSTER_DEFS = {
  1: [ { sprite: 'khoc', name: 'Khóc Nhè', behavior: 'walk' }, { sprite: 'giành', name: 'Yêu Không Ngủ', behavior: 'jump', tint: 0xFFB6C1 }, { sprite: 'khoc', name: 'Dành Đồ', behavior: 'chase' } ],
  2: [ { sprite: 'vietau', name: 'Viết Ẩu', behavior: 'fly' }, { sprite: 'khoc', name: 'Quên Nhớ', tint: 0x999999, behavior: 'jump' }, { sprite: 'giành', name: 'Nói Chuyện', tint: 0xFFD700, behavior: 'fly' }, { sprite: 'vietau', name: 'Lười Biếng', behavior: 'walk' }, { sprite: 'khoc', name: 'Lạc Đề', tint: 0x87CEEB, behavior: 'teleport' } ],
  3: [ { sprite: 'm_bully', name: 'Bắt Nạt', behavior: 'chase', scale: 1.2 }, { sprite: 'vietau', name: 'Trốn Học', tint: 0x32CD32, behavior: 'jump_fast' }, { sprite: 'm_phone', name: 'Mê Game', behavior: 'teleport' }, { sprite: 'giành', name: 'Chống Đối', tint: 0x8B0000, behavior: 'jump' } ],
  4: [ { sprite: 'khoc', name: 'Phân Tâm', tint: 0x8A2BE2, behavior: 'fly' }, { sprite: 'm_cheat', name: 'Quay Cóp', behavior: 'fly_drop' }, { sprite: 'm_clock', name: 'Thức Khuya', behavior: 'chase' } ],
  5: [ { sprite: 'vietau', name: 'Rớt Mạng', tint: 0x696969, behavior: 'teleport' }, { sprite: 'khoc', name: 'Cúp Tiết', tint: 0xFF8C00, behavior: 'walk' }, { sprite: 'm_fgrade', name: 'Nợ Môn', scale: 1.3, behavior: 'chase' }, { sprite: 'vietau', name: 'Nước Đến Chân', tint: 0x00BFFF, behavior: 'fly_chase' } ]
};

export function heartsFor(rank){ return 3 + (rank-1); }
