// Điểm vào game: khởi tạo Phaser + cầu nối Firebase. Import từ HanhTrinhGame.jsx.
import Phaser from 'phaser';
import { W, H } from './config';
import { configureExternal } from './progress';
import { initAudio } from './audio';
import { Preload } from './scenes/PreloadScene';
import { MapScene } from './scenes/MapScene';
import { PlayScene } from './scenes/PlayScene';
import { End } from './scenes/EndScene';

// opts = { initial: {rank, beaten, unlockedSkills}, onSave: fn(progress) }
export function createGame(parent, opts){
  opts = opts || {};
  configureExternal({ initial: opts.initial, onSave: opts.onSave, onStars: opts.onStars, onConsume: opts.onConsume, playsLeft: opts.playsLeft });
  // mở khóa audio sau cử chỉ đầu tiên của người dùng
  document.addEventListener('click', initAudio, { once: true });
  document.addEventListener('touchstart', initAudio, { once: true });
  // Bề rộng game theo tỉ lệ màn hình thiết bị (giữ chiều cao H=540) -> FIT lấp đầy
  // màn hình khi xoay ngang, không còn viền đen 2 bên. Mặc định 16:9 nếu không truyền.
  const aspect = Math.min(Math.max(opts.aspect || (W / H), 1.6), 2.4);
  const gameW = Math.round(H * aspect);
  return new Phaser.Game({
    type: Phaser.AUTO, width: gameW, height: H, parent,
    backgroundColor: '#1a2a40',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { y: 1200 }, debug: false } },
    scene: [ Preload, MapScene, PlayScene, End ]
  });
}
