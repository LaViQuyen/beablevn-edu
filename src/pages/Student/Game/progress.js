// Cầu nối tiến trình với React/Firebase
let PROGRESS = null;
export let EXTERNAL = { initial: { rank:1, beaten:{}, unlockedSkills:false }, onSave: null, onStageResult: null, onConsume: null, playsLeft: 0 };

export function loadProg(){
  if(PROGRESS) return PROGRESS;
  let d = { rank:1, beaten:{}, unlockedSkills:false };
  d = Object.assign(d, EXTERNAL.initial || {});
  if(!d.beaten) d.beaten = {};
  PROGRESS = d; return PROGRESS;
}
// meta: { reset: true } khi người chơi chủ động xóa tiến trình (Chơi lại từ đầu).
// React dựa vào cờ này để phân biệt reset thật với lưu thường (lưu thường chỉ HỢP NHẤT).
export function saveProg(p, meta){ PROGRESS = p; if(EXTERNAL.onSave){ try{ EXTERNAL.onSave(p, meta); }catch(e){} } }

export function resetProgressCache(){ PROGRESS = null; }

// Được index.js gọi trong createGame để nạp tiến trình từ Firebase
export function configureExternal(opts){
  opts = opts || {};
  if (opts.initial) EXTERNAL.initial = opts.initial;
  EXTERNAL.onSave = opts.onSave || null;
  EXTERNAL.onStageResult = opts.onStageResult || null; // báo về React -> Cloud Function chấm điểm + ghi tiến trình
  EXTERNAL.onConsume = opts.onConsume || null; // báo về React để TRỪ 1 lượt khi vào 1 ải
  EXTERNAL.playsLeft = (typeof opts.playsLeft === 'number') ? opts.playsLeft : 0; // số lượt còn được vào ải hôm nay
  PROGRESS = null;
}
