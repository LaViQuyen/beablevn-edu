import { callCoach } from './coachApi';

/**
 * Giọng giám khảo: port speak()/serverSpeak()/webSpeak()/pickVoice()/stopVoice()
 * của speaking.html. Khác gốc: nguồn audio là callCoach('tts','synth') trả
 * { audioB64, mime } thay vì fetch /api/tts trả blob.
 *
 * Bảo đảm như gốc:
 * - onDone LUÔN được gọi đúng 1 lần kể cả lỗi (cờ done + safety-timer
 *   max(20s, len*140ms)).
 * - Server TTS lỗi / timeout 15s → tự rớt về giọng trình duyệt (webSpeak).
 * - Cache Map theo text: câu đã đọc rồi không gọi server lại.
 * - stopVoice() dừng cả Audio đang phát lẫn speechSynthesis.
 */

let currentAudio = null;
const ttsCache = new Map(); // text -> data URL

// Warm-up giọng trình duyệt: getVoices() kích hoạt tải danh sách async (như dòng
// `speechSynthesis.getVoices()` chạy lúc load của gốc) + nghe voiceschanged 1 lần.
let voicesWarmed = false;
function warmVoices() {
  if (voicesWarmed || !('speechSynthesis' in window)) return;
  voicesWarmed = true;
  try {
    window.speechSynthesis.getVoices();
    if (window.speechSynthesis.addEventListener) {
      window.speechSynthesis.addEventListener('voiceschanged', () => {}, { once: true });
    }
  } catch (e) {
    /* bỏ qua */
  }
}

// Mở khóa autoplay 1 lần, GỌI TRONG CLICK HANDLER (nút "Bắt đầu"):
// Audio rỗng + AudioContext.resume để các lần phát tiếp theo không bị chặn.
let audioUnlocked = false;
export function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  warmVoices();
  try {
    const a = new Audio();
    a.muted = true;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) {
    /* bỏ qua */
  }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      const c = new Ctx();
      const r = c.resume();
      if (r && r.then) r.then(() => c.close()).catch(() => {});
      else c.close();
    }
  } catch (e) {
    /* bỏ qua */
  }
}

// Port pickVoice(): ưu tiên giọng Natural en-GB → Natural → Google UK Female → Google → en-GB
function pickVoice() {
  const en = window.speechSynthesis.getVoices().filter((v) => v.lang && /^en/i.test(v.lang));
  return (
    en.find((v) => /natural/i.test(v.name) && /en-GB/i.test(v.lang)) ||
    en.find((v) => /natural/i.test(v.name)) ||
    en.find((v) => /google uk english female/i.test(v.name)) ||
    en.find((v) => /google/i.test(v.name)) ||
    en.find((v) => /en-GB/i.test(v.lang)) ||
    en[0] ||
    null
  );
}

export function stopVoice() {
  try {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  } catch (e) {
    /* bỏ qua */
  }
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch (e) {
      /* bỏ qua */
    }
  }
}

export function speak(text, onDone) {
  warmVoices();
  if (!text) {
    if (onDone) onDone();
    return;
  }
  text = String(text).replace(/\*+/g, '');
  let done = false;
  const fin = () => {
    if (!done) {
      done = true;
      if (onDone) onDone();
    }
  };
  // Safety-timer: dù audio kẹt vẫn đi tiếp (như gốc)
  setTimeout(fin, Math.max(20000, text.length * 140));
  serverSpeak(text, fin).catch(() => webSpeak(text, fin));
}

function serverSpeak(text, fin) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        let url = ttsCache.get(text);
        if (!url) {
          // Timeout 15s: đọc đề không được phép treo lâu; lỗi nào cũng rớt về webSpeak
          const d = await callCoach('tts', 'synth', { text }, { timeout: 15000 });
          if (!d || !d.audioB64) return reject(new Error('tts empty'));
          url = 'data:' + (d.mime || 'audio/mpeg') + ';base64,' + d.audioB64;
          ttsCache.set(text, url);
        }
        stopVoice();
        const a = new Audio(url);
        currentAudio = a;
        a.onended = () => {
          resolve();
          fin();
        };
        a.onerror = () => reject(new Error('audio error'));
        a.play().catch(reject);
      } catch (e) {
        reject(e);
      }
    })();
  });
}

function webSpeak(text, fin) {
  if (!('speechSynthesis' in window)) {
    fin();
    return;
  }
  try {
    window.speechSynthesis.cancel();
    setTimeout(() => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-GB';
      u.rate = 0.95;
      u.pitch = 1.05;
      const v = pickVoice();
      if (v) u.voice = v;
      u.onend = fin;
      u.onerror = fin;
      window.speechSynthesis.speak(u);
      window.speechSynthesis.resume();
      // Resume-timer 2.5s: một số trình duyệt nuốt lệnh speak, không thấy nói thì đi tiếp
      setTimeout(() => {
        if (!window.speechSynthesis.speaking) {
          try {
            window.speechSynthesis.cancel();
          } catch (e) {
            /* bỏ qua */
          }
          fin();
        }
      }, 2500);
    }, 150);
  } catch (e) {
    fin();
  }
}
