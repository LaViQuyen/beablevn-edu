import Phaser from 'phaser';
import { H, LEVELS } from '../config';
import { initAudio } from '../audio';

export class End extends Phaser.Scene {
  constructor(){ super('End'); }
  init(d){ this.win=d.win; this.score=d.score||0; this.stage=d.stage||0; this.targetPage=d.targetPage||0;}
  create(){ const SW = this.scale.width; this.cameras.main.setBackgroundColor(this.win?0x2B6830:0x8b0000); if(this.win) this.add.particles(0, 0, 'star', { x: SW/2, y: H, lifespan:3000, speed:{min:200,max:400}, angle:{min:220,max:320}, gravityY:300, scale:{start:1,end:0}, rotate:{min:0,max:360}, frequency:100 }); const box = this.add.rectangle(SW/2, H/2, 530, 320, 0x000000, 0.7).setStrokeStyle(4, 0xffffff, 0.3); let endMsg = this.win ? `HÀNH TRÌNH TIẾP TỤC` : `THẤT BẠI!`; if(this.win && LEVELS[this.stage].isCollectStage) endMsg = "🎉 ĐÃ SỞ HỮU LỄ NGHĨA & THÁI ĐỘ!"; this.add.text(SW/2, H/2 - 80, endMsg, {fontFamily:'Be Vietnam Pro',fontSize:'28px',color:'#FFD23F',fontStyle:'900'}).setOrigin(0.5); this.add.text(SW/2, H/2 - 10, '⭐ Lượng điểm thưởng: '+this.score, {fontSize:'20px',color:'#fff'}).setOrigin(0.5); const btn = this.add.rectangle(SW/2, H/2 + 60, 240, 60, this.win?0x3D8B47:0xd63d54, 1).setStrokeStyle(2,0xffffff,0.5).setInteractive({useHandCursor:true}); this.add.text(SW/2, H/2 + 60, this.win?'🗺 Giao diện chính':'↻ Thử Lại', {fontSize:'22px',color:'#fff',fontStyle:'bold'}).setOrigin(0.5); btn.on('pointerdown',()=> { initAudio(); this.scene.start('Map', {page: this.targetPage}); }); }
}

// Khoi tao game va gan vao 1 phan tu DOM (div) do React cung cap.
// opts = { initial: {rank, beaten, unlockedSkills}, onSave: fn(progress) }
