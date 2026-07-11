import React from 'react';
import { getSkin, normalizeSkin } from '../data/skins';

// ============================================================
// StudentAvatar, render avatar học viên theo skin.
// Dùng lại ở: Cửa hàng Skin, Admin quản lý Skin, Hồ sơ, lịch sử, Bảng Vinh Danh.
//
// ĐẶC QUYỀN SKIN MỐC: skin mở khóa bằng THÀNH TÍCH (unlock='milestone') được
// thêm VIỀN ÁNH KIM (vàng) bao ngoài → nổi bật hơn skin mua bằng tiền ở mọi nơi.
// Đây là đặc quyền hiển thị, KHÔNG gắn cho skin mua bằng Credit (tránh pay-to-win).
//
// Props (truyền 1 trong 2):
//   skin   : object skin ĐẦY ĐỦ (ưu tiên, dùng cho skin DB do Admin tạo)
//   skinId : id skin mặc định (fallback tra trong bộ default)
//   name   : tên học viên, hiện ký tự đầu khi skin không có emoji
//   size   : đường kính px (mặc định 56)
//   ring   : có vẽ viền (frame) theo màu skin không (mặc định true)
// ============================================================
const StudentAvatar = ({ skin, skinId = 'default', name = '', size = 56, ring = true }) => {
  const s = skin ? normalizeSkin(skin) : getSkin(skinId);
  const isMilestone = s.unlock === 'milestone';

  // Viền: skin thường = 1 vòng màu skin; skin MỐC = thêm vòng ánh kim bao ngoài
  let boxShadow = 'none';
  if (ring) {
    boxShadow = isMilestone
      ? `0 0 0 2px #fff, 0 0 0 4px ${s.ring}, 0 0 0 6px #FCD34D, 0 0 10px 2px rgba(251,191,36,0.45)`
      : `0 0 0 2px #fff, 0 0 0 4px ${s.ring}`;
  }

  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 select-none"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${s.gradFrom}, ${s.gradTo})`,
        boxShadow,
        fontSize: size * 0.5,
        lineHeight: 1,
      }}
      title={isMilestone ? `${s.name} · Skin thành tích` : s.name}
    >
      {s.emoji
        ? <span role="img" aria-label={s.name}>{s.emoji}</span>
        : <span className="font-extrabold text-white" style={{ fontSize: size * 0.42 }}>{name?.charAt(0) || '?'}</span>}
    </div>
  );
};

export default StudentAvatar;
