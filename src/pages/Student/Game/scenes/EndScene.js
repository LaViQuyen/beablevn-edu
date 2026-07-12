import Phaser from 'phaser';
import { H, LEVELS, RANKS, FONT, BRAND, heartsFor } from '../config';
import { initAudio } from '../audio';
import { LEVEL_STORY } from '../story';

// Vũ khí mở khóa khi lên mỗi cấp (dùng để ăn mừng khoảnh khắc thăng cấp).
const NEW_WEAPON = { 2: 'Vở', 3: 'Bút', 4: 'Kiến Thức', 5: 'Kỹ Năng & Trình Độ' };

export class End extends Phaser.Scene {
  constructor(){ super('End'); }
  init(d){
    this.win = d.win; this.score = d.score || 0; this.stage = d.stage || 0;
    this.targetPage = d.targetPage || 0;
    this.rankUp = !!d.rankUp;         // vừa vượt boss lên cấp?
    this.newRank = d.newRank || 1;    // cấp mới sau khi thắng
  }
  create(){
    const SW = this.scale.width;
    this.cameras.main.setBackgroundColor(this.win ? 0x2B6830 : 0x5c1020); // thua: đỏ đô trầm thay vì đỏ máu gắt
    if(this.win) this.add.particles(0, 0, 'star', { x: SW/2, y: H, lifespan:3000, speed:{min:200,max:400}, angle:{min:220,max:320}, gravityY:300, scale:{start:1,end:0}, rotate:{min:0,max:360}, frequency:100 });

    this.add.rectangle(SW/2, H/2, 540, 340, 0x000000, 0.7).setStrokeStyle(4, 0xffffff, 0.25);

    let endMsg = this.win ? 'HÀNH TRÌNH TIẾP TỤC' : 'THẤT BẠI!';
    if(this.win && LEVELS[this.stage] && LEVELS[this.stage].isCollectStage) endMsg = 'ĐÃ SỞ HỮU LỄ NGHĨA & THÁI ĐỘ!';
    if(this.win && this.rankUp) endMsg = 'THĂNG CẤP!';
    this.add.text(SW/2, H/2 - 96, endMsg, { fontFamily:FONT, fontSize:'30px', color:'#FFD23F', fontStyle:'900' }).setOrigin(0.5);

    // Ăn mừng lên cấp: tên cấp mới + phần thưởng (thêm tim + vũ khí mới), cú dopamine chính của vòng lặp.
    if(this.win && this.rankUp){
      const w = NEW_WEAPON[this.newRank];
      const reward = '+1 tim' + (w ? '  ·  mở khóa vũ khí ' + w : '');
      this.add.text(SW/2, H/2 - 54, 'Đã lên ' + (RANKS[this.newRank-1] || '') + '   ' + '❤️'.repeat(heartsFor(this.newRank)), { fontFamily:FONT, fontSize:'19px', color:'#7CF0A0', fontStyle:'bold' }).setOrigin(0.5);
      this.add.text(SW/2, H/2 - 26, reward, { fontFamily:FONT, fontSize:'15px', color:'#ffffff' }).setOrigin(0.5);
    }

    this.add.text(SW/2, H/2 + (this.rankUp ? 14 : 2), '⭐ Điểm thưởng lượt này: ' + this.score, { fontFamily:FONT, fontSize:'20px', color:'#fff' }).setOrigin(0.5);

    // Đúc kết bài học của ải vừa qua (củng cố thông điệp lúc trẻ đã thư giãn). Bỏ qua khi vừa thăng cấp
    // để không chen chúc màn ăn mừng.
    if(this.win && !this.rankUp && LEVEL_STORY[this.stage]){
      this.add.text(SW/2, H/2 + 38, '"' + LEVEL_STORY[this.stage] + '"', { fontFamily:FONT, fontSize:'12px', color:'#FCE4EC', fontStyle:'italic', align:'center', wordWrap:{width:480} }).setOrigin(0.5);
    }

    const btn = this.add.rectangle(SW/2, H/2 + 78, 260, 60, this.win ? BRAND.forestNum : 0xd63d54, 1).setStrokeStyle(2, 0xffffff, 0.5).setInteractive({useHandCursor:true});
    // Nhãn trung thực: nút luôn đưa về Bản Đồ (trước đây ghi "Thử Lại" gây hiểu nhầm chơi lại miễn phí).
    this.add.text(SW/2, H/2 + 78, '🗺 Về Bản Đồ', { fontFamily:FONT, fontSize:'22px', color:'#fff', fontStyle:'bold' }).setOrigin(0.5);
    btn.on('pointerdown', ()=> { initAudio(); this.scene.start('Map', { page: this.targetPage }); });
  }
}
