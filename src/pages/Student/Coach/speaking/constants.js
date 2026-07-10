/**
 * HẰNG SỐ SPEAKING COACH: port 1:1 từ speaking.html của COACH SUITE (Flask).
 * Mọi giá trị GIỮ NGUYÊN bản gốc; không đổi số giây, không sửa văn phong chuỗi.
 */

// Thời gian (giây): trả lời Part 1 = 40s, Part 2 = 120s, Part 3 = 60s;
// chuẩn bị Part 2 = 60s, Part 1 & 3 = 15s.
export const TIMES = { 1: 40, 2: 120, 3: 60, prep2: 60, prep13: 15 };

// Luyện Part 1: 3s chuẩn bị, 15s trả lời
export const DRILL_PREP = 3;
export const DRILL_ANSWER = 15;

// Luyện Part 1: đang nói mà ngừng >3s → tự kết thúc
export const DRILL_SILENCE_MS = 3000;

// Trần số lần nói lại 1 câu (nới dần rồi cho qua)
export const MAX_DRILL_ATTEMPTS = 4;

// Im quá 5 giây → tự chuyển câu (chỉ Thi thật, Part 1 & 3)
export const SILENCE_MS = 5000;

// Thi thật Part 1 & 3: chuẩn bị 5s, trả lời tối đa 30s (gốc hardcode trong prepTime/answerTime)
export const EXAM_PREP_13 = 5;
export const EXAM_ANSWER_13 = 30;

// Số câu mặc định của bộ Luyện Part 1 (server nhận 5-10, mặc định 7 như bản Flask)
export const DRILL_COUNT = 7;

// mode: 'practice' | 'drill' | 'exam', port prepTime()/answerTime() của gốc
export function prepTime(item, mode) {
  if (mode === 'drill') return DRILL_PREP;
  if (item.part === 2) return TIMES.prep2;
  return mode === 'exam' ? EXAM_PREP_13 : TIMES.prep13;
}
export function answerTime(item, mode) {
  if (mode === 'drill') return DRILL_ANSWER;
  if (item.part === 2) return TIMES[2];
  return mode === 'exam' ? EXAM_ANSWER_13 : TIMES[item.part];
}

// Văn bản giám khảo đọc cho từng item, port speechFor() của gốc
export function speechFor(item) {
  if (item.part === 2) {
    return (
      item.cue.topic +
      '. You should say: ' +
      item.cue.bullets.join('; ') +
      '; ' +
      item.cue.closing +
      '. Your one minute of preparation starts now.'
    );
  }
  return item.q;
}

/* Overlay xử lý, thông điệp xoay vòng (1800ms/lượt như gốc) */
export const BUSY_MSGS = [
  'Đang kết nối Cơ sở Dữ liệu Be Able VN…',
  'Đối chiếu với thang điểm chuẩn IELTS…',
  'Phân tích phần trình bày của em…',
  'Tổng hợp và chấm bài…',
];
export const BUSY_ROTATE_MS = 1800;

export const PART_INTRO = {
  1: {
    en: "Hello, and welcome to your IELTS speaking practice test. I'm your examiner today. In Part One, I'd like to ask you some questions about familiar topics. Let's begin.",
    vi: '👋 Giám khảo chào và giới thiệu Part 1. Nghe xong, em có 15 giây chuẩn bị cho mỗi câu.',
  },
  2: {
    en: "Thank you. Now, let's move on to Part Two. I'm going to give you a topic. You will have one minute to prepare, and then please speak for up to two minutes.",
    vi: '📋 Part 2: em có 1 phút chuẩn bị, sau đó nói tối đa 2 phút.',
  },
  3: {
    en: "Thank you. Finally, in Part Three, I'd like to discuss some more general questions related to this topic.",
    vi: '💬 Part 3: câu hỏi thảo luận sâu hơn, em có 15 giây chuẩn bị mỗi câu.',
  },
};

export const DRILL_INTRO = {
  en: "Welcome to Part One practice. I'll ask you some short questions. After each answer, I'll help you fix any mistakes, and you'll say it again until it's clear. Let's begin.",
  vi: '🎯 Luyện Part 1: mỗi câu có 3 giây chuẩn bị rồi 15 giây trả lời. Sau đó giám khảo chỉ lỗi và đọc mẫu; em nói lại đến khi đúng mới sang câu tiếp.',
};

export const ACKS = [
  'Thank you.',
  'Alright, thank you.',
  'Okay, thank you very much.',
  "Thank you, that's interesting.",
  'I see, thank you.',
];

export const CRIT_NAMES = {
  FC: 'Fluency & Coherence',
  LR: 'Lexical Resource',
  GRA: 'Grammatical Range & Accuracy',
  PR: 'Pronunciation',
};
export const BAND_KEYS = ['FC', 'LR', 'GRA', 'PR'];

// Danh sách band mục tiêu của select gốc (mặc định chọn 7.0)
export const BAND_OPTIONS = ['5.0', '5.5', '6.0', '6.5', '7.0', '7.5', '8.0', '8.5'];
export const DEFAULT_BAND = '7.0';
