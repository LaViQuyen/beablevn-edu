// src/scenery.js
import Phaser from 'phaser';
import { H } from './config';

// Xây dựng phông nền tương tác (Parallax Scenery) theo cấp học
export function buildScenery(scene, worldW, rank = 1) {
  const W = scene.scale.width; // bề rộng canvas thực (động theo màn hình)
  // 1. BẢNG MÀU THỜI GIAN THEO ĐỘ TUỔI (Từ sáng sớm ngây thơ -> Đêm tối trưởng thành)
  const palettes = {
    1: { skyTop: 0x6dd5ed, skyBot: 0x2193b0, celestial: 0xFFFBE0, mount: 0x489670, hill: 0x6FCB52, cloudTint: 0xffffff }, // Mầm non: Sáng tinh sương rực rỡ
    2: { skyTop: 0x2980B9, skyBot: 0x6DD5FA, celestial: 0xFFD23F, mount: 0x5C9EAD, hill: 0x5FB948, cloudTint: 0xffffff }, // Tiểu học: Trưa nắng trong xanh
    3: { skyTop: 0x4CA1AF, skyBot: 0xC4E0E5, celestial: 0xF3904F, mount: 0x66A5AD, hill: 0x8DC26F, cloudTint: 0xfff0e0 }, // THCS: Chiều tà dịu nhẹ
    4: { skyTop: 0x8A2387, skyBot: 0xE94057, celestial: 0xF27121, mount: 0x5A3446, hill: 0x3F2B96, cloudTint: 0xffc4b3 }, // THPT: Hoàng hôn rực lửa (áp lực)
    5: { skyTop: 0x0F2027, skyBot: 0x203A43, celestial: 0xE0EAFC, mount: 0x16222A, hill: 0x2C3E50, cloudTint: 0xaaaaaa }  // Đại học: Đêm tĩnh mịch, trầm lắng
  };

  const p = palettes[rank] || palettes[1];

  // --- 2. LỚP BẦU TRỜI ---
  const sky = scene.add.graphics().setScrollFactor(0).setDepth(-50);
  sky.fillGradientStyle(p.skyTop, p.skyTop, p.skyBot, p.skyBot, 1);
  sky.fillRect(0, 0, worldW > W ? worldW : W, H);

  // --- 3. SAO TRỜI (Chỉ dành cho Đại Học - ban đêm) ---
  if (rank === 5) {
    const stars = scene.add.graphics().setScrollFactor(0.02).setDepth(-49);
    stars.fillStyle(0xffffff, 0.8);
    for(let i = 0; i < 150; i++) {
      stars.fillCircle(Phaser.Math.Between(0, worldW), Phaser.Math.Between(0, H/2 + 80), Phaser.Math.FloatBetween(0.5, 2));
    }
  }

  // --- 4. MẶT TRỜI / MẶT TRĂNG CÓ HIỆU ỨNG TỎA SÁNG (GLOW) ---
  const celestialX = W - 180;
  const celestialY = 100;
  // Lớp hào quang (Glow mờ dần ra ngoài)
  for(let i = 4; i >= 1; i--) {
    scene.add.circle(celestialX, celestialY, 35 + i * 18, p.celestial, 0.1 / i)
         .setScrollFactor(0.03).setDepth(-49).setBlendMode(Phaser.BlendModes.ADD);
  }
  // Lõi chính
  scene.add.circle(celestialX, celestialY, 40, p.celestial, 0.95).setScrollFactor(0.03).setDepth(-49);

  // --- 5. MÂY TRÔI LỮNG LỜ (Chuyển động mượt mà) ---
  for (let i = 0; i < 10; i++) {
    let cl = scene.add.image(Phaser.Math.Between(50, worldW), Phaser.Math.Between(30, 180), 'cloud')
      .setScrollFactor(Phaser.Math.FloatBetween(0.08, 0.15)) // Mỗi đám mây trôi tốc độ khác nhau
      .setDepth(-48)
      .setAlpha(Phaser.Math.FloatBetween(0.5, 0.9))
      .setScale(Phaser.Math.FloatBetween(0.6, 1.4))
      .setTint(p.cloudTint); // Nhuốm màu mây theo ánh sáng bầu trời
    
    // Tạo hiệu ứng mây bồng bềnh tiến/lùi
    scene.tweens.add({
      targets: cl,
      x: cl.x - Phaser.Math.Between(40, 100),
      y: cl.y + Phaser.Math.Between(-15, 15),
      duration: Phaser.Math.Between(12000, 25000),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  // --- 6. THÀNH PHỐ PHÍA XA (Đại diện cho sự trưởng thành & áp lực ở cấp 4 & 5) ---
  if (rank >= 4) {
    const city = scene.add.graphics().setScrollFactor(0.05).setDepth(-47);
    const bColor = rank === 5 ? 0x0a0f18 : 0x2A1B38;
    city.fillStyle(bColor, 0.85);
    for(let x = -100; x < worldW; x += Phaser.Math.Between(40, 90)) {
       let bw = Phaser.Math.Between(45, 100);
       let bh = Phaser.Math.Between(150, 320); // Tòa nhà cao thấp nhấp nhô
       city.fillRect(x, H - bh, bw, bh);
    }
  }

  // --- 7. NÚI XA (Lớp Parallax 0.08) ---
  const mFar = scene.add.graphics().setScrollFactor(0.08).setDepth(-45);
  mFar.fillStyle(p.mount, 1);
  for (let x = -200; x < worldW; x += 350) {
    mFar.fillTriangle(x, H, x + 250, H - 180 - Math.random() * 90, x + 500, H);
  }

  // --- 8. ĐỒI GẦN (Lớp Parallax 0.18 - Vẽ bo tròn mềm mại) ---
  const hf = scene.add.graphics().setScrollFactor(0.18).setDepth(-40);
  hf.fillStyle(p.hill, 1);
  for (let x = -150; x < worldW; x += 300) {
    // Dùng hình tròn lớn dạt xuống đáy tạo đường cong mượt thay vì tam giác thô
    hf.fillCircle(x + 150, H + 30, 240);
  }

  // --- 9. BỤI CÂY SÁT ĐƯỜNG ĐI (Lớp Parallax 1 - Trôi sát theo nền đất) ---
  const bushTint = rank >= 4 ? 0x888888 : 0xffffff; // Tối đi khi vào lúc chạng vạng/đêm
  for (let x = 100; x < worldW; x += Phaser.Math.Between(250, 600)) {
    scene.add.image(x, H - 44, 'bush')
      .setScrollFactor(1)
      .setDepth(-10)
      .setScale(Phaser.Math.FloatBetween(0.7, 1.2))
      .setTint(bushTint);
  }
}