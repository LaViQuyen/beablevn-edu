// Bộ tạo âm thanh 8-bit (Web Audio API)
const AudioContext = window.AudioContext || window.webkitAudioContext;
let actx = null;

export function initAudio() {
  if(!actx) actx = new AudioContext();
  if(actx.state === 'suspended') actx.resume();
}

export function playSfx(type) {
  if(!actx) return;
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.connect(gain); gain.connect(actx.destination);
  const t = actx.currentTime;
  
  if (type === 'jump') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(300, t); osc.frequency.exponentialRampToValueAtTime(600, t + 0.15);
      gain.gain.setValueAtTime(0.2, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
      osc.start(t); osc.stop(t + 0.15);
  } else if (type === 'shoot') {
      osc.type = 'square'; osc.frequency.setValueAtTime(500, t); osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
      gain.gain.setValueAtTime(0.1, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
      osc.start(t); osc.stop(t + 0.1);
  } else if (type === 'hit') {
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, t); osc.frequency.exponentialRampToValueAtTime(20, t + 0.2);
      gain.gain.setValueAtTime(0.2, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
      osc.start(t); osc.stop(t + 0.2);
  } else if (type === 'hurt') {
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, t); osc.frequency.linearRampToValueAtTime(50, t + 0.3);
      gain.gain.setValueAtTime(0.3, t); gain.gain.linearRampToValueAtTime(0.01, t + 0.3);
      osc.start(t); osc.stop(t + 0.3);
  } else if (type === 'win') {
      osc.type = 'square'; osc.frequency.setValueAtTime(400, t); osc.frequency.setValueAtTime(523.25, t + 0.1); osc.frequency.setValueAtTime(659.25, t + 0.2); osc.frequency.setValueAtTime(800, t + 0.3);
      gain.gain.setValueAtTime(0.2, t); gain.gain.linearRampToValueAtTime(0.01, t + 0.5);
      osc.start(t); osc.stop(t + 0.5);
  } else if (type === 'freeze') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(800, t); osc.frequency.linearRampToValueAtTime(1200, t + 0.2);
      gain.gain.setValueAtTime(0.1, t); gain.gain.linearRampToValueAtTime(0.01, t + 0.2);
      osc.start(t); osc.stop(t + 0.2);
  } else if (type === 'heal') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(440, t); osc.frequency.exponentialRampToValueAtTime(880, t + 0.25);
      gain.gain.setValueAtTime(0.2, t); gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
      osc.start(t); osc.stop(t + 0.25);
  }
}
