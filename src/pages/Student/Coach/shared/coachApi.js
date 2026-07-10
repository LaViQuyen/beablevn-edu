/**
 * Cầu nối gọi Cloud Functions của module IELTS Coach.
 * QUAN TRỌNG: httpsCallable mặc định timeout 70s sẽ ĐỨT các lượt chấm audio dài
 * (server retry + fallback model có thể tới vài phút) nên phải truyền timeout riêng.
 * Lỗi trả về đã là thông báo tiếng Việt từ server (HttpsError); giữ nguyên .code
 * để component quyết định (vd tts unavailable thì rớt về giọng trình duyệt).
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../firebase';

const CALLABLE_TIMEOUT = 280000;

const FN_NAMES = {
  speaking: 'coachSpeaking',
  writing: 'coachWriting',
  intro: 'coachIntro',
  tts: 'coachTts',
};

// Thông báo dự phòng khi server không gửi message rõ ràng
const FALLBACK_MSG = {
  'functions/resource-exhausted': 'Em đã đạt giới hạn lượt luyện hôm nay của công cụ này. Mai luyện tiếp nhé.',
  'functions/unauthenticated': 'Phiên đăng nhập đã hết, em đăng xuất rồi đăng nhập lại giúp nhé.',
  'functions/deadline-exceeded': 'Hệ thống phản hồi chậm quá, em bấm thử lại giúp nhé.',
  'functions/unavailable': 'Hệ thống tạm gián đoạn, em thử lại sau ít phút nhé.',
  'functions/internal': 'Có lỗi xảy ra, em bấm thử lại giúp nhé.',
};

export async function callCoach(tool, action, payload = {}, opts = {}) {
  const name = FN_NAMES[tool];
  if (!name) throw new Error(`Công cụ không hợp lệ: ${tool}`);
  const callable = httpsCallable(functions, name, {
    timeout: opts.timeout || CALLABLE_TIMEOUT,
  });
  try {
    const res = await callable({ action, ...payload });
    return res.data;
  } catch (e) {
    const code = e?.code || 'functions/internal';
    const msg =
      (e?.message && !/^internal$/i.test(e.message) && e.message) ||
      FALLBACK_MSG[code] ||
      FALLBACK_MSG['functions/internal'];
    const err = new Error(msg);
    err.code = code;
    throw err;
  }
}

// Khoá ngày YYYY-MM-DD theo giờ Việt Nam, KHỚP với vnDateKey của backend
export function vnToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// Đánh thức function (cold start ~3-5s) khi học viên mở trang chọn công cụ,
// đúng vai /api/warmup của bản Flask. Lỗi thì im lặng, không ảnh hưởng gì.
export function warmUp() {
  ['speaking', 'writing', 'intro'].forEach((tool) => {
    callCoach(tool, 'ping').catch(() => {});
  });
}
