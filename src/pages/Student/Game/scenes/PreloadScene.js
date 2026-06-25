import Phaser from 'phaser';
import { SVG, SIZES } from '../assets';

// Phaser nạp data URI bằng atob() => chuỗi base64 phải hợp lệ.
// SVG có thể chứa ký tự ngoài Latin1 (vd dấu tiếng Việt) khiến btoa() trần ném lỗi.
// => mã hóa UTF-8 rồi mới btoa (an toàn Unicode).
function svgToBase64(str){
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export class Preload extends Phaser.Scene {
  constructor(){ super('Preload'); }
  preload(){ Object.keys(SVG).forEach(k=>{ const [w,h]=SIZES[k]||[50,50];
    this.load.svg(k,'data:image/svg+xml;base64,'+svgToBase64(SVG[k]),{width:w,height:h}); }); }
  create(){ this.scene.start('Map'); }
}
