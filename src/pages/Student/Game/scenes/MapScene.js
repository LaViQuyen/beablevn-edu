import Phaser from 'phaser';
import { RANKS, LEVELS, heartsFor } from '../config';
import { initAudio } from '../audio';
import { loadProg, saveProg, EXTERNAL, resetProgressCache } from '../progress';
import { buildScenery } from '../scenery';
import { RANK_STORY } from '../story';

export class MapScene extends Phaser.Scene {
  constructor(){ super('Map'); }
  init(data){ this.page = data.page || 0; }
  create(){
    const SW = this.scale.width;
    initAudio(); const prog = loadProg(); buildScenery(this, SW, prog.rank);

    const title = this.add.text(SW/2, 60, 'HÀNH TRÌNH TRƯỞNG THÀNH', { fontFamily:'Be Vietnam Pro', fontSize:'38px', color:'#ffffff', fontStyle:'900', stroke: '#1E5225', strokeThickness: 6 }).setOrigin(0.5);
    title.setShadow(0, 8, 'rgba(0,0,0,0.4)', 10);
    this.add.text(SW/2, 110, 'Cấp độ: ' + RANKS[prog.rank-1] + '   ·   ' + '❤️'.repeat(heartsFor(prog.rank)), { fontSize:'18px', color:'#ffffff', fontStyle:'bold', backgroundColor:'rgba(0,0,0,0.3)', padding:{x:10, y:5} }).setOrigin(0.5);

    const skillStatus = prog.unlockedSkills ? "ĐÃ SỞ HỮU (Lễ Nghĩa & Thái Độ)" : "CHƯA MỞ KHÓA (Vượt Ải Ẩn Sưu Tầm để nhận)";
    this.add.text(SW/2, 145, `✨ Kỹ năng đặc biệt: ${skillStatus}`, { fontSize:'13px', color: prog.unlockedSkills?'#7ED957':'#FF5A6E', fontStyle:'bold' }).setOrigin(0.5);

    this.add.text(SW/2, 172, '🎟️ Lượt vào ải còn hôm nay: ' + EXTERNAL.playsLeft, { fontSize:'14px', color:'#FFD23F', fontStyle:'bold', backgroundColor:'rgba(0,0,0,0.35)', padding:{x:10,y:4} }).setOrigin(0.5).setDepth(60);

    // Lời mở đầu chương theo cấp học (cốt truyện), nền HỒNG PHẤN, chữ ĐỎ ĐÔ
    this.add.text(SW/2, 204, RANK_STORY[prog.rank-1] || '', { fontFamily:'Be Vietnam Pro', fontSize:'12px', color:'#7B1E3B', fontStyle:'italic bold', align:'center', wordWrap:{width:Math.min(820, SW-80)}, backgroundColor:'rgba(252,228,236,0.96)', padding:{x:12, y:6} }).setOrigin(0.5).setDepth(6);

    const resetBtn = this.add.text(SW - 18, 30, '🔄 Chơi lại từ đầu', { fontSize:'14px', color:'#ffffff', fontStyle:'bold', backgroundColor:'#C0392B', padding:{x:11,y:7} }).setOrigin(1, 0.5).setDepth(60).setInteractive({useHandCursor:true});
    resetBtn.on('pointerover', () => resetBtn.setBackgroundColor('#e04b3a'));
    resetBtn.on('pointerout', () => resetBtn.setBackgroundColor('#C0392B'));
    resetBtn.on('pointerdown', () => {
      if (window.confirm('Xóa toàn bộ tiến trình và chơi lại từ Mầm Non?')) {
        const keepRank = (EXTERNAL.initial && EXTERNAL.initial.rank) || 1;
        EXTERNAL.initial = { rank: keepRank, beaten: {}, unlockedSkills: false };
        saveProg({ rank: keepRank, beaten: {}, unlockedSkills: false }, { reset: true }); // reset CHỦ ĐỘNG: cho phép xóa tiến trình trên DB
        resetProgressCache();
        this.scene.start('Map', { page: 0 });
      }
    });

    const itemsPerPage = 5, totalPages = Math.ceil(LEVELS.length / itemsPerPage);
    const currentLevels = LEVELS.slice(this.page * itemsPerPage, (this.page * itemsPerPage) + itemsPerPage);
    const cardW=140, gap=20, total=currentLevels.length*cardW + (currentLevels.length-1)*gap, x0=(SW-total)/2 + cardW/2;

    currentLevels.forEach((lv,i)=>{
      const globalIndex = (this.page * itemsPerPage) + i;
      let unlocked = globalIndex === 0 || !!prog.beaten[globalIndex-1];
      if (globalIndex === 5) unlocked = !!prog.beaten[3];
      if (globalIndex === 4) unlocked = !!prog.beaten[3];

      const beaten = !!prog.beaten[globalIndex]; const x=x0 + i*(cardW+gap), y=310;
      const card = this.add.container(x, y); const shadow = this.add.rectangle(0, 10, cardW, 180, 0x000000, 0.25);
      let cardBgColor = unlocked ? 0xffffff : 0xdfe6ee; if(lv.isCollectStage) cardBgColor = unlocked ? 0xFFF0F5 : 0xdfe6ee;
      const bg = this.add.rectangle(0, 0, cardW, 180, cardBgColor, 1).setStrokeStyle(4, lv.isCollectStage ? 0xFF69B4 : (unlocked ? 0x3D8B47 : 0xaab6c2)).setInteractive({useHandCursor:unlocked});
      const txtRank = this.add.text(0, -70, lv.isCollectStage ? 'ẢI ẨN' : 'Cấp '+lv.rank, { fontSize:'13px', color: lv.isCollectStage? '#FF69B4' : '#3D8B47', fontStyle:'900' }).setOrigin(0.5);
      const icon = this.add.image(0, -15, unlocked ? (lv.isBoss ? 'boss_'+lv.rank : 'flag') : 'lock').setScale(0.8);
      const txtName = this.add.text(0, 40, lv.name, { fontSize:'15px', color:unlocked?'#1E5225':'#7e8a98', fontStyle:'bold', align:'center', wordWrap:{width:130} }).setOrigin(0.5);
      let statusTxt = 'Khoá'; let sColor = '#8693a1'; if(beaten) { statusTxt = '✓ Đã qua'; sColor = '#2B6830'; } else if(unlocked) { statusTxt = '▶ Vào chơi'; sColor = '#d63d54'; }
      const txtStatus = this.add.text(0, 75, statusTxt, { fontSize:'13px', color:sColor, fontStyle:'bold' }).setOrigin(0.5);
      card.add([shadow, bg, txtRank, icon, txtName, txtStatus]);
      if(unlocked) {
        bg.on('pointerover', () => { this.tweens.add({targets:card, scale:1.08, y:y-10, duration:200, ease:'Back.out'}); });
        bg.on('pointerout', () => { this.tweens.add({targets:card, scale:1, y:y, duration:200, ease:'Power2'}); });
        bg.on('pointerdown',()=> {
          initAudio();
          if (EXTERNAL.playsLeft <= 0) { this.showNoPlay(); return; }
          EXTERNAL.playsLeft -= 1;
          if (EXTERNAL.onConsume) EXTERNAL.onConsume();
          this.scene.start('PlayScene', { stage: globalIndex });
        });
      }
    });

    const btnStyle = { fontSize:'16px', color:'#fff', fontStyle:'bold', backgroundColor:'#3D8B47', padding:{x:15, y:8} };
    if(this.page > 0) this.add.text(SW/2 - 140, 465, '◀ Trang trước', btnStyle).setOrigin(0.5).setInteractive({useHandCursor:true}).on('pointerdown', ()=>this.scene.start('Map', {page: this.page - 1}));
    if(this.page < totalPages - 1) this.add.text(SW/2 + 140, 465, 'Trang sau ▶', btnStyle).setOrigin(0.5).setInteractive({useHandCursor:true}).on('pointerdown', ()=>this.scene.start('Map', {page: this.page + 1}));
  }

  showNoPlay(){
    const SW = this.scale.width;
    if (this._noPlayMsg && this._noPlayMsg.active) this._noPlayMsg.destroy();
    this._noPlayMsg = this.add.text(SW/2, 250, '🎟️ Hết lượt vào ải hôm nay!\nĐi học & tích Bonus để có thêm lượt.', { fontSize:'18px', color:'#ffffff', fontStyle:'bold', align:'center', backgroundColor:'#C0392B', padding:{x:18,y:12} }).setOrigin(0.5).setDepth(200);
    this.tweens.add({ targets:this._noPlayMsg, alpha:0, y:225, duration:1600, delay:1000, onComplete:()=>{ if(this._noPlayMsg) this._noPlayMsg.destroy(); } });
  }
}
